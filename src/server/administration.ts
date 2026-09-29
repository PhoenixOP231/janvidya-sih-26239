import { randomUUID } from "node:crypto";
import { and, eq, inArray, desc } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "./db";
import { audit } from "./audit";
import { notify } from "./notifications";
import { AppError } from "./errors";
import type { Actor } from "@/lib/domain";
import { meritScore } from "@/lib/rules";
import { schemeSchema } from "./validation";
export async function saveScheme(actor: Actor, id: string, input: unknown) {
  if (!["scheme_admin", "ministry_admin"].includes(actor.role))
    throw new AppError(
      "Only scheme administrators can configure schemes.",
      403,
    );
  const data = schemeSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select()
      .from(t.schemes)
      .where(eq(t.schemes.id, id))
      .for("update");
    if (old && old.version !== data.version)
      throw new AppError(
        "Scheme was edited elsewhere. Reload before saving.",
        409,
      );
    const version = (old?.version || 0) + 1;
    const newId = old ? id : randomUUID();
    if (old)
      await tx
        .update(t.schemes)
        .set({ ...data, version, updatedAt: new Date() })
        .where(eq(t.schemes.id, id));
    else await tx.insert(t.schemes).values({ ...data, id: newId, version });
    await tx.delete(t.schemeRules).where(eq(t.schemeRules.schemeId, newId));
    await tx.delete(t.requirements).where(eq(t.requirements.schemeId, newId));
    await tx.insert(t.schemeRules).values(
      data.config.rules.map((rule) => ({
        id: randomUUID(),
        schemeId: newId,
        rule,
      })),
    );
    await tx.insert(t.requirements).values(
      data.config.documents.map((requirement) => ({
        id: randomUUID(),
        schemeId: newId,
        requirement,
      })),
    );
    await audit(
      tx,
      actor,
      old ? "Scheme changed" : "Scheme created",
      newId,
      `Configuration version ${version}. Existing applications retain their rule snapshot.`,
      old ? { version: old.version, config: old.config } : null,
      { version, config: data.config },
    );
    return { id: newId, version };
  });
}
export async function generateMerit(actor: Actor, schemeId: string) {
  if (!["scheme_admin", "ministry_admin"].includes(actor.role))
    throw new AppError("Only administrators can generate merit lists.", 403);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [scheme] = await tx
      .select()
      .from(t.schemes)
      .where(eq(t.schemes.id, schemeId));
    if (!scheme) throw new AppError("Scheme not found.", 404);
    const apps = await tx
      .select()
      .from(t.applications)
      .where(
        and(
          eq(t.applications.schemeId, schemeId),
          inArray(t.applications.status, ["approved", "waitlisted"]),
        ),
      );
    if (!apps.length)
      throw new AppError(
        "Approve at least one application before generating a merit list.",
      );
    const ranked = apps
      .map((app) => ({ app, ...meritScore(app.data, scheme.config) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.app.submittedAt?.getTime() || 0) -
            (b.app.submittedAt?.getTime() || 0) ||
          a.app.id.localeCompare(b.app.id),
      );
    const id = randomUUID();
    await tx
      .insert(t.meritLists)
      .values({ id, schemeId, createdBy: actor.id, config: scheme.config });
    const stateCounts: Record<string, number> = {};
    let selected = 0;
    const entries = ranked.map((r, index) => {
      const state = String(r.app.data.state);
      const quota = scheme.config.stateQuotas[state];
      const choose =
        selected < scheme.config.quota &&
        (quota === undefined || (stateCounts[state] || 0) < quota);
      if (choose) {
        selected++;
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      }
      return {
        id: randomUUID(),
        listId: id,
        applicationId: r.app.id,
        rank: index + 1,
        score: r.score,
        reasoning: r.reasoning,
        selected: choose,
      };
    });
    await tx.insert(t.meritEntries).values(entries);
    await audit(
      tx,
      actor,
      "Merit list generated",
      id,
      `${ranked.length} officer-approved candidates; ${selected} proposed selections. Publication requires administrator confirmation.`,
      null,
      { schemeId, quota: scheme.config.quota },
    );
    return { id };
  });
}
export async function publishMerit(actor: Actor, id: string) {
  if (!["scheme_admin", "ministry_admin"].includes(actor.role))
    throw new AppError("Only administrators can publish a merit list.", 403);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [list] = await tx
      .select()
      .from(t.meritLists)
      .where(eq(t.meritLists.id, id))
      .for("update");
    if (!list || list.published)
      throw new AppError("This list is unavailable or already published.", 409);
    const [scheme] = await tx
      .select()
      .from(t.schemes)
      .where(eq(t.schemes.id, list.schemeId));
    const entries = await tx
      .select()
      .from(t.meritEntries)
      .where(eq(t.meritEntries.listId, id));
    for (const entry of entries) {
      const [app] = await tx
        .select()
        .from(t.applications)
        .where(eq(t.applications.id, entry.applicationId))
        .for("update");
      if (!["approved", "waitlisted"].includes(app.status))
        throw new AppError(
          `${app.id} changed since ranking. Regenerate the merit list.`,
          409,
        );
      const status = entry.selected
        ? ("selected" as const)
        : ("waitlisted" as const);
      await tx
        .update(t.applications)
        .set({ status, version: app.version + 1, updatedAt: new Date() })
        .where(eq(t.applications.id, app.id));
      if (entry.selected)
        await tx.insert(t.payments).values({
          id: randomUUID(),
          applicationId: app.id,
          amount: scheme.award,
          status: "scheduled",
          installment: "First installment",
        });
      await audit(
        tx,
        actor,
        "Selection published",
        app.id,
        `Rank ${entry.rank}; score ${entry.score}`,
        { status: app.status },
        { status },
      );
      await notify(
        tx,
        app.userId,
        entry.selected
          ? "You have been selected"
          : "Your application is waitlisted",
        `Your rank is ${entry.rank} in ${scheme.code}. This is a fictional demonstration.`,
        `/applications/${app.id}`,
      );
    }
    await tx
      .update(t.meritLists)
      .set({ published: true })
      .where(eq(t.meritLists.id, id));
    await audit(
      tx,
      actor,
      "Merit list published",
      id,
      "Administrator confirmed the proposed ranking.",
    );
    return { published: true };
  });
}
export async function getMeritLists() {
  const db = await getDb();
  const lists = await db
    .select()
    .from(t.meritLists)
    .orderBy(desc(t.meritLists.createdAt))
    .limit(20);
  const entries = lists.length
    ? await db
        .select({
          entry: t.meritEntries,
          name: t.users.name,
          eligible: t.applications.eligible,
          status: t.applications.status,
        })
        .from(t.meritEntries)
        .innerJoin(
          t.applications,
          eq(t.meritEntries.applicationId, t.applications.id),
        )
        .innerJoin(t.users, eq(t.applications.userId, t.users.id))
        .where(
          inArray(
            t.meritEntries.listId,
            lists.map((l) => l.id),
          ),
        )
        .orderBy(t.meritEntries.rank)
    : [];
  return { lists, entries };
}
