/**
 * "Save Job" — the badge's bookmark form.
 *
 * Everything the page already shows is PREFILLED (company, title, description,
 * URL) so the common case is one click on Save; the fields stay editable because
 * LinkedIn's own values are often wrong ("TP" for a company, a title with
 * "[Urgent Hiring]" bolted on) and salary is almost never on the page at all.
 *
 * Re-opening a saved job loads what was stored, so pressing Save twice corrects
 * the row rather than duplicating it.
 *
 * Constraints: Shadow DOM, `jf-` prefixed utilities, token colours only. The
 * form is uncontrolled-per-field React state — no form library in this build.
 */
import { useEffect, useState } from "react";
import { sendMessage } from "@/shared/messaging";
import type { JobSource } from "@/shared/types";
import { openLogin } from "./ui";

interface Props {
  externalId: string;
  source: JobSource;
  /** Page values, used as the initial contents of the form. */
  title: string;
  company: string | null;
  getDescription: () => string | null;
  onClose: () => void;
}

type Status =
  | { kind: "editing" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

const LABEL =
  "jf-mb-1 jf-block jf-text-base jf-font-semibold jf-text-content-secondary";
const FIELD =
  "jf-w-full jf-rounded-md jf-border jf-border-border jf-bg-card jf-px-3 jf-py-2 jf-text-base jf-text-content jf-outline-none focus:jf-border-primary-600";

export function SaveJobPanel({
  externalId,
  source,
  title,
  company,
  getDescription,
  onClose,
}: Props) {
  const [form, setForm] = useState({
    title,
    company: company ?? "",
    // Read once, when the form opens — the user is looking at this posting now.
    description: getDescription() ?? "",
    url: window.location.href,
    salary: "",
    notes: "",
  });
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [alreadySaved, setAlreadySaved] = useState(false);

  // Load a previous save so the form shows what the user typed last time instead
  // of quietly replacing it with the page's values.
  useEffect(() => {
    let live = true;
    void sendMessage({ type: "GET_SAVED_JOB", externalId, source }).then((result) => {
      if (!live || result.status !== "ok") return;
      const saved = result.data;
      setAlreadySaved(true);
      setForm((current) => ({
        title: saved.title || current.title,
        company: saved.company ?? current.company,
        description: saved.description ?? current.description,
        url: saved.url ?? current.url,
        salary: saved.salary ?? "",
        notes: saved.notes ?? "",
      }));
    });
    return () => {
      live = false;
    };
  }, [externalId, source]);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Empty optional fields are sent as null — the backend stores absence, not "". */
  const orNull = (value: string): string | null => value.trim() || null;

  async function save(): Promise<void> {
    if (!form.title.trim()) {
      setStatus({ kind: "error", message: "A job title is required." });
      return;
    }
    setStatus({ kind: "saving" });

    const result = await sendMessage({
      type: "SAVE_JOB",
      externalId,
      source,
      title: form.title.trim(),
      company: orNull(form.company),
      description: orNull(form.description),
      url: orNull(form.url),
      salary: orNull(form.salary),
      notes: orNull(form.notes),
    });

    if (result.status === "ok") {
      setStatus({ kind: "saved" });
      // Leave the confirmation up briefly so the click has a visible result.
      window.setTimeout(onClose, 1200);
      return;
    }
    if (result.status === "unauthenticated") {
      setStatus({ kind: "unauthenticated" });
      return;
    }
    setStatus({
      kind: "error",
      message: result.status === "error" ? result.message : "Couldn't save this job.",
    });
  }

  return (
    <div className="jf-mt-2 jf-flex jf-flex-col jf-gap-2.5 jf-rounded-lg jf-border jf-border-border jf-bg-surface jf-p-3">
      <div className="jf-flex jf-items-center jf-justify-between">
        <span className="jf-text-base jf-font-bold jf-text-content">
          {alreadySaved ? "Update saved job" : "Save job"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-2 jf-py-1 jf-text-base jf-text-content-tertiary hover:jf-text-content"
        >
          ✕
        </button>
      </div>

      <div>
        <label className={LABEL}>
          Job title <span className="jf-text-error-600">*</span>
        </label>
        <input
          className={FIELD}
          value={form.title}
          onChange={(e) => update("title")(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL}>Company</label>
        <input
          className={FIELD}
          value={form.company}
          onChange={(e) => update("company")(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL}>
          Job description{" "}
          <span className="jf-font-normal jf-text-content-tertiary">
            ({form.description.length} chars from this page)
          </span>
        </label>
        <textarea
          className={`${FIELD} jf-h-28 jf-resize-y`}
          value={form.description}
          onChange={(e) => update("description")(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL}>Job posting URL</label>
        <input
          className={FIELD}
          value={form.url}
          onChange={(e) => update("url")(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL}>
          Salary{" "}
          <span className="jf-font-normal jf-text-content-tertiary">(optional)</span>
        </label>
        <input
          className={FIELD}
          placeholder="e.g. $70k–90k, negotiable"
          value={form.salary}
          onChange={(e) => update("salary")(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL}>
          Notes <span className="jf-font-normal jf-text-content-tertiary">(optional)</span>
        </label>
        <textarea
          className={`${FIELD} jf-h-20 jf-resize-y`}
          placeholder="Why this one? Who to follow up with?"
          value={form.notes}
          onChange={(e) => update("notes")(e.target.value)}
        />
      </div>

      {status.kind === "unauthenticated" && (
        <div className="jf-flex jf-items-center jf-gap-2">
          <span className="jf-text-base jf-text-content-secondary">
            Log in to JobFit to save.
          </span>
          <button
            type="button"
            onClick={openLogin}
            className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-3 jf-py-1.5 jf-text-sm jf-font-semibold jf-text-on-primary"
          >
            Log in
          </button>
        </div>
      )}
      {status.kind === "error" && (
        <p className="jf-text-base jf-text-error-600">{status.message}</p>
      )}

      <div className="jf-flex jf-items-center jf-justify-end jf-gap-2">
        <button
          type="button"
          onClick={onClose}
          className="jf-rounded-md jf-border-none jf-bg-transparent jf-px-3 jf-py-1.5 jf-text-sm jf-font-medium jf-text-content-secondary jf-transition-all jf-duration-200 hover:jf-bg-surface-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={status.kind === "saving" || status.kind === "saved"}
          className="jf-rounded-md jf-border-none jf-bg-primary-600 jf-px-4 jf-py-1.5 jf-text-sm jf-font-bold jf-text-on-primary jf-shadow-sm jf-transition-all jf-duration-200 hover:jf-bg-primary-700 hover:jf-shadow-md disabled:jf-opacity-60"
        >
          {status.kind === "saving"
            ? "Saving…"
            : status.kind === "saved"
              ? "Saved ✓"
              : "Save"}
        </button>
      </div>
    </div>
  );
}
