import { pageActor } from "@/server/auth";
import { demoEnabled } from "@/server/db";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await pageActor();
  return (
    <Shell actor={actor} demo={demoEnabled()}>
      {children}
    </Shell>
  );
}
