import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthUser = {
  id: string;
  role: "exporter" | "provider" | "admin";
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUser({
          id: profile.id,
          role: profile.role,
        });
      } else {
        // Profile doesn't exist yet – use localStorage role as fallback
        const fallbackRole = localStorage.getItem("userRole") as AuthUser["role"] | null;
        setUser({
          id: session.user.id,
          role: fallbackRole || "exporter",
        });
      }

      setLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      // Mark loading so ProtectedRoute doesn't redirect prematurely
      setLoading(true);
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
