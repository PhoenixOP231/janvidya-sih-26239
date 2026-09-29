import { desc, eq } from "drizzle-orm";
import { pageActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { notifications } from "@/db/schema";
import { Notifications } from "@/components/notifications";
export default async function NotificationsPage() {
  const actor = await pageActor();
  const rows = await (
    await getDb()
  )
    .select()
    .from(notifications)
    .where(eq(notifications.userId, actor.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return <Notifications rows={rows} />;
}
