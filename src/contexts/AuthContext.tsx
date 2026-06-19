import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed?: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** True until the profile row has been fetched at least once for the signed-in user. */
  profileLoading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ data: unknown; error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ data?: unknown; error: unknown }>;
  /** Re-fetch the profile row (e.g. after onboarding completes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data && !error) {
        setProfile(data as Profile);
      }
    } finally {
      // Resolve the gate regardless of success so a failed fetch doesn't trap
      // the user on a loading screen.
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setProfileLoading(true);
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) return { error: new Error("Not authenticated") };
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();
      if (data && !error) {
        setProfile(data as Profile);
      }
      return { data, error };
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
