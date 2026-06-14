import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { updatePassword, signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  ssr: false,
  component: Settings,
});

function Settings() {
  const { profile } = useAuth();
  const { theme, toggle } = useTheme();
  const [newPass, setNewPass] = useState("");
  const [priv, setPriv] = useState(profile?.isPrivate ?? false);

  async function changePass() {
    if (!auth.currentUser || newPass.length < 6) return;
    try { await updatePassword(auth.currentUser, newPass); toast.success("Password updated"); setNewPass(""); }
    catch (e: any) { toast.error(e.message); }
  }

  async function togglePrivacy(v: boolean) {
    if (!profile) return;
    setPriv(v);
    await updateDoc(doc(db, "users", profile.uid), { isPrivate: v });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Card className="p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Appearance</h2>
        <div className="flex items-center justify-between">
          <Label>Dark mode</Label>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Privacy</h2>
        <div className="flex items-center justify-between">
          <div><Label>Private account</Label><p className="text-xs text-muted-foreground">Only approved followers see your posts (UI only).</p></div>
          <Switch checked={priv} onCheckedChange={togglePrivacy} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Account</h2>
        <div className="space-y-2">
          <Label>New password</Label>
          <div className="flex gap-2">
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="At least 6 characters" />
            <Button onClick={changePass} disabled={newPass.length < 6}>Update</Button>
          </div>
        </div>
        <Button variant="destructive" onClick={() => signOut(auth)}>Sign out</Button>
      </Card>
    </div>
  );
}
