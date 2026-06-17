import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, orderBy, limit, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { toggleFollow } from "../lib/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { uploadFile } from "../lib/upload";
import { toast } from "sonner";
import { BadgeCheck, Grid3x3, Bookmark, Film } from "lucide-react";

export const Route = createFileRoute("/_app/profile/$username")({
  ssr: false,
  component: Profile,
});

function Profile() {
  const { username } = Route.useParams();
  const { user, profile: me } = useAuth();
  const [user2, setUser2] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<"posts" | "reels" | "saved">("posts");
  const [following, setFollowing] = useState(false);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    (async () => {
      const unameSnap = await getDoc(doc(db, "usernames", username));
      if (!unameSnap.exists()) { setUser2(null); return; }
      const uid = unameSnap.data().uid;
      const u = await getDoc(doc(db, "users", uid));
      setUser2({ uid, ...u.data() });
    })();
  }, [username]);

  useEffect(() => {
    if (!user2) return;
    const q = query(collection(db, "posts"), where("authorId", "==", user2.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user2]);

  useEffect(() => {
    if (!user || !user2 || user.uid === user2.uid) return;
    getDoc(doc(db, "users", user.uid, "following", user2.uid)).then((s) => setFollowing(s.exists()));
  }, [user, user2]);

  if (!user2) return <div className="p-8 text-center text-muted-foreground">User not found</div>;

  const isMe = user?.uid === user2.uid;
  const chatId = user ? [user.uid, user2.uid].sort().join("_") : "";

  async function follow() {
    if (!user) return;
    setFollowing(!following);
    await toggleFollow(user2.uid, user.uid);
  }

  const displayed = tab === "reels" ? posts.filter((p) => p.mediaType === "video") : posts;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
      <header className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-start sm:items-center">
        <Avatar className="h-24 w-24 sm:h-36 sm:w-36 shrink-0">
          <AvatarImage src={user2.photoURL} />
          <AvatarFallback className="text-3xl">{user2.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold flex items-center gap-1.5">
              {user2.username}
              {user2.verified && <BadgeCheck className="h-5 w-5 text-primary" />}
            </h1>
            {isMe ? (
              <Button variant="secondary" onClick={() => setEdit(true)}>Edit profile</Button>
            ) : (
              <>
                <Button variant={following ? "secondary" : "default"} onClick={follow}>{following ? "Following" : "Follow"}</Button>
                <Link to="/messages/$chatId" params={{ chatId }}><Button variant="secondary">Message</Button></Link>
              </>
            )}
          </div>
          <div className="flex gap-6 text-sm">
            <div><span className="font-semibold">{user2.postsCount ?? 0}</span> posts</div>
            <div><span className="font-semibold">{user2.followersCount ?? 0}</span> followers</div>
            <div><span className="font-semibold">{user2.followingCount ?? 0}</span> following</div>
          </div>
          <div>
            <div className="font-semibold text-sm">{user2.displayName}</div>
            {user2.bio && <p className="text-sm whitespace-pre-line mt-0.5">{user2.bio}</p>}
            {user2.website && <a href={user2.website} target="_blank" rel="noreferrer" className="text-sm text-primary">{user2.website}</a>}
          </div>
        </div>
      </header>

      <div className="mt-10 border-t border-border flex items-center justify-center gap-8">
        {[{k:"posts",l:"Posts",I:Grid3x3},{k:"reels",l:"Reels",I:Film},{k:"saved",l:"Saved",I:Bookmark}].map(({k,l,I}) => (
          <button key={k} onClick={() => setTab(k as any)} className={`flex items-center gap-1.5 py-3 text-xs uppercase tracking-wider font-semibold border-t-2 -mt-px ${tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}>
            <I className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-4">
        {displayed.map((p) => (
          <Link key={p.id} to="/post/$postId" params={{ postId: p.id }} className="aspect-square bg-muted overflow-hidden rounded-md sm:rounded-xl">
            {p.mediaType === "video" ? <video src={p.mediaUrls[0]} className="w-full h-full object-cover" /> : <img src={p.mediaUrls[0]} className="w-full h-full object-cover" />}
          </Link>
        ))}
      </div>

      {edit && me && <EditProfileDialog open={edit} onClose={() => setEdit(false)} profile={me} />}
    </div>
  );
}

function EditProfileDialog({ open, onClose, profile }: any) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      let photoURL = profile.photoURL;
      if (photo) photoURL = await uploadFile(`avatars/${profile.uid}-${Date.now()}`, photo);
      await updateDoc(doc(db, "users", profile.uid), { displayName, bio, website, photoURL });
      toast.success("Profile updated");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16"><AvatarImage src={photo ? URL.createObjectURL(photo) : profile.photoURL} /><AvatarFallback>{profile.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <label className="text-sm text-primary cursor-pointer">Change photo<input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
          </div>
          <div className="space-y-1.5"><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          <Button onClick={save} disabled={loading} className="w-full">{loading ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
