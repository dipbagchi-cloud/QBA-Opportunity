"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, checkAuth, token } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const nextParam = pathname && pathname !== "/login"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";

      if (!token) {
        setIsChecking(false);
        router.replace(`/login${nextParam}`);
        return;
      }

      const valid = await checkAuth();
      setIsChecking(false);

      if (!valid) {
        router.replace(`/login${nextParam}`);
      }
    };

    verify();
  }, [token, checkAuth, router, pathname]);

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
