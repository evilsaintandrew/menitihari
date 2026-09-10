import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const localNetworkOrigins = [
  "localhost",
  "127.0.0.1",
  "192.168.*.*",
  "10.*.*.*",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: localNetworkOrigins,
    },
    useTypeScriptCli: false,
  },
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
