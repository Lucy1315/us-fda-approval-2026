import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAdmin: false,
  });

  // Check if user is admin
  const checkAdminRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    return !!data;
  }, []);

  // Sign up
  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      return { success: false, error };
    }

    toast.success("회원가입 완료! 로그인해주세요.");
    return { success: true, data };
  }, []);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      return { success: false, error };
    }

    return { success: true, data };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    // 즉시 상태 리셋 (UI 즉각 반영)
    setState({ user: null, session: null, isLoading: false, isAdmin: false });
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return { success: false, error };
    }
    toast.success("로그아웃되었습니다.");
    return { success: true };
  }, []);

  // Bootstrap admin (first user becomes admin)
  const bootstrapAdmin = useCallback(async () => {
    if (!state.user) return false;

    const { error } = await supabase.from("user_roles").insert({
      user_id: state.user.id,
      role: "admin",
    });

    if (error) {
      // Possibly already an admin exists
      if (error.code === "23505" || error.message.includes("duplicate")) {
        toast.info("이미 관리자로 등록되어 있습니다.");
        return true;
      }
      if (error.message.includes("violates row-level security")) {
        toast.error("이미 다른 관리자가 존재합니다.");
        return false;
      }
      console.error("Bootstrap admin error:", error);
      toast.error("관리자 등록 실패");
      return false;
    }

    toast.success("🎉 관리자로 등록되었습니다!");
    setState((prev) => ({ ...prev, isAdmin: true }));
    return true;
  }, [state.user]);

  // Initialize auth listener
  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      let isAdmin = false;

      if (user) {
        isAdmin = await checkAdminRole(user.id);
      }

      setState({
        user,
        session,
        isLoading: false,
        isAdmin,
      });
    });

    // THEN check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      let isAdmin = false;

      if (user) {
        isAdmin = await checkAdminRole(user.id);
      }

      setState({
        user,
        session,
        isLoading: false,
        isAdmin,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    bootstrapAdmin,
  };
}
