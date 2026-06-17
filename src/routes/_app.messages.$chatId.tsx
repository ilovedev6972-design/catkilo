import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  onDisconnect,
  onValue,
  push,
  ref as dbRef,
  remove,
  set as dbSet,
  update,
} from "firebase/database";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowLeft, Image as ImageIcon, Send, Smile, Trash2 } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { useAuth } from "../lib/auth-context";
import { db, rtdb } from "../lib/firebase";
import { useTheme } from "../lib/theme-context";
import { uploadFile } from "../lib/upload";

export const Route = createFileRoute("/_app/messages/$chatId")({
  ssr: false,
  component: Chat,
});

type ChatUser = {
  uid: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  text?: string;
  imageUrl?: string;
  createdAt?: number;
  readBy?: Record<string, boolean>;
};

type Presence = {
  online?: boolean;
  lastSeen?: number;
};

const chatMembersFromId = (chatId: string) => chatId.split("_").filter(Boolean);

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const toMemberMap = (members: string[]) =>
  members.reduce<Record<string, true>>((acc, uid) => {
    acc[uid] = true;
    return acc;
  }, {});

function Chat() {
  const { chatId } = Route.useParams();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [other, setOther] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let stopPresence: (() => void) | undefined;
    let stopTyping: (() => void) | undefined;

    setChatReady(false);

    (async () => {
      let members = chatMembersFromId(chatId);

      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        const docMembers = chatSnap.data()?.members;
        if (Array.isArray(docMembers) && docMembers.includes(user.uid)) {
          members = docMembers;
        }
      } catch (err) {
        console.warn("chat metadata unavailable", err);
      }

      const otherId = members.find((memberId) => memberId !== user.uid);
      if (!otherId) {
        if (!cancelled) {
          toast.error("This conversation link is invalid.");
          setChatReady(true);
        }
        return;
      }

      await dbSet(dbRef(rtdb, `chatMembers/${chatId}`), toMemberMap([user.uid, otherId])).catch(
        (err) => {
          console.warn("chat membership mirror unavailable", err);
        },
      );

      const otherSnap = await getDoc(doc(db, "users", otherId));
      if (cancelled) return;

      setOther({ uid: otherId, ...(otherSnap.data() as Partial<ChatUser>) });
      stopPresence = onValue(dbRef(rtdb, `presence/${otherId}`), (snap) => {
        setPresence(snap.val() as Presence | null);
      });
      stopTyping = onValue(dbRef(rtdb, `typing/${chatId}/${otherId}`), (snap) => {
        setOtherTyping(Boolean(snap.val()));
      });
      setChatReady(true);
    })().catch((err) => {
      console.error("load chat failed", err);
      toast.error(errorMessage(err, "Could not open this conversation."));
      setChatReady(true);
    });

    return () => {
      cancelled = true;
      stopPresence?.();
      stopTyping?.();
    };
  }, [chatId, user]);

  useEffect(() => {
    if (!user || !chatReady) return;

    const messagesRef = dbRef(rtdb, `messages/${chatId}`);
    const unsub = onValue(
      messagesRef,
      (snap) => {
        const nextMessages: ChatMessage[] = [];
        snap.forEach((child) => {
          nextMessages.push({ id: child.key ?? "", ...(child.val() as Omit<ChatMessage, "id">) });
        });
        nextMessages.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        setMessages(nextMessages);

        nextMessages.forEach((message) => {
          if (message.senderId !== user.uid && !message.readBy?.[user.uid]) {
            update(dbRef(rtdb, `messages/${chatId}/${message.id}/readBy`), {
              [user.uid]: true,
            }).catch(() => {});
          }
        });

        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }, 50);
      },
      (err) => {
        console.error("load messages failed", err);
        toast.error(
          "Could not load messages. Publish the Firebase Realtime Database rules from FIREBASE_SECURITY_RULES.txt.",
        );
      },
    );

    return unsub;
  }, [chatId, user, chatReady]);

  useEffect(() => {
    if (!user || !chatReady) return;

    const typingRef = dbRef(rtdb, `typing/${chatId}/${user.uid}`);
    dbSet(typingRef, typing).catch(() => {});
    onDisconnect(typingRef).set(false);
  }, [chatId, chatReady, typing, user]);

  async function send(content: { text?: string; imageUrl?: string }) {
    if (!user) return false;

    setSending(true);
    try {
      const members = chatMembersFromId(chatId);
      const otherId = other?.uid ?? members.find((memberId) => memberId !== user.uid);
      if (!otherId) throw new Error("Could not find the other person in this chat.");

      const memberList = Array.from(new Set([user.uid, otherId])).sort();
      await setDoc(
        doc(db, "chats", chatId),
        { members: memberList, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await dbSet(dbRef(rtdb, `chatMembers/${chatId}`), toMemberMap(memberList)).catch(() => {});

      const newMessageRef = push(dbRef(rtdb, `messages/${chatId}`));
      await dbSet(newMessageRef, {
        createdAt: Date.now(),
        imageUrl: content.imageUrl ?? "",
        readBy: { [user.uid]: true },
        senderId: user.uid,
        senderName: profile?.username ?? user.displayName ?? user.email ?? "Member",
        text: content.text ?? "",
      });
      await setDoc(
        doc(db, "chats", chatId),
        {
          lastMessage: content.text || "📷 Image",
          lastMessageAt: serverTimestamp(),
          members: memberList,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    } catch (err) {
      console.error("send message failed", err);
      toast.error(errorMessage(err, "Could not send message. Check your Firebase rules."));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const nextText = text.trim();
    setText("");
    setTyping(false);

    const sent = await send({ text: nextText });
    if (!sent) setText(nextText);
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const url = await uploadFile(`chat/${chatId}/${Date.now()}-${file.name}`, file);
      await send({ imageUrl: url });
    } catch (err) {
      toast.error(errorMessage(err, "Could not upload image."));
    }
  }

  async function deleteMsg(id: string) {
    await remove(dbRef(rtdb, `messages/${chatId}/${id}`)).catch((err) => {
      toast.error(errorMessage(err, "Could not delete message."));
    });
  }

  const isOnline = presence?.online;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col md:h-screen">
      <header className="flex items-center gap-3 border-b border-border bg-card p-3">
        <Link to="/messages" className="rounded-lg p-1.5 hover:bg-accent md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link
          to="/profile/$username"
          params={{ username: other?.username ?? "" }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={other?.photoURL} />
              <AvatarFallback>{other?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{other?.username ?? "Chat"}</div>
            <div className="text-xs text-muted-foreground">
              {otherTyping ? "Typing..." : isOnline ? "Active now" : "Offline"}
            </div>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {chatReady && messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <p>No messages yet.</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.senderId === user?.uid;
          const readByOther = other && message.readBy?.[other.uid];
          return (
            <div key={message.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                }`}
              >
                {message.imageUrl && (
                  <img src={message.imageUrl} alt="Chat attachment" className="mb-1 max-w-xs rounded-xl" />
                )}
                {message.text}
                <div
                  className={`mt-0.5 text-[10px] ${
                    mine ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {mine && readByOther && "✓✓ "}
                  {new Date(message.createdAt ?? Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {mine && (
                <button
                  onClick={() => deleteMsg(message.id)}
                  className="ml-1 self-center opacity-0 group-hover:opacity-60 hover:opacity-100"
                  type="button"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border bg-card p-3">
        <label className="cursor-pointer rounded-full p-2 hover:bg-accent">
          <ImageIcon className="h-5 w-5" />
          <input type="file" accept="image/*" className="hidden" onChange={onImage} />
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="rounded-full p-2 hover:bg-accent">
              <Smile className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-0 p-0" align="start">
            <EmojiPicker
              theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
              onEmojiClick={(emoji) => setText((current) => current + emoji.emoji)}
            />
          </PopoverContent>
        </Popover>
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTyping(e.target.value.length > 0);
          }}
          onBlur={() => setTyping(false)}
          placeholder="Message..."
          className="rounded-full border-0 bg-accent"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || sending || !chatReady}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
