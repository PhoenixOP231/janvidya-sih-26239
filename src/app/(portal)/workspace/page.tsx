import { pageActor } from "@/server/auth";
import { analyticsData, dashboardData, listSchemes } from "@/server/queries";
import { Analytics } from "@/components/analytics";
import { Dashboard } from "@/components/dashboard";
export default async function Workspace() {
  const actor = await pageActor();
  if (actor.role === "ministry_admin" || actor.role === "scheme_admin") {
    const [data, schemes] = await Promise.all([
      analyticsData({}),
      listSchemes(),
    ]);
    return <Analytics data={data} schemes={schemes} />;
  }
  return <Dashboard actor={actor} data={await dashboardData(actor)} />;
}
