import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, type Executor } from "./db";
import { sessions, users, rateLimits } from "@/db/schema";
import type { Actor, Role } from "@/lib/domain";
import { AppError } from "./errors";
export const sessionCookie = "janvidya_session";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const db = await getDb();
  const [record] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      demo: users.demo,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, digest(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  return record ?? null;
}
export async function requireActor(roles?: Role[]) {
  const actor = await getActor();
  if (!actor) throw new AppError("Please sign in to continue.", 401);
  if (roles && !roles.includes(actor.role))
    throw new AppError("Your role cannot perform this action.", 403);
  return actor;
}
export async function pageActor(roles?: Role[]) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect("/unauthorized");
  return actor;
}
export async function newSession(tx: Executor, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await tx.insert(sessions).values({
    tokenHash: digest(token),
    userId,
    expiresAt: new Date(Date.now() + 8 * 3600000),
  });
  return token;
}
export async function setSession(token: string) {
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !!process.env.VERCEL || process.env.APP_URL?.startsWith("https://"),
    maxAge: 8 * 3600,
    path: "/",
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token)
    await (
      await getDb()
    )
      .delete(sessions)
      .where(eq(sessions.tokenHash, digest(token)));
  jar.delete(sessionCookie);
}
export async function rateLimit(key: string, limit = 30, windowMs = 60000) {
  const db = await getDb();
  const hashed = digest(key);
  const now = new Date(),
    resetAt = new Date(Date.now() + windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key: hashed, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN ${resetAt} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning();
  if (row.count > limit)
    throw new AppError(
      "Too many requests. Please wait a minute and try again.",
      429,
    );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const allowed = new Set([requestUrl.origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  // Next's local request URL can use localhost even when the browser uses 127.0.0.1.
  const host = request.headers.get("host");
  if (
    host &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) &&
    ["localhost", "127.0.0.1"].includes(requestUrl.hostname)
  )
    allowed.add(`${requestUrl.protocol}//${host}`);
  if (!origin || !allowed.has(origin))
    throw new AppError("This request origin is not permitted.", 403);
}
