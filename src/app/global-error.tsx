"use client";

import { useEffect } from "react";

import { captureSanitizedError } from "@/modules/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureSanitizedError(error, { operation: "next.global_error" });
  }, [error]);

  return (
    <html lang="id">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
