import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

import { captureSentryEvent, toSentryEvent } from "./src/modules/errors";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  captureSentryEvent(
    toSentryEvent(error, {
      operation: `next.${context.routeType}`,
    }),
  );
  await Sentry.flush(2_000);
};
