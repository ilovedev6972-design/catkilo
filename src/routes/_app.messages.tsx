import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/messages")({
  ssr: false,
  component: Messages,
});

function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchRes, setSearchRes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("members", "array-contains", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const arr: any[] = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const otherId = data.members.find((m: string) => m !== user.uid);
        const other = await getDoc(doc(db, "users", otherId));
        return { id: d.id, other: other.data(), ...data };
      }));
      arr.sort((a: any, b: any) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0));
      setChats(arr);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!search.trim()) { setSearchRes([]); return; }
    const term = search.toLowerCase().trim();
    const t = setTimeout(async () => {
      const snap = await getDocs(query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + "\uf8ff"), limit(10)));
      setSearchRes(snap.docs.map((d) => d.data()).filter((u: any) => u.uid !== user?.uid));
    }, 200);
    return () => clearTimeout(t);
  }, [search, user]);

  async function startChat(otherUid: string) {
    if (!user) return;
    const chatId = [user.uid, otherUid].sort().join("_");
    const ref = doc(db, "chats", chatId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const { setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(ref, { members: [user.uid, otherUid], createdAt: serverTimestamp(), lastMessage: "", lastMessageAt: serverTimestamp() });
    }
    navigate({ to: "/messages/$chatId", params: { chatId } });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-3xl font-bold mb-6">Messages</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a user..." className="pl-10 rounded-2xl" />
      </div>
      {searchRes.length > 0 && (
        <div className="mb-4 bg-card border border-border rounded-2xl divide-y divide-border">
          {searchRes.map((u: any) => (
            <button key={u.uid} onClick={() => startChat(u.uid)} className="w-full flex items-center gap-3 p-3 hover:bg-accent text-left">
              <Avatar className="h-10 w-10"><AvatarImage src={u.photoURL} /><AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
              <div><div className="font-semibold text-sm">{u.username}</div><div className="text-xs text-muted-foreground">Start chat</div></div>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {chats.length === 0 && <p className="text-muted-foreground text-sm">No conversations yet. Search someone to start chatting.</p>}
        {chats.map((c) => (
          <Link key={c.id} to="/messages/$chatId" params={{ chatId: c.id }} className="flex items-center gap-3 p-3 hover:bg-accent rounded-2xl">
            <Avatar className="h-12 w-12"><AvatarImage src={c.other?.photoURL} /><AvatarFallback>{c.other?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{c.other?.username}</div>
              <div className="text-xs text-muted-foreground truncate">{c.lastMessage || "Tap to chat"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
