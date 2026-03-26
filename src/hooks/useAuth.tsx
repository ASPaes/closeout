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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchUserData(newSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await fetchUserData(initialSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: string) => roles.some((r) => r.role === role);
  const isSuperAdmin = hasRole("super_admin");

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, loading, signOut, hasRole, isSuperAdmin }}>
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
    } as AuthContextType;
  }
  return context;
}
