import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/feed" });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const uname = username.toLowerCase().trim();
        if (!/^[a-z0-9_.]{3,20}$/.test(uname)) throw new Error("Username: 3-20 chars, a-z 0-9 _ .");
        const taken = await getDoc(doc(db, "usernames", uname));
        if (taken.exists()) throw new Error("Username already taken");
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: displayName || uname });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          username: uname,
          displayName: displayName || uname,
          email: cred.user.email,
          bio: "",
          photoURL: "",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          role: "user",
          verified: false,
          isPrivate: false,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "usernames", uname), { uid: cred.user.uid });
        toast.success("Welcome to Squareloop!");
      } else if (mode === "signin") {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Signed in");
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        toast.success("Reset email sent");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-primary/90 via-primary to-accent text-primary-foreground overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-background/20 backdrop-blur grid place-items-center font-display text-xl font-bold">S</div>
            <span className="font-display text-2xl font-bold">Squareloop</span>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Share what makes today<br/>worth remembering.
          </h1>
          <p className="text-primary-foreground/80 max-w-md">
            Photos, reels, stories, and real-time chat — in one warm little corner of the internet.
          </p>
        </div>
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-background/10 blur-3xl" />
        <div className="absolute top-20 -left-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-xl font-bold">S</div>
            <span className="font-display text-2xl font-bold">Squareloop</span>
          </div>
          <h2 className="font-display text-3xl font-bold">
            {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "It takes 30 seconds." : mode === "forgot" ? "We'll email you a link." : "Sign in to continue."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jane_doe" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            {mode === "signin" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                  Remember me
                </label>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset email" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></>
            ) : (
              <>New here? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Create an account</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
