"use client";
import { Localize } from "@/components/localize";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Files,
  CheckCheck,
  Clock3,
  IndianRupee,
  ArrowUpRight,
  MapPin,
  Filter,
  ShieldCheck,
} from "lucide-react";
import type { AnalyticsData } from "@/server/queries";
import { money, statusLabels, type Status } from "@/lib/domain";
import { PageTitle, Metric, Panel, Empty } from "./ui";
import { TrendChart, DonutChart, RankBars } from "./charts";
export function Analytics({
  data,
  filters = {},
  full = false,
  schemes,
}: {
  data: AnalyticsData;
  filters?: Record<string, string>;
  full?: boolean;
  schemes: { id: string; code: string }[];
}) {
  const router = useRouter();
  const { summary } = data;
  const disbursed =
    data.payments.find((p) => p.name === "disbursed")?.value || 0;
  const approvalRate = summary.total
    ? Math.round((summary.approved / summary.total) * 100)
    : 0;
  const grouped = [
    { name: "Approved", value: summary.approved },
    { name: "Action needed", value: summary.deficient },
    { name: "Rejected", value: summary.rejected },
    {
      name: "In progress",
      value:
        summary.total - summary.approved - summary.deficient - summary.rejected,
    },
  ].filter((d) => d.value);
  const options = (field: "state" | "district" | "institution") =>
    Array.from(new Set(data.options.map((o) => o[field]))).sort();
  function exportCsv() {
    const sections = [
      ["Metric", "Value"],
      ["Total applications", summary.total],
      ["Approval rate", `${approvalRate}%`],
      ["Average processing days", summary.avgDays.toFixed(1)],
      ["Pending over 14 days", summary.pending],
      ...data.byState.map((r) => [`State: ${r.name}`, r.value]),
      ...data.byDistrict.map((r) => [`District: ${r.name}`, r.value]),
      ...data.byGender.map((r) => [`Gender: ${r.name}`, r.value]),
      ...data.payments.map((r) => [`Payment: ${r.name}`, r.value]),
    ];
    const csv = sections
      .map((row) =>
        row
          .map(
            (v) =>
              `"${String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "janvidya-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Ministry workspace"
          title={
            full
              ? "The bigger picture. In detail."
              : "Opportunity, in perspective."
          }
          description="A connected view of scholarship reach, application progress, and the work ahead."
          actions={
            <>
              <Link href="/analytics" className="button secondary">
                <Filter size={14} /> {full ? "Clear filters" : "Filter data"}
              </Link>
              <button className="button" onClick={exportCsv}>
                <Download size={14} />
                Export report
              </button>
            </>
          }
        />
        {full && (
          <form className="panel analytics-filters" action="/analytics">
            <div className="filter-bar">
              <label>
                Scheme
                <select name="scheme" defaultValue={filters.scheme || ""}>
                  <option value="">All schemes</option>
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                State
                <select name="state" defaultValue={filters.state || ""}>
                  <option value="">All states</option>
                  {options("state").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                District
                <select name="district" defaultValue={filters.district || ""}>
                  <option value="">All districts</option>
                  {options("district").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Gender
                <select name="gender" defaultValue={filters.gender || ""}>
                  <option value="">All genders</option>
                  {["Female", "Male", "Other", "Prefer not to say"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Institution
                <select
                  name="institution"
                  defaultValue={filters.institution || ""}
                >
                  <option value="">All institutions</option>
                  {options("institution").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={filters.status || ""}>
                  <option value="">All statuses</option>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Financial year
                <select name="year" defaultValue={filters.year || ""}>
                  <option value="">All years</option>
                  <option value="2026">2026–27</option>
                  <option value="2025">2025–26</option>
                </select>
              </label>
              <label>
                From
                <input name="from" type="date" defaultValue={filters.from} />
              </label>
              <label>
                To
                <input name="to" type="date" defaultValue={filters.to} />
              </label>
              <button
                className="button small"
                type="submit"
                style={{ alignSelf: "end" }}
              >
                Apply filters
              </button>
            </div>
          </form>
        )}
        <div className="metric-grid">
          <Metric
            label="Total applications"
            value={summary.total.toLocaleString("en-IN")}
            detail={`Across ${data.byState.length} states · fictional data`}
            icon={<Files />}
          />
          <Metric
            label="Approval rate"
            value={`${approvalRate}%`}
            detail={`${summary.approved} applications approved`}
            icon={<CheckCheck />}
            trend
          />
          <Metric
            label="Average processing"
            value={`${summary.avgDays.toFixed(1)} days`}
            detail="Submission to officer decision"
            icon={<Clock3 />}
          />
          <Metric
            label="Total disbursed"
            value={money(disbursed)}
            detail="Recorded demo installments"
            icon={<IndianRupee />}
            trend
          />
        </div>
        <div className="dashboard-grid">
          <Panel
            title="Applications over time"
            subtitle="Application submissions across the selected period"
            action={<span className="badge">2026–27</span>}
          >
            <TrendChart
              data={data.byMonth.map((d) => ({
                ...d,
                name: new Date(d.name + "-01").toLocaleDateString("en-IN", {
                  month: "short",
                  timeZone: "UTC",
                }),
              }))}
            />
            <div className="chart-legend">
              <span>
                <i className="legend-dot" style={{ background: "#278e79" }} />
                Applications received
              </span>
              <span>Fictional demonstration dataset</span>
            </div>
          </Panel>
          <Panel
            title="Application status"
            subtitle="Each application counted once"
          >
            <DonutChart data={grouped} total={summary.total} />
          </Panel>
        </div>
        <div className="dashboard-grid">
          <Panel
            title="Scholarship reach by state"
            subtitle="Select a state to explore its applications"
            action={<MapPin size={16} color="#809994" />}
          >
            {data.byState.length ? (
              <RankBars
                data={data.byState.slice(0, 8)}
                onSelect={(state) =>
                  router.push(
                    "/analytics?" + new URLSearchParams({ ...filters, state }),
                  )
                }
              />
            ) : (
              <Empty />
            )}
          </Panel>
          <Panel
            title="Where attention is needed"
            subtitle="Practical signals for the next review"
          >
            <div className="panel-body" style={{ paddingTop: 5 }}>
              <Link
                href="/applications?status=ready_for_review"
                className="notification-mini"
              >
                <span>
                  <Clock3 size={15} />
                </span>
                <div>
                  <strong>
                    {summary.pending} applications pending over 14 days
                  </strong>
                  <p>Age is calculated from each submission date.</p>
                </div>
                <ArrowUpRight size={14} color="#99aaa7" />
              </Link>
              <Link
                href="/applications?status=deficiency_raised"
                className="notification-mini"
              >
                <span>
                  <Files size={15} />
                </span>
                <div>
                  <strong>
                    {summary.deficient} applications need a response
                  </strong>
                  <p>Clear deficiencies help students move forward.</p>
                </div>
                <ArrowUpRight size={14} color="#99aaa7" />
              </Link>
              <Link href="/audit" className="notification-mini">
                <span>
                  <ShieldCheck size={15} />
                </span>
                <div>
                  <strong>Every decision, accountable</strong>
                  <p>Inspect the timestamped, hash-linked audit trail.</p>
                </div>
                <ArrowUpRight size={14} color="#99aaa7" />
              </Link>
            </div>
          </Panel>
        </div>
        <div className="dashboard-grid">
          <Panel
            title="District uptake"
            subtitle="Application counts within the selected scope"
            action={
              <span className="small-text muted">
                {data.byDistrict.length} districts
              </span>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Applications</th>
                    <th>Share</th>
                    <th>Explore</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDistrict.map((d) => (
                    <tr key={d.name}>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>{d.value}</td>
                      <td>
                        <ConfidenceBar
                          value={
                            summary.total ? (d.value / summary.total) * 100 : 0
                          }
                        />
                      </td>
                      <td>
                        <Link
                          aria-label={`Explore ${d.name}`}
                          href={
                            "/analytics?" +
                            new URLSearchParams({
                              ...filters,
                              district: d.name,
                            })
                          }
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="stack">
            <Panel title="Applications by scheme">
              <RankBars data={data.byScheme} />
            </Panel>
            <Panel
              title="Officer workload"
              subtitle="Open submitted applications"
            >
              <RankBars data={data.officers} />
            </Panel>
            <Panel title="Gender distribution">
              <RankBars data={data.byGender} />
            </Panel>
          </div>
        </div>
        {full && (
          <>
            <div className="scheme-grid" style={{ marginBottom: 22 }}>
              <Panel title="Common document deficiencies">
                <RankBars data={data.deficiencies} />
                {!data.deficiencies.length && (
                  <Empty
                    title="No open deficiencies"
                    description="All document checks in this filter are complete."
                  />
                )}
              </Panel>
              <Panel title="Disbursement status">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Installments</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr key={p.name}>
                          <td>{p.name}</td>
                          <td>{p.count}</td>
                          <td>{money(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Rejection reasons">
                {data.rejections.length ? (
                  <div className="panel-body">
                    {data.rejections.map((r) => (
                      <p className="small-text" key={r.name}>
                        {r.value} · {r.name}
                      </p>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No rejection reasons in this filter"
                    description="Reasoned decisions appear here when recorded."
                  />
                )}
              </Panel>
              <Panel title="Renewal progress">
                <RankBars data={data.renewals} />
              </Panel>
            </div>
            <Panel title="Status and processing detail">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Applications</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStatus.map((s) => (
                      <tr key={s.name}>
                        <td>{statusLabels[s.name as Status]}</td>
                        <td>{s.value}</td>
                        <td>
                          {summary.total
                            ? ((s.value / summary.total) * 100).toFixed(1)
                            : 0}
                          %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <p className="small-text muted" style={{ marginTop: 17 }}>
              District counts describe this fictional dataset. They do not
              estimate the number of eligible students or official uptake.
              Processing averages include only applications with a recorded
              decision.
            </p>
          </>
        )}
      </>
    </Localize>
  );
}
function ConfidenceBar({ value }: { value: number }) {
  return (
    <Localize>
      <span className="confidence">
        <span className="mini-track" style={{ width: 70 }}>
          <span style={{ width: `${value}%` }} />
        </span>
        {value.toFixed(1)}%
      </span>
    </Localize>
  );
}
