const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export type DatabaseReadinessCheck = () => Promise<unknown>;

export function healthResponse(): Response {
  return Response.json(
    { status: "ok" },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function checkDatabaseReadiness(): Promise<void> {
  const { prisma } = await import("./db");
  await prisma.$queryRaw`SELECT 1`;
}

export async function readinessResponse(
  check: DatabaseReadinessCheck = checkDatabaseReadiness,
): Promise<Response> {
  try {
    await check();
  } catch {
    return Response.json(
      { status: "not_ready" },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return Response.json(
    { status: "ready" },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}
