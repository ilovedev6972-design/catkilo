import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { uploadFile } from "../lib/upload";
import { createPost } from "../lib/firestore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { X, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/create")({
  ssr: false,
  component: Create,
});

function Create() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list].slice(0, 10));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || files.length === 0) return;
    setLoading(true);
    try {
      const isVideo = files[0].type.startsWith("video/");
      const urls = await Promise.all(
        files.map((f, i) => uploadFile(`posts/${user.uid}/${Date.now()}-${i}-${f.name}`, f)),
      );
      const hashtags = Array.from(caption.matchAll(/#(\w+)/g)).map((m) => m[1].toLowerCase());
      await createPost({
        authorId: user.uid,
        username: profile.username,
        authorPhoto: profile.photoURL ?? "",
        caption,
        mediaUrls: urls,
        mediaType: isVideo ? "video" : "image",
        hashtags,
        location: location || undefined,
      });
      toast.success("Posted!");
      navigate({ to: "/feed" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold mb-6">Create a post</h1>
      <form onSubmit={submit} className="space-y-6">
        {files.length === 0 ? (
          <label className="block border-2 border-dashed border-border rounded-3xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium">Drag photos or videos here</div>
            <div className="text-sm text-muted-foreground">or click to select (up to 10)</div>
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onSelect} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                  {f.type.startsWith("video/") ? (
                    <video src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                  ) : (
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  )}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-2 right-2 bg-background/80 rounded-full p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {files.length < 10 && (
              <label className="block text-sm text-primary cursor-pointer">
                + Add more
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onSelect} />
              </label>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption... use #hashtags" rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" />
        </div>
        <Button type="submit" className="w-full" disabled={loading || files.length === 0}>
          {loading ? "Posting..." : "Share post"}
        </Button>
      </form>
    </div>
  );
}
