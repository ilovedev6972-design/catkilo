import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Input } from "../components/ui/input";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export const Route = createFileRoute("/_app/explore")({
  ssr: false,
  component: Explore,
});

function Explore() {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("likesCount", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const term = search.toLowerCase().trim().replace(/^[@#]/, "");
    const t = setTimeout(async () => {
      const snap = await getDocs(query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + "\uf8ff"), limit(10)));
      setResults(snap.docs.map((d) => d.data()));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users, #hashtags" className="pl-10 h-12 rounded-2xl" />
      </div>
      {results.length > 0 && (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
          {results.map((u: any) => (
            <Link key={u.uid} to="/profile/$username" params={{ username: u.username }} className="flex items-center gap-3 p-3 hover:bg-accent">
              <Avatar className="h-10 w-10"><AvatarImage src={u.photoURL} /><AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
              <div>
                <div className="font-semibold text-sm">{u.username}</div>
                <div className="text-xs text-muted-foreground">{u.displayName}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((p) => (
          <Link key={p.id} to="/post/$postId" params={{ postId: p.id }} className="aspect-square relative bg-muted overflow-hidden rounded-md sm:rounded-xl group">
            {p.mediaType === "video" ? (
              <video src={p.mediaUrls[0]} className="w-full h-full object-cover" />
            ) : (
              <img src={p.mediaUrls[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
