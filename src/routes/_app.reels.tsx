import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { toggleLike } from "../lib/firestore";
import { Heart, MessageCircle, Send, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export const Route = createFileRoute("/_app/reels")({
  ssr: false,
  component: Reels,
});

function Reels() {
  const [reels, setReels] = useState<any[]>([]);
  useEffect(() => {
    const q = query(collection(db, "posts"), where("mediaType", "==", "video"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => setReels(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen overflow-y-scroll snap-y snap-mandatory no-scrollbar">
      {reels.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <div className="font-display text-2xl font-bold text-foreground">No reels yet</div>
          <p className="text-sm mt-1">Upload a video to start the reel feed.</p>
        </div>
      )}
      {reels.map((r) => <Reel key={r.id} reel={r} />)}
    </div>
  );
}

function Reel({ reel }: { reel: any }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.6 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  async function like() {
    if (!user) return;
    await toggleLike(reel.id, user.uid, reel.authorId);
  }

  return (
    <div className="h-full w-full snap-start relative bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={reel.mediaUrls[0]}
        loop
        muted={muted}
        playsInline
        className="h-full max-w-md w-full object-cover"
        onClick={() => setMuted((m) => !m)}
      />
      <button onClick={() => setMuted((m) => !m)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <div className="absolute right-3 bottom-24 flex flex-col gap-5 text-white">
        <button onClick={like} className="flex flex-col items-center"><Heart className="h-7 w-7" /><span className="text-xs mt-1">{reel.likesCount}</span></button>
        <button className="flex flex-col items-center"><MessageCircle className="h-7 w-7" /><span className="text-xs mt-1">{reel.commentsCount}</span></button>
        <button className="flex flex-col items-center"><Send className="h-7 w-7" /></button>
      </div>
      <div className="absolute left-4 right-16 bottom-6 text-white space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9 border border-white"><AvatarImage src={reel.authorPhoto} /><AvatarFallback>{reel.username[0]}</AvatarFallback></Avatar>
          <span className="font-semibold">{reel.username}</span>
        </div>
        <p className="text-sm">{reel.caption}</p>
      </div>
    </div>
  );
}
