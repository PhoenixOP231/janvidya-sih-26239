import { pageActor } from "@/server/auth";
import { getMeritLists } from "@/server/administration";
import { listSchemes } from "@/server/queries";
import { Merit } from "@/components/merit";
export default async function MeritPage() {
  await pageActor(["scheme_admin", "ministry_admin"]);
  const [data, schemes] = await Promise.all([getMeritLists(), listSchemes()]);
  return <Merit data={data} schemes={schemes} />;
}
