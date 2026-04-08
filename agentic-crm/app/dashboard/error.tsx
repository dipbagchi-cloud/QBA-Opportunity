"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-reload on ChunkLoadError (happens after new deployments)
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module")
    ) {
      window.location.reload();
      return;
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Dashboard Error
        </h2>
        <p className="text-gray-600 mb-6">
          {error.message?.includes("Loading chunk")
            ? "A new version is available. Reloading..."
            : "Something went wrong loading this page."}
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors mr-3"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
