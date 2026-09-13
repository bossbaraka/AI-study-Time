"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/lib/query-client";
import { authService } from "@/services/auth.service";
import type { AuthStatus, Session, SessionState } from "@/types/auth";

const UNAUTHENTICATED: SessionState = {
  status: "unauthenticated",
  session: null,
  expired: false,
};

/**
 * Session server-state. TanStack Query owns it — no global store.
 * `gcTime: 0` + `staleTime: 0` ensure a fresh resolution per mount and
 * that no session data lingers in cache after logout clears the client.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => authService.getSessionState(signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
    placeholderData: UNAUTHENTICATED,
  });
}

export interface UseAuthResult {
  status: AuthStatus;
  session: Session | null;
  user: Session["user"] | null;
  isSessionExpired: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/** Convenience view over `useSession` for components and guards. */
export function useAuth(): UseAuthResult {
  const { data, isLoading, isError } = useSession();

  return useMemo<UseAuthResult>(() => {
    const state = data ?? UNAUTHENTICATED;
    // A failed session request means we cannot prove authentication.
    const status: AuthStatus = isLoading
      ? "loading"
      : isError
        ? "unauthenticated"
        : state.status;
    return {
      status,
      session: status === "authenticated" ? state.session : null,
      user: status === "authenticated" && state.session ? state.session.user : null,
      isSessionExpired: state.expired,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
    };
  }, [data, isLoading, isError]);
}

/** Current user only — the narrowest slice components should consume. */
export function useCurrentUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

/**
 * Centralized logout:
 * 1. tells the backend to end the session
 * 2. clears the ENTIRE query cache — no private student data survives
 * 3. leaves the caller to redirect (so navigation stays explicit)
 */
export function useLogout() {
  const queryClient = useQueryClient();

  const clearClientState = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: clearClientState,
    // Even if the network call fails, local state must not retain a session.
    onError: clearClientState,
  });

  return mutation;
}
