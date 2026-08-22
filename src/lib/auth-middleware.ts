import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, and, gt } from "drizzle-orm";

const SESSION_COOKIE = "sid";

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getDb } = await import("@/lib/db");
    const { sessions } = await import("@/lib/db/schema");

    const req = getRequest();
    const cookieHeader = req?.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    const sessionId = match?.[1];

    if (!sessionId) throw new Error("Unauthorized");

    const now = new Date();
    const [row] = await getDb()
      .select({ userId: sessions.user_id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expires_at, now)))
      .limit(1);

    if (!row) throw new Error("Session expired");

    return next({ context: { userId: String(row.userId) } });
  }
);

export const requireAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getDb } = await import("@/lib/db");
    const { sessions, users } = await import("@/lib/db/schema");

    const req = getRequest();
    const cookieHeader = req?.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    const sessionId = match?.[1];

    if (!sessionId) throw new Error("Unauthorized");

    const now = new Date();
    const [row] = await getDb()
      .select({ userId: sessions.user_id, role: users.role })
      .from(sessions)
      .innerJoin(users, eq(sessions.user_id, users.id))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expires_at, now)))
      .limit(1);

    if (!row) throw new Error("Session expired");
    if (row.role !== "admin") throw new Error("Forbidden: admin only");

    return next({ context: { userId: String(row.userId) } });
  }
);
