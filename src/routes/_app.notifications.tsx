import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/notifications")({
  ssr: false,
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const arr = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const from = await getDoc(doc(db, "users", data.fromUserId));
        return { id: d.id, ...data, from: from.data() };
      }));
      setItems(arr);
    });
    return unsub;
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-3xl font-bold mb-6">Activity</h1>
      {items.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}
      <div className="space-y-1">
        {items.map((n) => (
          <div key={n.id} className="flex items-center gap-3 p-3 hover:bg-accent rounded-2xl">
            <Avatar className="h-10 w-10"><AvatarImage src={n.from?.photoURL} /><AvatarFallback>{n.from?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div className="flex-1 text-sm">
              <Link to="/profile/$username" params={{ username: n.from?.username ?? "" }} className="font-semibold">{n.from?.username}</Link>{" "}
              {n.type === "like" ? "liked your post" : n.type === "comment" ? `commented: ${n.text}` : n.type === "follow" ? "started following you" : n.type}
              <div className="text-xs text-muted-foreground">{n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
