import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  Home, Compass, Film, MessageCircle, Bell, PlusSquare, User, Settings, Moon, Sun, LogOut, Search, Shield,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const nav = [
    { to: "/feed", label: "Feed", icon: Home },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/reels", label: "Reels", icon: Film },
    { to: "/create", label: "Create", icon: PlusSquare },
    { to: "/messages", label: "Messages", icon: MessageCircle },
    { to: "/notifications", label: "Activity", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 border-r border-border bg-sidebar text-sidebar-foreground flex-col p-4 z-30">
        <Link to="/feed" className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-lg font-bold">S</div>
          <span className="font-display text-xl font-bold">Squareloop</span>
        </Link>
        <nav className="mt-6 space-y-1 flex-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent",
                )}
              >
                <Icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
          <Link
            to="/profile/$username"
            params={{ username: profile?.username ?? "me" }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-accent",
              pathname.startsWith("/profile") && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <User className="h-5 w-5" /> Profile
          </Link>
          {profile?.role === "admin" && (
            <Link to="/admin" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-accent", pathname.startsWith("/admin") && "bg-primary text-primary-foreground hover:bg-primary")}>
              <Shield className="h-5 w-5" /> Admin
            </Link>
          )}
        </nav>
        <div className="space-y-1 pt-4 border-t border-sidebar-border">
          <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-accent">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />} {theme === "dark" ? "Light" : "Dark"} mode
          </button>
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-accent">
            <Settings className="h-5 w-5" /> Settings
          </Link>
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-accent text-destructive">
            <LogOut className="h-5 w-5" /> Sign out
          </button>
          <Link to="/profile/$username" params={{ username: profile?.username ?? "" }} className="flex items-center gap-2 px-2 py-2 mt-2 rounded-xl hover:bg-sidebar-accent">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.photoURL} />
              <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-sm min-w-0">
              <div className="font-medium truncate">{profile?.displayName}</div>
              <div className="text-xs text-muted-foreground truncate">@{profile?.username}</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur border-b border-border">
        <Link to="/feed" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-bold">S</div>
          <span className="font-display text-lg font-bold">Squareloop</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/explore" className="p-2 rounded-lg hover:bg-accent"><Search className="h-5 w-5" /></Link>
          <Link to="/notifications" className="p-2 rounded-lg hover:bg-accent"><Bell className="h-5 w-5" /></Link>
          <Link to="/messages" className="p-2 rounded-lg hover:bg-accent"><MessageCircle className="h-5 w-5" /></Link>
        </div>
      </header>

      <main className="md:pl-64 pb-20 md:pb-0 min-h-screen">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around h-16">
        {nav.slice(0, 5).map((n) => {
          const Icon = n.icon;
          const active = pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={cn("flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg", active ? "text-primary" : "text-foreground")}>
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
        <Link to="/profile/$username" params={{ username: profile?.username ?? "" }} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5">
          <Avatar className={cn("h-6 w-6", pathname.startsWith("/profile") && "ring-2 ring-primary")}>
            <AvatarImage src={profile?.photoURL} />
            <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
      </nav>
    </div>
  );
}
