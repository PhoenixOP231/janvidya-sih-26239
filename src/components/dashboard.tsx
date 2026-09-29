"use client";
import { Localize } from "@/components/localize";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCheck,
  Files,
  GraduationCap,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { DashboardData } from "@/server/queries";
import type { Actor } from "@/lib/domain";
import { money, dateLabel } from "@/lib/domain";
import { PageTitle, Metric, Panel } from "./ui";
import { ApplicationTable } from "./application-table";
import { DonutChart } from "./charts";
import { useApp } from "./providers";
export function Dashboard({
  data,
  actor,
}: {
  data: DashboardData;
  actor: Actor;
}) {
  const { t } = useApp();
  const total = data.byStatus.reduce((n, s) => n + s.count, 0);
  const sum = (states: string[]) =>
    data.byStatus
      .filter((s) => states.includes(s.status))
      .reduce((n, s) => n + s.count, 0);
  const student = actor.role === "student";
  const requires = sum([
    "deficiency_raised",
    "student_response_pending",
    "clarification_required",
  ]);
  const review = sum(["ready_for_review", "under_scrutiny"]);
  const approved = sum([
    "approved",
    "selected",
    "disbursed",
    "payment_processing",
  ]);
  const disbursed = data.payments
    .filter((p) => p.status === "disbursed")
    .reduce((n, p) => n + p.amount, 0);
  const grouped = [
    { name: "Approved", value: approved },
    { name: "In review", value: review },
    { name: "Action needed", value: requires },
    { name: "Other", value: total - approved - review - requires },
  ].filter((d) => d.value);
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow={student ? "Student portal" : "Scrutiny workspace"}
          title={
            student
              ? "Your next chapter starts here."
              : `Welcome back, ${actor.name.split(" ")[0]}.`
          }
          description={
            student
              ? "Track your applications, resolve requests, and keep your education moving forward."
              : "A clear view of your review queue. Focus on the cases that need your judgment."
          }
          actions={
            student ? (
              <Link href="/schemes" className="button">
                <Plus size={15} />
                {t("New application")}
              </Link>
            ) : (
              <Link href="/applications?flag=flagged" className="button">
                Review flagged cases <ArrowRight size={15} />
              </Link>
            )
          }
        />
        <div className="metric-grid">
          <Metric
            label={student ? "Active applications" : "Assigned applications"}
            value={total}
            detail={
              student
                ? "Your scholarship journey"
                : "Across all assigned schemes"
            }
            icon={<Files />}
          />
          <Metric
            label={student ? "Action required" : "Pending scrutiny"}
            value={student ? requires : review}
            detail={
              student
                ? "A correction can keep things moving"
                : "Ready for human review"
            }
            icon={<TriangleAlert />}
          />
          <Metric
            label="Approved"
            value={approved}
            detail="Human-reviewed applications"
            icon={<CheckCheck />}
            trend
          />
          <Metric
            label={student ? "Disbursed" : "Needs clarification"}
            value={student ? money(disbursed) : requires}
            detail={
              student
                ? "Fictional payment records"
                : "Clear requests sent to students"
            }
            icon={student ? <Wallet /> : <Bell />}
          />
        </div>
        <div className="dashboard-grid">
          <Panel
            title={
              student ? "Your application journey" : "Application overview"
            }
            subtitle={
              student
                ? "Know where you stand, at every step."
                : "A breakdown of your current workload."
            }
          >
            {student ? (
              <div className="panel-body" style={{ paddingTop: 8 }}>
                <div className="notice warning" style={{ marginBottom: 25 }}>
                  <TriangleAlert size={18} />
                  <div>
                    <strong>
                      {requires
                        ? "A small update, then onward."
                        : "You’re ready for your next step."}
                    </strong>
                    <p>
                      {requires
                        ? "One or more applications need your response. Review the request and upload the correct document."
                        : "Explore a scheme, complete your profile, or follow an application already in progress."}
                    </p>
                    <Link
                      href={
                        requires
                          ? "/applications?status=deficiency_raised"
                          : "/schemes"
                      }
                      className="text-button"
                      style={{ marginTop: 8 }}
                    >
                      {requires
                        ? "Review what needs attention"
                        : t("Explore schemes")}{" "}
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
                <div className="how-grid" style={{ gap: 15 }}>
                  {["Apply", "Verify", "Review", "Receive"].map((s, i) => (
                    <div key={s}>
                      <span className="how-number" style={{ marginBottom: 10 }}>
                        {i + 1}
                      </span>
                      <strong style={{ fontSize: 11 }}>{s}</strong>
                      <p style={{ fontSize: 9, marginTop: 4 }}>
                        {
                          [
                            "One guided form",
                            "Clear evidence",
                            "A human decision",
                            "Continued support",
                          ][i]
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart data={grouped} total={total} />
            )}
          </Panel>
          <div className="callout-card">
            <span className="callout-icon">
              {student ? (
                <GraduationCap size={25} />
              ) : (
                <ShieldCheck size={25} />
              )}
            </span>
            <h2>
              {student
                ? "Your potential deserves possibility."
                : "AI suggests. Your judgment matters."}
            </h2>
            <p>
              {student
                ? "Explore research and overseas study schemes, with requirements explained before you begin."
                : "Check confidence, compare the evidence, and leave a clear reason for every decision."}
            </p>
            <Link
              href={student ? "/schemes" : "/applications?q=JV-2026-000"}
              className="button white small"
            >
              {student ? t("Explore schemes") : "Explore six demo cases"}{" "}
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        <div className="dashboard-lower">
          <Panel
            title={student ? "Latest applications" : "Recent applications"}
            subtitle="Every application has a visible next step."
            action={
              <Link href="/applications" className="text-button">
                {t("View all")} <ArrowUpRight size={13} />
              </Link>
            }
          >
            <ApplicationTable list={data.recent} actor={actor} compact />
          </Panel>
          <Panel
            title="Notifications"
            action={
              <Link
                href="/notifications"
                className="icon-button"
                aria-label="All notifications"
              >
                <ArrowUpRight size={15} />
              </Link>
            }
          >
            <div className="notifications-mini">
              {data.notifications.length ? (
                data.notifications.map((n) => (
                  <Link href={n.href} key={n.id} className="notification-mini">
                    <span>
                      <Bell size={15} />
                    </span>
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <small>{dateLabel(n.createdAt)}</small>
                    </div>
                  </Link>
                ))
              ) : (
                <p style={{ fontSize: 11, padding: "10px 0 25px" }}>
                  You’re all caught up. New updates will appear here.
                </p>
              )}
            </div>
          </Panel>
        </div>
        <div
          className="row"
          style={{
            justifyContent: "center",
            color: "#8da49d",
            fontSize: 10,
            marginTop: 29,
          }}
        >
          <ShieldCheck size={14} />
          {t("AI suggests. Rules validate. Humans decide.")}
        </div>
      </>
    </Localize>
  );
}
