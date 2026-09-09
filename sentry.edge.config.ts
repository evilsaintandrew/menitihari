import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "./src/modules/errors";

Sentry.init(createSentryOptions(process.env.SENTRY_DSN));
