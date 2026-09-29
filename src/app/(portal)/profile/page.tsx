import { eq } from "drizzle-orm";
import { pageActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { profiles } from "@/db/schema";
import { Profile } from "@/components/profile";
export default async function ProfilePage() {
  const actor = await pageActor();
  const [profile] = await (
    await getDb()
  )
    .select()
    .from(profiles)
    .where(eq(profiles.userId, actor.id));
  return (
    <Profile
      actor={actor}
      initial={profile?.data || { fullName: actor.name, email: actor.email }}
    />
  );
}
