import { readinessResponse } from "@/server/health";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return readinessResponse();
}
