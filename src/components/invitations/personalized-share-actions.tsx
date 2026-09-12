"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui";
import {
  issueGuestShareLinkAction,
  type GuestShareActionState,
} from "@/app/[slug]/share-actions";

type ShareStatus = "idle" | "shared" | "copied" | "error";
const initialGuestShareActionState: GuestShareActionState = { ok: false };

async function copyText(value: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard is unavailable");
}

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function deliverShareResult(
  url: string,
  intent: "share" | "copy",
): Promise<ShareStatus> {
  if (intent === "share" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Undangan pernikahan",
        text: "Lihat undangan pernikahan ini.",
        url,
      });
      return "shared";
    } catch (error) {
      if (isShareCancelled(error)) return "idle";
    }
  }

  await copyText(url);
  return "copied";
}

export function PersonalizedShareActions({ invitationId }: { readonly invitationId: string }) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [shareState, shareAction, pending] = useActionState(
    issueGuestShareLinkAction.bind(null, invitationId),
    initialGuestShareActionState,
  );

  useEffect(() => {
    if (!shareState.ok || !shareState.url || !shareState.intent) return;
    void deliverShareResult(shareState.url, shareState.intent)
      .then(setStatus)
      .catch(() => setStatus("error"));
  }, [shareState.intent, shareState.ok, shareState.url]);

  return (
    <section className="personalized-share-actions" aria-labelledby="personalized-share-title">
      <p className="invitation-renderer-kicker">Bagikan undangan</p>
      <h2 id="personalized-share-title">Bagikan ke keluarga</h2>
      <p className="invitation-renderer-muted">Gunakan tombol bagikan atau salin link untuk meneruskan undangan.</p>
      <form action={shareAction} className="personalized-share-action-buttons">
        <Button disabled={pending} name="intent" type="submit" value="share">{pending ? "Menyiapkan link…" : "Bagikan"}</Button>
        <Button disabled={pending} name="intent" type="submit" value="copy" variant="secondary">Salin Link</Button>
      </form>
      {status === "shared" && <p className="personalized-share-status" role="status">Undangan siap dibagikan.</p>}
      {status === "copied" && <p className="personalized-share-status" role="status">Link undangan berhasil disalin.</p>}
      {(status === "error" || (!shareState.ok && shareState.message)) && <p className="personalized-share-status" role="alert">{shareState.message ?? "Link belum disalin. Coba lagi."}</p>}
    </section>
  );
}
