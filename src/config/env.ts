import { parseEnv } from "./env-schema";

export { parseEnv } from "./env-schema";
export type { AppEnv, RawEnv } from "./env-schema";

// Importing this module from a server entry point makes configuration errors
// fail before the application can serve a request.
export const env = parseEnv(process.env);
