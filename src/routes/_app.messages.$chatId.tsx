import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ref as dbRef, onValue, push, set as dbSet, serverTimestamp as rtdbTime, onDisconnect, remove, update } from "firebase/database";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { rtdb, db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Send, Image as ImageIcon, Smile, ArrowLeft, Trash2 } from "lucide-react";
import { uploadFile } from "../lib/upload";
import EmojiPicker from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { useTheme } from "../lib/theme-context";

export const Route = createFileRoute("/_app/messages/$chatId")({
  ssr: false,
  component: Chat,
});

function Chat() {
  const { chatId } = Route.useParams();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [other, setOther] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [presence, setPresence] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat metadata + other user
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cs = await getDoc(doc(db, "chats", chatId));
      const members = cs.data()?.members ?? [];
      const otherId = members.find((m: string) => m !== user.uid);
      if (otherId) {
        const u = await getDoc(doc(db, "users", otherId));
        setOther({ uid: otherId, ...u.data() });
        // presence
        onValue(dbRef(rtdb, `presence/${otherId}`), (snap) => setPresence(snap.val()));
        // typing
        onValue(dbRef(rtdb, `typing/${chatId}/${otherId}`), (snap) => setOtherTyping(!!snap.val()));
      }
    })();
  }, [chatId, user]);

  // Subscribe messages
  useEffect(() => {
    const r = dbRef(rtdb, `messages/${chatId}`);
    const unsub = onValue(r, (snap) => {
      const arr: any[] = [];
      snap.forEach((c) => { arr.push({ id: c.key, ...c.val() }); });
      arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      setMessages(arr);
      // mark read
      if (user) {
        arr.forEach((m) => {
          if (m.senderId !== user.uid && !m.readBy?.[user.uid]) {
            update(dbRef(rtdb, `messages/${chatId}/${m.id}/readBy`), { [user.uid]: true });
          }
        });
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    });
    return unsub;
  }, [chatId, user]);

  // Typing indicator
  useEffect(() => {
    if (!user) return;
    const tref = dbRef(rtdb, `typing/${chatId}/${user.uid}`);
    dbSet(tref, typing);
    onDisconnect(tref).set(false);
  }, [typing, chatId, user]);

  async function send(content: { text?: string; imageUrl?: string }) {
    if (!user || !profile) return;
    try {
      // Derive members from chatId (sorted "uidA_uidB") so the doc always has both
      const members = chatId.split("_");
      const otherId = other?.uid ?? members.find((m: string) => m !== user.uid);
      const memberList = otherId ? Array.from(new Set([user.uid, otherId])) : members;

      // Ensure chat doc exists with members BEFORE writing message so the friend can find it
      await setDoc(
        doc(db, "chats", chatId),
        {
          members: memberList,
          lastMessage: content.text || "📷 Image",
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const r = push(dbRef(rtdb, `messages/${chatId}`));
      await dbSet(r, {
        senderId: user.uid,
        senderName: profile.username,
        text: content.text ?? "",
        imageUrl: content.imageUrl ?? "",
        createdAt: Date.now(),
        readBy: { [user.uid]: true },
      });
    } catch (err: any) {
      console.error("send message failed", err);
      toast.error(err?.message ?? "Could not send message. Check your Firebase rules.");
    }
  }


  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text.trim();
    setText("");
    setTyping(false);
    await send({ text: t });
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    const url = await uploadFile(`chat/${chatId}/${Date.now()}-${f.name}`, f);
    await send({ imageUrl: url });
  }

  async function deleteMsg(id: string) {
    await remove(dbRef(rtdb, `messages/${chatId}/${id}`));
  }

  const isOnline = presence?.online;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen max-w-3xl mx-auto">
      <header className="flex items-center gap-3 p-3 border-b border-border bg-card">
        <Link to="/messages" className="md:hidden p-1.5 hover:bg-accent rounded-lg"><ArrowLeft className="h-5 w-5" /></Link>
        <Link to="/profile/$username" params={{ username: other?.username ?? "" }} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <Avatar className="h-10 w-10"><AvatarImage src={other?.photoURL} /><AvatarFallback>{other?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            {isOnline && <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{other?.username}</div>
            <div className="text-xs text-muted-foreground">{otherTyping ? "Typing..." : isOnline ? "Active now" : "Offline"}</div>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          const mine = m.senderId === user?.uid;
          const readByOther = other && m.readBy?.[other.uid];
          return (
            <div key={m.id} className={`flex group ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                {m.imageUrl && <img src={m.imageUrl} className="rounded-xl max-w-xs mb-1" />}
                {m.text}
                <div className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {mine && readByOther && "✓✓ "}
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              {mine && (
                <button onClick={() => deleteMsg(m.id)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 ml-1 self-center"><Trash2 className="h-3 w-3" /></button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={onSend} className="p-3 border-t border-border flex items-center gap-2 bg-card">
        <label className="p-2 hover:bg-accent rounded-full cursor-pointer">
          <ImageIcon className="h-5 w-5" />
          <input type="file" accept="image/*" className="hidden" onChange={onImage} />
        </label>
        <Popover>
          <PopoverTrigger asChild><button type="button" className="p-2 hover:bg-accent rounded-full"><Smile className="h-5 w-5" /></button></PopoverTrigger>
          <PopoverContent className="p-0 w-auto border-0" align="start">
            <EmojiPicker theme={theme === "dark" ? ("dark" as any) : ("light" as any)} onEmojiClick={(e) => setText((t) => t + e.emoji)} />
          </PopoverContent>
        </Popover>
        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); setTyping(e.target.value.length > 0); }}
          onBlur={() => setTyping(false)}
          placeholder="Message..."
          className="rounded-full bg-accent border-0"
        />
        <Button type="submit" size="icon" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
