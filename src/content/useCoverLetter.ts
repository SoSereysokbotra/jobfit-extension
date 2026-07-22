import { useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobSource } from "@/shared/types";

/** Identifiers sent for generation — never the job description. */
export interface JobContext {
  externalId: string;
  source: JobSource;
  company: string | null;
  role: string | null;
}

export type GenerateStatus = "idle" | "loading" | "done";

/**
 * Shared cover-letter generation state, used by BOTH entry points:
 *  - the badge panel (always available, copy to clipboard)
 *  - the Easy Apply injection (writes straight into LinkedIn's textarea)
 */
export function useCoverLetter(ctx: JobContext) {
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [letter, setLetter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function generate(onSuccess?: (text: string) => void) {
    setStatus("loading");
    setError(null);
    setNeedsLogin(false);
    try {
      const result = await sendMessage({ type: "GENERATE_COVER_LETTER", ...ctx });
      if (result.status === "ok") {
        setLetter(result.data.text);
        setStatus("done");
        onSuccess?.(result.data.text);
        return;
      }
      if (result.status === "unauthenticated") setNeedsLogin(true);
      else if (result.status === "empty")
        setError("Couldn't generate a letter. Add a résumé to your JobFit profile first.");
      else setError(result.message);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setStatus("idle");
    }
  }

  return { status, letter, error, needsLogin, generate };
}
