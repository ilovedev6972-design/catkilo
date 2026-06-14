import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PostCard } from "../components/post-card";

export const Route = createFileRoute("/_app/post/$postId")({
  ssr: false,
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  const [post, setPost] = useState<any>(null);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "posts", postId), (s) => {
      if (s.exists()) setPost({ id: s.id, ...s.data() });
    });
    return unsub;
  }, [postId]);
  if (!post) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <PostCard post={post} />
    </div>
  );
}
