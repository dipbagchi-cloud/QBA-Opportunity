"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);

  useEffect(() => {
    const isChunk =
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("MIME type");

    if (isChunk) {
      setIsChunkError(true);
      // Guard against infinite reload: only auto-reload once per 30 seconds
      const lastReload = sessionStorage.getItem("chunk_error_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem("chunk_error_reload", String(now));
        // Hard reload bypassing cache
        window.location.href = window.location.href;
        return;
      }
    }
  }, [error]);

  if (isChunkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            New Version Available
          </h2>
          <p className="text-gray-600 mb-6">
            The application has been updated. Please reload the page to get the latest version.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem("chunk_error_reload");
              // Force bypass cache: add cache-bust query param
              const url = new URL(window.location.href);
              url.searchParams.set("_cb", String(Date.now()));
              window.location.href = url.toString();
            }}
            className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred. Please try again.
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
