import { healthResponse } from "@/server/health";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return healthResponse();
}
