import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, documentId } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { PostCard } from "../components/post-card";
import { StoriesBar } from "../components/stories-bar";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { toggleFollow } from "../lib/firestore";
import type { Post } from "../lib/firestore";

export const Route = createFileRoute("/_app/feed")({
  ssr: false,
  component: Feed,
});

function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(collection(db, "users"), limit(5));
      const snap = await getDocs(q);
      setSuggestions(snap.docs.map((d) => d.data()).filter((u: any) => u.uid !== user.uid));
    })();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-8 grid lg:grid-cols-[1fr_320px] gap-8">
      <div className="max-w-xl w-full mx-auto space-y-6">
        <StoriesBar />
        {posts.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="font-display text-2xl font-bold text-foreground">It's quiet here</div>
            <p className="mt-1 text-sm">Be the first to share a moment.</p>
            <Link to="/create" className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Create your first post</Link>
          </div>
        )}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
      <aside className="hidden lg:block space-y-6 sticky top-8 self-start">
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-3">Suggested for you</div>
          <div className="space-y-3">
            {suggestions.map((s: any) => <SuggestionRow key={s.uid} user={s} />)}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SuggestionRow({ user: u }: { user: any }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  async function follow() {
    if (!user) return;
    setFollowing(true);
    await toggleFollow(u.uid, user.uid);
  }
  return (
    <div className="flex items-center gap-3">
      <Link to="/profile/$username" params={{ username: u.username }}>
        <Avatar className="h-10 w-10"><AvatarImage src={u.photoURL} /><AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link to="/profile/$username" params={{ username: u.username }} className="text-sm font-semibold truncate block">{u.username}</Link>
        <div className="text-xs text-muted-foreground truncate">{u.displayName}</div>
      </div>
      <Button size="sm" variant={following ? "secondary" : "default"} onClick={follow}>{following ? "Following" : "Follow"}</Button>
    </div>
  );
}
