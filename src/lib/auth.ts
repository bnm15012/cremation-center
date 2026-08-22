import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { assertAmcActive } from "@/lib/records.functions";

const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

async function createSession(userId: number) {
  const { getDb } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");

  const id = randomHex(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getDb().insert(sessions).values({
    id,
    user_id: userId,
    expires_at: expires,
    created_at: now,
  });

  return { id, expires };
}

function setSessionCookie(sessionId: string, expires: Date) {
  setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

// ── getSession ────────────────────────────────────────────────────────────────
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getDb } = await import("@/lib/db");
  const { sessions, users } = await import("@/lib/db/schema");

  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)
  );
  const sessionId = match?.[1];
  if (!sessionId) return null;

  const now = new Date();

  const [row] = await getDb()
    .select({
      userId: sessions.user_id,
      expires: sessions.expires_at,
      email: users.email,
      fullName: users.full_name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expires_at, now)))
    .limit(1);

  if (!row) return null;

  return {
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
  };
});

// ── login ─────────────────────────────────────────────────────────────────────
export const login = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");

    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase().trim()))
      .limit(1);

    if (!user) throw new Error("Invalid email or password");
    if (!user.is_active) throw new Error("Account is disabled");

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) throw new Error("Invalid email or password");

    const { id, expires } = await createSession(user.id);
    setSessionCookie(id, expires);

    return {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
  });

// ── logout ────────────────────────────────────────────────────────────────────
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { getDb } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");

  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)
  );
  const sessionId = match?.[1];

  if (sessionId) {
    await getDb().delete(sessions).where(eq(sessions.id, sessionId));
  }

  deleteCookie(SESSION_COOKIE);
  return { success: true };
});

// ── changePassword ────────────────────────────────────────────────────────────
export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { newPassword: string }) => d)
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const db = getDb();
    const userId = Number(context.userId);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    if (data.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    const hash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
    await db
      .update(users)
      .set({ password_hash: hash, updated_at: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  });

// ── inviteUser — admin creates invite, sends email link ───────────────────────
export const inviteUser = createServerFn({ method: "POST" })
  .validator(
    (d: { email: string; fullName: string; role: "admin" | "staff"; invitedByUserId: number }) => d
  )
  .handler(async ({ data }) => {
    await assertAmcActive();

    const { getDb } = await import("@/lib/db");
    const { users, invite_tokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { sendInviteEmail } = await import("@/lib/email");

    const db = getDb();
    const email = data.email.toLowerCase().trim();
    const now = new Date();

    // Check if email already registered
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) throw new Error("A user with this email already exists.");

    // Generate a secure random token (48 hex chars = 24 bytes)
    const token = randomHex(24);
    const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    await db.insert(invite_tokens).values({
      token,
      email,
      full_name: data.fullName,
      role: data.role,
      used: false,
      expires_at: expires,
      created_by: data.invitedByUserId,
      created_at: now,
    });

    await sendInviteEmail(email, data.fullName, data.role, token);

    return { success: true };
  });

// ── acceptInvite — user sets password via invite link ────────────────────────
export const getInviteByToken = createServerFn({ method: "GET" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { invite_tokens } = await import("@/lib/db/schema");
    const { eq, and, gt } = await import("drizzle-orm");

    const now = new Date();
    const [invite] = await getDb()
      .select()
      .from(invite_tokens)
      .where(
        and(
          eq(invite_tokens.token, data.token),
          eq(invite_tokens.used, false),
          gt(invite_tokens.expires_at, now)
        )
      )
      .limit(1);

    if (!invite) return null;
    return { email: invite.email, fullName: invite.full_name, role: invite.role };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .validator((d: { token: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, invite_tokens, sessions } = await import("@/lib/db/schema");
    const { eq, and, gt } = await import("drizzle-orm");

    const db = getDb();
    const now = new Date();

    // Validate token
    const [invite] = await db
      .select()
      .from(invite_tokens)
      .where(
        and(
          eq(invite_tokens.token, data.token),
          eq(invite_tokens.used, false),
          gt(invite_tokens.expires_at, now)
        )
      )
      .limit(1);

    if (!invite) throw new Error("Invite link is invalid or has expired.");

    const email = invite.email.toLowerCase().trim();

    // Check not already registered
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) throw new Error("An account with this email already exists.");

    if (data.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Create user
    const [result] = await db.insert(users).values({
      email,
      password_hash: hash,
      full_name: invite.full_name,
      role: invite.role,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    const userId = Number((result as any).insertId);

    // Mark token used
    await db
      .update(invite_tokens)
      .set({ used: true })
      .where(eq(invite_tokens.token, data.token));

    // Auto-login: create session
    const sessionId = randomHex(32);
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: sessionId,
      user_id: userId,
      expires_at: expires,
      created_at: now,
    });

    setSessionCookie(sessionId, expires);

    return { email, fullName: invite.full_name, role: invite.role };
  });

// ── requestPasswordReset — send 6-digit OTP to email ──────────────────────────
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, password_reset_tokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { sendPasswordResetEmail } = await import("@/lib/email");

    const db = getDb();
    const email = data.email.toLowerCase().trim();
    const now = new Date();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists
      return { success: true };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    await db.insert(password_reset_tokens).values({
      email,
      otp,
      used: false,
      expires_at: expires,
      created_at: now,
    });

    try {
      await sendPasswordResetEmail(email, otp);
    } catch {
      // Ignore email errors in dev if SMTP not configured
    }

    return { success: true };
  });

// ── resetPassword — verify OTP and update password ────────────────────────────
export const resetPassword = createServerFn({ method: "POST" })
  .validator((d: { email: string; otp: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, password_reset_tokens } = await import("@/lib/db/schema");
    const { eq, and, gt } = await import("drizzle-orm");

    const db = getDb();
    const email = data.email.toLowerCase().trim();
    const now = new Date();

    if (data.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const [token] = await db
      .select()
      .from(password_reset_tokens)
      .where(
        and(
          eq(password_reset_tokens.email, email),
          eq(password_reset_tokens.otp, data.otp.trim()),
          eq(password_reset_tokens.used, false),
          gt(password_reset_tokens.expires_at, now)
        )
      )
      .orderBy(desc(password_reset_tokens.created_at))
      .limit(1);

    if (!token) throw new Error("Invalid or expired reset code");

    const hash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ password_hash: hash, updated_at: now })
        .where(eq(users.email, email));

      await tx
        .update(password_reset_tokens)
        .set({ used: true })
        .where(eq(password_reset_tokens.id, token.id));
    });

    return { success: true };
  });
