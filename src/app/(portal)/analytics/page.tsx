import { pageActor } from "@/server/auth";
import { analyticsData, listSchemes } from "@/server/queries";
import { Analytics } from "@/components/analytics";
import { statuses } from "@/lib/domain";
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await pageActor(["scheme_admin", "ministry_admin"]);
  const filters = { ...(await searchParams) };
  if (
    filters.status &&
    !statuses.includes(filters.status as (typeof statuses)[number])
  )
    delete filters.status;
  for (const key of ["from", "to"])
    if (filters[key] && !/^\d{4}-\d{2}-\d{2}$/.test(filters[key]))
      delete filters[key];
  const [data, schemes] = await Promise.all([
    analyticsData(filters),
    listSchemes(),
  ]);
  return <Analytics data={data} filters={filters} full schemes={schemes} />;
}
