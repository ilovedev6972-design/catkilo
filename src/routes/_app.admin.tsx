import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { toast } from "sonner";
import { BadgeCheck, Trash2, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  ssr: false,
  component: Admin,
});

function Admin() {
  const { profile, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.role !== "admin") return;
    const u1 = onSnapshot(query(collection(db, "users"), limit(100)), (s) => setUsers(s.docs.map((d) => d.data())));
    const u2 = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)), (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [profile]);

  if (loading) return null;
  if (profile?.role !== "admin") return <Navigate to="/feed" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <h1 className="font-display text-3xl font-bold">Admin panel</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-6"><div className="text-sm text-muted-foreground">Users</div><div className="font-display text-3xl font-bold">{users.length}</div></Card>
        <Card className="p-6"><div className="text-sm text-muted-foreground">Posts (recent)</div><div className="font-display text-3xl font-bold">{posts.length}</div></Card>
        <Card className="p-6"><div className="text-sm text-muted-foreground">Verified</div><div className="font-display text-3xl font-bold">{users.filter((u) => u.verified).length}</div></Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Users</h2>
        <Card className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.uid} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">{u.username}{u.verified && <BadgeCheck className="h-4 w-4 text-primary" />}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={async () => { await updateDoc(doc(db, "users", u.uid), { verified: !u.verified }); toast.success("Updated"); }}>
                {u.verified ? "Unverify" : "Verify"}
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { await updateDoc(doc(db, "users", u.uid), { banned: !u.banned }); toast.success("Updated"); }}>
                <ShieldOff className="h-4 w-4" /> {u.banned ? "Unban" : "Ban"}
              </Button>
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Recent posts</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {posts.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
              {p.mediaType === "video" ? <video src={p.mediaUrls[0]} className="w-full h-full object-cover" /> : <img src={p.mediaUrls[0]} className="w-full h-full object-cover" />}
              <button onClick={async () => { await deleteDoc(doc(db, "posts", p.id)); toast.success("Deleted"); }} className="absolute top-1 right-1 p-1.5 bg-destructive text-destructive-foreground rounded-lg opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
