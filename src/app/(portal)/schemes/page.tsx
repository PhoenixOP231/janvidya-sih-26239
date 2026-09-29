import { pageActor } from "@/server/auth";
import { listSchemes } from "@/server/queries";
import { Schemes } from "@/components/schemes";
export default async function SchemePage() {
  const actor = await pageActor();
  return <Schemes actor={actor} schemes={await listSchemes()} />;
}
