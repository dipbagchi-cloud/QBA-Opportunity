"use client";

import { ShieldAlert } from "lucide-react";

export function AccessDenied({
  title = "Access Restricted",
  description = "Your current role does not have access to this screen.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
