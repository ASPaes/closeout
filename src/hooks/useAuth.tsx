import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { LanguageContext } from "@/i18n/language-provider";

type UserRole = {
  id: string;
  role: "super_admin" | "client_admin" | "client_manager" | "venue_manager" | "event_manager" | "event_organizer" | "staff" | "bar_staff" | "waiter" | "cashier" | "consumer";
  client_id: string | null;
  venue_id: string | null;
  event_id: string | null;
};

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
  status: string;
  language: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isSuperAdmin: boolean;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { setLanguage } = useContext(LanguageContext);

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("id, role, client_id, venue_id, event_id").eq("user_id", userId),
    ]);
    if (profileRes.data) {
      const p = profileRes.data as Profile;
      setProfile(p);
      // Force pt-BR only
      setLanguage("pt-BR");
    }
    if (rolesRes.data) setRoles(rolesRes.data as UserRole[]);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock with async callbacks
          setTimeout(() => {
            if (!mounted) return;
            fetchUserData(newSession.user.id).finally(() => {
              if (mounted) setLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await fetchUserData(initialSession.user.id);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("id, role, client_id, venue_id, event_id")
      .eq("user_id", user.id);
    if (data) setRoles(data as UserRole[]);
  };

  const hasRole = (role: string) => roles.some((r) => r.role === role);
  const isSuperAdmin = hasRole("super_admin");

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, loading, signOut, hasRole, isSuperAdmin, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During HMR or edge cases, return a safe loading state instead of crashing
    return {
      session: null,
      user: null,
      profile: null,
      roles: [],
      loading: true,
      signOut: async () => {},
      hasRole: () => false,
      isSuperAdmin: false,
      refreshRoles: async () => {},
    } as AuthContextType;
  }
  return context;
}
