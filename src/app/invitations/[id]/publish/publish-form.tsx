"use client";

import { useActionState } from "react";

import type { PublicationState } from "@/generated/prisma/client";
import { Alert, Button } from "@/components/ui";

import {
  initialPublicationActionState,
  publicationAction,
} from "./actions";

interface PublishFormProps {
  readonly invitationId: string;
  readonly publicationState: PublicationState;
  readonly canPublish: boolean;
}

const PUBLISHED: PublicationState = "PUBLISHED";

export function PublishForm({
  invitationId,
  publicationState,
  canPublish,
}: PublishFormProps) {
  const [actionState, formAction, pending] = useActionState(
    publicationAction.bind(null, invitationId),
    initialPublicationActionState,
  );
  const currentState = actionState.publicationState ?? publicationState;
  const isPublished = currentState === PUBLISHED;
  const intent = isPublished ? "unpublish" : "publish";
  const publishDisabled = intent === "publish" && !canPublish;

  return (
    <div className="invitation-publish-actions">
      {actionState.formError && (
        <Alert tone="danger" title="Perubahan belum tersimpan">
          {actionState.formError}
        </Alert>
      )}
      {actionState.ok && actionState.message && (
        <Alert tone="success" title="Status diperbarui">
          {actionState.message}
        </Alert>
      )}
      <form action={formAction}>
        <input type="hidden" name="intent" value={intent} />
        <Button
          type="submit"
          variant={isPublished ? "secondary" : "primary"}
          fullWidth
          disabled={pending || publishDisabled}
          aria-describedby={publishDisabled ? "publish-disabled-hint" : undefined}
        >
          {pending
            ? "Menyimpan..."
            : isPublished
              ? "Sembunyikan dari publik"
              : "Publikasikan"}
        </Button>
      </form>
    </div>
  );
}
