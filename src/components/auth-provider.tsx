"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, type Access } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** What this account may do (null until register_login answers, or if it failed: see accessError) */
  access: Access | null;
  /** True while a signed-in user's access is being looked up */
  accessLoading: boolean;
  accessError: string | null;
  refreshAccess: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  access: null,
  accessLoading: false,
  accessError: null,
  refreshAccess: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Registers the account (as 'pending' if it is new) and reads its status and role from the database
  const refreshAccess = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    const { data, error } = await supabase.rpc("register_login", {
      p_full_name: current.user_metadata?.full_name ?? null,
      p_avatar_url: current.user_metadata?.avatar_url ?? null,
    });
    if (userRef.current?.id !== current.id) return; // signed out or switched account meanwhile
    if (error || !data) {
      setAccess(null);
      setAccessError(error?.message ?? "No se pudo verificar tu acceso.");
      return;
    }
    setAccess(data as Access);
    setAccessError(null);
  }, []);

  // Only when the account changes (not on every token refresh)
  const userId = user?.id ?? null;
  useEffect(() => {
    setAccess(null);
    setAccessError(null);
    if (userId) void refreshAccess();
  }, [userId, refreshAccess]);

  const accessLoading = user !== null && access === null && accessError === null;

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, access, accessLoading, accessError, refreshAccess, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
