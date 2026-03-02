import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOfflineSession, offlineSignOut } from "@/lib/offlineAuth";

type AuthUser = {
  id: string;
  role: "exporter" | "provider" | "admin";
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // 1. Try Supabase session first
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setUser({ id: profile.id, role: profile.role });
          } else {
            const fallbackRole = localStorage.getItem("userRole") as AuthUser["role"] | null;
            setUser({ id: session.user.id, role: fallbackRole || "exporter" });
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Auth: could not reach Supabase –", (err as Error).message);
      }

      // 2. Fall back to offline session
      const offlineUser = getOfflineSession();
      if (offlineUser) {
        setUser({ id: offlineUser.id, role: offlineUser.role });
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      setLoading(true);
      loadUser();
    });

    // Also listen for offline-auth-change (same-tab custom event)
    const onOfflineChange = () => {
      const offlineUser = getOfflineSession();
      if (offlineUser) {
        setUser({ id: offlineUser.id, role: offlineUser.role });
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    window.addEventListener("offline-auth-change", onOfflineChange);
    window.addEventListener("storage", onOfflineChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("offline-auth-change", onOfflineChange);
      window.removeEventListener("storage", onOfflineChange);
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Supabase unreachable – that's fine
    }
    offlineSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
