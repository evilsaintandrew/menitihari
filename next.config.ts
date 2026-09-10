import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.NEXT_PUBLIC_APP_URL
    ? [new URL(process.env.NEXT_PUBLIC_APP_URL).hostname]
    : [],
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
