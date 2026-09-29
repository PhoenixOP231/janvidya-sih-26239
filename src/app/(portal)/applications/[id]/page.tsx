import { notFound } from "next/navigation";
import { pageActor } from "@/server/auth";
import { applicationDetail } from "@/server/queries";
import { demoEnabled } from "@/server/db";
import { AppError } from "@/server/errors";
import { Detail } from "@/components/application-detail";
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor();
  const { id } = await params;
  const detail = await applicationDetail(actor, id).catch((error) => {
    if (
      error instanceof AppError &&
      (error.status === 404 || error.status === 403)
    )
      notFound();
    throw error;
  });
  return <Detail detail={detail} actor={actor} demo={demoEnabled()} />;
}
