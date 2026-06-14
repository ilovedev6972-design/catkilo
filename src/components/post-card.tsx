import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { toggleLike, toggleSave, addComment, deletePost } from "../lib/firestore";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Post } from "../lib/firestore";

export function PostCard({ post }: { post: Post }) {
  const { user, profile } = useAuth();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "posts", post.id, "likes", user.uid)).then((s) => setLiked(s.exists()));
    getDoc(doc(db, "users", user.uid, "saved", post.id)).then((s) => setSaved(s.exists()));
  }, [user, post.id]);

  useEffect(() => {
    if (!showComments) return;
    const unsub = onSnapshot(doc(db, "posts", post.id), () => {});
    // load comments
    import("firebase/firestore").then(({ collection, onSnapshot: oss, query, orderBy, limit }) => {
      const q = query(collection(db, "posts", post.id, "comments"), orderBy("createdAt", "desc"), limit(20));
      const u = oss(q, (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
      return u;
    });
    return () => unsub();
  }, [showComments, post.id]);

  async function onLike() {
    if (!user) return;
    setLiked(!liked);
    await toggleLike(post.id, user.uid, post.authorId);
  }
  async function onSave() {
    if (!user) return;
    setSaved(!saved);
    await toggleSave(post.id, user.uid);
  }
  async function onComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !comment.trim()) return;
    await addComment(post.id, post.authorId, user.uid, profile.username, profile.photoURL ?? "", comment.trim());
    setComment("");
  }
  async function onDelete() {
    if (!user || user.uid !== post.authorId) return;
    await deletePost(post.id, post.authorId);
    toast.success("Post deleted");
  }
  async function onShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <article className="bg-card border border-border rounded-3xl overflow-hidden">
      <header className="flex items-center justify-between p-3">
        <Link to="/profile/$username" params={{ username: post.username }} className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            <AvatarImage src={post.authorPhoto} />
            <AvatarFallback>{post.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-semibold leading-tight">{post.username}</div>
            {post.location && <div className="text-xs text-muted-foreground">{post.location}</div>}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 hover:bg-accent rounded-lg"><MoreHorizontal className="h-5 w-5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onShare}>Copy link</DropdownMenuItem>
            {user?.uid === post.authorId && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="relative bg-black aspect-square">
        {post.mediaType === "video" ? (
          <video src={post.mediaUrls[0]} controls className="w-full h-full object-contain" />
        ) : (
          <>
            <img src={post.mediaUrls[idx]} alt="" className="w-full h-full object-cover" />
            {post.mediaUrls.length > 1 && (
              <>
                {idx > 0 && (
                  <button onClick={() => setIdx(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {idx < post.mediaUrls.length - 1 && (
                  <button onClick={() => setIdx(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                <div className="absolute top-2 right-2 bg-background/70 text-foreground text-xs rounded-full px-2 py-0.5">{idx + 1}/{post.mediaUrls.length}</div>
              </>
            )}
          </>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onLike}>
            <Heart className={liked ? "fill-primary text-primary" : ""} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowComments((s) => !s)}>
            <MessageCircle />
          </Button>
          <Button variant="ghost" size="icon" onClick={onShare}><Send /></Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={onSave}>
            <Bookmark className={saved ? "fill-foreground" : ""} />
          </Button>
        </div>
        <div className="text-sm font-semibold">{post.likesCount + (liked && !comments.length ? 0 : 0)} likes</div>
        {post.caption && (
          <p className="text-sm">
            <Link to="/profile/$username" params={{ username: post.username }} className="font-semibold mr-1.5">{post.username}</Link>
            {post.caption}
          </p>
        )}
        {post.hashtags.length > 0 && (
          <div className="text-sm text-primary">{post.hashtags.map((t) => `#${t}`).join(" ")}</div>
        )}
        {post.commentsCount > 0 && !showComments && (
          <button onClick={() => setShowComments(true)} className="text-sm text-muted-foreground">View all {post.commentsCount} comments</button>
        )}
        {showComments && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="text-sm flex gap-2">
                <span className="font-semibold">{c.username}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : "Just now"}
        </div>
        <form onSubmit={onComment} className="flex items-center gap-2 pt-2 border-t border-border">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="border-0 focus-visible:ring-0 px-0" />
          {comment && <Button type="submit" size="sm" variant="ghost" className="text-primary">Post</Button>}
        </form>
      </div>
    </article>
  );
}
