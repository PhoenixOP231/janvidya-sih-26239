import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auditHead, auditLogs } from "@/db/schema";
import type { Executor } from "./db";
import type { Actor } from "@/lib/domain";
export type AuditEvent = {
  id: string;
  actorId: string;
  actorName: string;
  role: string;
  action: string;
  entityId: string;
  reason: string;
  previous: unknown;
  next: unknown;
  timestamp: string;
  previousHash: string;
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
}
export function auditHash(event: AuditEvent) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(event)))
    .digest("hex");
}
// Call inside the same transaction as the business write. The singleton row serializes the hash chain.
export async function audit(
  tx: Executor,
  actor: Pick<Actor, "id" | "name" | "role">,
  action: string,
  entityId: string,
  reason: string,
  previous: unknown = null,
  next: unknown = null,
) {
  const [head] = await tx
    .select()
    .from(auditHead)
    .where(eq(auditHead.id, 1))
    .for("update");
  const event: AuditEvent = {
    id: randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    role: actor.role,
    action,
    entityId,
    reason,
    previous,
    next,
    timestamp: new Date().toISOString(),
    previousHash: head?.hash || "GENESIS",
  };
  const hash = auditHash(event);
  await tx.insert(auditLogs).values({ ...event, hash });
  await tx.update(auditHead).set({ hash }).where(eq(auditHead.id, 1));
}
export function verifyAuditChain(rows: (AuditEvent & { hash: string })[]) {
  let previousHash = "GENESIS";
  for (const r of rows) {
    const event: AuditEvent = {
      id: r.id,
      actorId: r.actorId,
      actorName: r.actorName,
      role: r.role,
      action: r.action,
      entityId: r.entityId,
      reason: r.reason,
      previous: r.previous,
      next: r.next,
      timestamp: r.timestamp,
      previousHash: r.previousHash,
    };
    if (r.previousHash !== previousHash || auditHash(event) !== r.hash)
      return false;
    previousHash = r.hash;
  }
  return true;
}
