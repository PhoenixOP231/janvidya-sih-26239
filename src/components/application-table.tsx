"use client";
import { Localize } from "@/components/localize";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "./providers";
import { StatusBadge, Confidence, Empty } from "./ui";
import { dateLabel, type Actor } from "@/lib/domain";
import type { ApplicationList } from "@/server/queries";
export function ApplicationTable({
  list,
  actor,
  compact = false,
  options = {},
}: {
  list: ApplicationList;
  actor: Actor;
  compact?: boolean;
  options?: Record<string, string>;
}) {
  const { t } = useApp();
  const rows = compact ? list.rows.slice(0, 5) : list.rows;
  const url = (page: number) =>
    "/applications?" +
    new URLSearchParams({ ...options, page: String(page) }).toString();
  if (!rows.length)
    return (
      <Localize>
        <Empty
          title={actor.role === "student" ? "No applications yet" : undefined}
          description={
            actor.role === "student"
              ? "Start with a scheme that matches your education goals."
              : undefined
          }
        >
          <Link className="button" href="/schemes">
            {t("Explore schemes")}
          </Link>
        </Empty>
      </Localize>
    );
  return (
    <Localize>
      <>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  {t(actor.role === "student" ? "Application" : "Applicant")}
                </th>
                <th>{t("Scheme")}</th>
                <th>{t("Status")}</th>
                {actor.role !== "student" && <th>{t("Confidence")}</th>}
                <th>{t("Updated")}</th>
                <th>
                  <span className="sr-only">Open application</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => (
                <tr key={app.id}>
                  <td>
                    <Link
                      href={`/applications/${app.id}`}
                      className="applicant"
                    >
                      {actor.role !== "student" && (
                        <span className="avatar">
                          {String(app.data.fullName)
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                      )}
                      <span>
                        <strong>
                          {actor.role === "student"
                            ? app.id
                            : String(app.data.fullName)}
                        </strong>
                        <small>
                          {actor.role === "student" ? app.schemeName : app.id}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 10 }}>
                      {app.code}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  {actor.role !== "student" && (
                    <td>
                      <Confidence value={app.confidence} />
                    </td>
                  )}
                  <td
                    style={{
                      color: "#8597a3",
                      fontSize: 10,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {dateLabel(app.updatedAt)}
                  </td>
                  <td>
                    <Link
                      href={`/applications/${app.id}`}
                      aria-label={`Open ${app.id}`}
                      className="icon-button"
                    >
                      <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            Showing {rows.length} of {list.total} applications
          </span>
          {compact ? (
            <Link href="/applications" className="text-button">
              {t("View all")} <ChevronRight size={13} />
            </Link>
          ) : (
            <div className="pagination">
              {list.page > 1 ? (
                <Link href={url(list.page - 1)} aria-label="Previous page">
                  <ChevronLeft size={16} />
                </Link>
              ) : null}
              <span>
                Page {list.page} of {Math.max(1, Math.ceil(list.total / 12))}
              </span>
              {list.page * 12 < list.total ? (
                <Link href={url(list.page + 1)} aria-label="Next page">
                  <ChevronRight size={16} />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </>
    </Localize>
  );
}
