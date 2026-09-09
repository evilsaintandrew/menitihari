import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "prisma", "generate"], {
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/menitihari",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
