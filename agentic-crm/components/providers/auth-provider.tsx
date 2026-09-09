"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { requestTokenFromOpenTabs, startAuthChannel } from "@/lib/auth-channel";
import { Loader2 } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, checkAuth, token, adoptToken, clearSession } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  // Answer other tabs of this origin that start up without a token, and follow
  // a sign-out performed in any tab. Same-origin only; see lib/auth-channel.
  useEffect(() => {
    return startAuthChannel({
      getToken: () =>
        useAuthStore.getState().token ??
        (typeof window !== "undefined" ? sessionStorage.getItem("auth_token") : null),
      onRemoteLogout: () => {
        clearSession();
        router.replace("/login");
      },
    });
  }, [clearSession, router]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const nextParam = pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";

      if (!token) {
        // A link opened in a NEW TAB starts with an empty sessionStorage. Before
        // sending the user back to the login screen, ask the tabs that are
        // already open for the live session token. Nothing is persisted to disk
        // and the token below is still verified by the backend.
        const handedOver = await requestTokenFromOpenTabs();
        if (cancelled) return;
        if (handedOver) {
          adoptToken(handedOver);
          return; // token change re-runs this effect, which then verifies it
        }

        setIsChecking(false);
        router.replace(`/login${nextParam}`);
        return;
      }

      const valid = await checkAuth();
      if (cancelled) return;
      setIsChecking(false);

      if (!valid) {
        router.replace(`/login${nextParam}`);
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [token, checkAuth, adoptToken, router, pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
