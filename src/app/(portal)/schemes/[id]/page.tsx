import { notFound } from "next/navigation";
import { pageActor } from "@/server/auth";
import { listSchemes } from "@/server/queries";
import { SchemeBuilder } from "@/components/scheme-builder";
import { baseConfig } from "@/config/schemes";
export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageActor(["scheme_admin", "ministry_admin"]);
  const { id } = await params;
  if (id === "new")
    return (
      <SchemeBuilder
        isNew
        initial={{
          id: "new",
          code: "NEW",
          name: "New demonstration scholarship",
          description:
            "A configurable scholarship scheme for demonstration purposes.",
          type: "Scholarship",
          active: false,
          award: 50000,
          deadline: "2026-12-31",
          version: 0,
          config: baseConfig,
        }}
      />
    );
  const scheme = (await listSchemes()).find((s) => s.id === id);
  if (!scheme) notFound();
  return <SchemeBuilder initial={scheme} />;
}
