import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { pageActor } from "@/server/auth";
import { listApplications, listSchemes } from "@/server/queries";
import { PageTitle, Panel, Text } from "@/components/ui";
import { ApplicationTable } from "@/components/application-table";
import { statusLabels, statuses } from "@/lib/domain";
export default async function Applications({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageActor();
  const options = { ...(await searchParams) };
  if (
    options.status &&
    !statuses.includes(options.status as (typeof statuses)[number])
  )
    delete options.status;
  const [list, schemes] = await Promise.all([
    listApplications(actor, options),
    listSchemes(),
  ]);
  return (
    <>
      <PageTitle
        eyebrow={
          actor.role === "student" ? "Student portal" : "Review workspace"
        }
        title={actor.role === "student" ? "My applications" : "Applications"}
        description={
          actor.role === "student"
            ? "Every opportunity. Every step. In one place."
            : "Review the evidence, resolve exceptions, and keep applications moving."
        }
        actions={
          actor.role === "student" ? (
            <Link href="/schemes" className="button">
              <Plus size={15} />
              <Text>New application</Text>
            </Link>
          ) : undefined
        }
      />
      {actor.role !== "student" && (
        <div className="filter-chips">
          {[
            ["", "All applications"],
            ["flagged", "Flagged"],
            ["clear", "AI-cleared"],
            ["low", "Low confidence"],
            ["duplicate", "Potential duplicates"],
          ].map(([flag, label]) => (
            <Link
              key={flag}
              href={
                "/applications?" +
                new URLSearchParams({ ...options, flag, page: "1" })
              }
              className={`filter-chip ${(options.flag || "") === flag ? "active" : ""}`}
            >
              {label}
            </Link>
          ))}
          <Link href="/applications?q=JV-2026-000" className="filter-chip">
            Demo cases
          </Link>
        </div>
      )}
      <form className="filter-bar" action="/applications">
        <input
          type="search"
          name="q"
          placeholder="Search by name or application ID"
          aria-label="Search applications"
          defaultValue={options.q}
        />
        <select
          name="scheme"
          aria-label="Filter by scheme"
          defaultValue={options.scheme || ""}
        >
          <option value="">All schemes</option>
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={options.status || ""}
        >
          <option value="">All statuses</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input type="hidden" name="flag" value={options.flag || ""} />
        <button className="button secondary" type="submit">
          <Search size={14} />
          <Text>Search</Text>
        </button>
      </form>
      <Panel>
        <ApplicationTable list={list} actor={actor} options={options} />
      </Panel>
    </>
  );
}
