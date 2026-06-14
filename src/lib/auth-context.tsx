import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { onDisconnect, ref, set, serverTimestamp as rtdbServerTime } from "firebase/database";
import { auth, db, rtdb } from "./firebase";

export interface Profile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  website?: string;
  photoURL?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  verified?: boolean;
  role?: "user" | "admin";
  isPrivate?: boolean;
  blocked?: string[];
  closeFriends?: string[];
  createdAt?: any;
}

interface Ctx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthCtx = createContext<Ctx>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as Profile);
      setLoading(false);
    });
    // presence
    const presenceRef = ref(rtdb, `presence/${user.uid}`);
    set(presenceRef, { online: true, lastSeen: rtdbServerTime() });
    onDisconnect(presenceRef).set({ online: false, lastSeen: rtdbServerTime() });
    // touch lastActive
    setDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }, { merge: true }).catch(
      () => {},
    );
    return unsub;
  }, [user]);

  return <AuthCtx.Provider value={{ user, profile, loading }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
