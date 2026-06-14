import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  collection, onSnapshot, query, orderBy, limit, where, getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Plus } from "lucide-react";
import { uploadFile } from "../lib/upload";
import { addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

interface Story {
  id: string;
  userId: string;
  username: string;
  photoURL?: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  createdAt: any;
  expiresAt: any;
}

export function StoriesBar() {
  const { user, profile } = useAuth();
  const [grouped, setGrouped] = useState<Record<string, Story[]>>({});
  const [viewerUser, setViewerUser] = useState<string | null>(null);

  useEffect(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const q = query(collection(db, "stories"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, Story[]> = {};
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...d.data() } as Story;
        const ms = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
        if (ms > cutoff) (map[data.userId] = map[data.userId] || []).push(data);
      });
      setGrouped(map);
    });
    return unsub;
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !profile) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(`stories/${user.uid}/${Date.now()}-${file.name}`, file);
      await addDoc(collection(db, "stories"), {
        userId: user.uid,
        username: profile.username,
        photoURL: profile.photoURL ?? "",
        mediaUrl: url,
        mediaType: file.type.startsWith("video/") ? "video" : "image",
        createdAt: serverTimestamp(),
      });
      toast.success("Story posted");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const entries = Object.entries(grouped);

  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 px-1">
      <label className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.photoURL} />
            <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background">
            <Plus className="h-3.5 w-3.5" />
          </div>
        </div>
        <span className="text-xs">Your story</span>
        <input type="file" accept="image/*,video/*" className="hidden" onChange={onUpload} />
      </label>
      {entries.map(([uid, stories]) => (
        <button key={uid} onClick={() => setViewerUser(uid)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="story-ring">
            <Avatar className="h-16 w-16 border-2 border-background">
              <AvatarImage src={stories[0].photoURL} />
              <AvatarFallback>{stories[0].username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs max-w-[64px] truncate">{stories[0].username}</span>
        </button>
      ))}

      <Dialog open={!!viewerUser} onOpenChange={(o) => !o && setViewerUser(null)}>
        <DialogContent className="max-w-md p-0 bg-black border-0">
          {viewerUser && <StoryViewer stories={grouped[viewerUser] || []} onClose={() => setViewerUser(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoryViewer({ stories, onClose }: { stories: Story[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      if (i < stories.length - 1) setI(i + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(t);
  }, [i, stories.length, onClose]);
  const s = stories[i];
  if (!s) return null;
  return (
    <div className="relative aspect-[9/16] w-full">
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {stories.map((_, idx) => (
          <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div className={idx < i ? "h-full w-full bg-white" : idx === i ? "h-full bg-white animate-[progress_5s_linear]" : ""} style={idx === i ? { animation: "progress 5s linear forwards" } : {}} />
          </div>
        ))}
      </div>
      <div className="absolute top-4 left-3 right-3 z-10 flex items-center gap-2 pt-3">
        <Avatar className="h-8 w-8"><AvatarImage src={s.photoURL} /><AvatarFallback>{s.username[0]}</AvatarFallback></Avatar>
        <span className="text-white text-sm font-semibold">{s.username}</span>
      </div>
      {s.mediaType === "video" ? (
        <video src={s.mediaUrl} autoPlay muted className="w-full h-full object-contain" />
      ) : (
        <img src={s.mediaUrl} alt="" className="w-full h-full object-contain" />
      )}
      <button className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI(Math.max(0, i - 1))} />
      <button className="absolute inset-y-0 right-0 w-1/3" onClick={() => i < stories.length - 1 ? setI(i + 1) : onClose()} />
      <style>{`@keyframes progress { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
