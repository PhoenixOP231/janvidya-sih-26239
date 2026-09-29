"use client";
import { Localize } from "@/components/localize";

import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  FileText,
  LoaderCircle,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { statusLabels, type Status } from "@/lib/domain";
import { useApp } from "./providers";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Localize>
      <Link href="/" className="brand" aria-label="JanVidya home">
        <span className="brand-mark">
          <BookOpen size={23} />
        </span>
        <span>
          JanVidya{!compact && <small>Scholarships & fellowships</small>}
        </span>
      </Link>
    </Localize>
  );
}
export function Button({
  children,
  busy,
  variant = "",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: string;
}) {
  return (
    <Localize>
      <button
        {...props}
        disabled={busy || props.disabled}
        className={`button ${variant} ${className}`}
      >
        {busy ? <LoaderCircle size={16} className="spin" /> : null}
        {children}
      </button>
    </Localize>
  );
}
export function StatusBadge({ status }: { status: Status | string }) {
  const { t } = useApp();
  return (
    <Localize>
      <span className={`badge status-${status}`}>
        <i />
        {t(statusLabels[status as Status] || status.replaceAll("_", " "))}
      </span>
    </Localize>
  );
}
export function Confidence({ value }: { value: number }) {
  return (
    <Localize>
      <span className={`confidence ${value < 80 ? "low" : ""}`}>
        <span className="mini-track">
          <span style={{ width: `${value}%` }} />
        </span>
        {value}%
      </span>
    </Localize>
  );
}
export function PageTitle({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <div className="page-title">
        <div>
          {eyebrow && (
            <div className="breadcrumb">
              {t(eyebrow)} <ChevronRight size={12} /> JanVidya
            </div>
          )}
          <h1>{t(title)}</h1>
          {description && <p>{t(description)}</p>}
        </div>
        {actions && <div className="title-actions">{actions}</div>}
      </div>
    </Localize>
  );
}
export function Empty({
  title = "No records found",
  description = "Try another filter or start a new application.",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <div className="empty">
        <span className="empty-icon">
          <FileText size={26} />
        </span>
        <h3>{t(title)}</h3>
        <p>{t(description)}</p>
        {children}
      </div>
    </Localize>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <section className={`panel ${className}`}>
        {title && (
          <div className="panel-heading">
            <div>
              <h2>{t(title)}</h2>
              {subtitle && <p>{t(subtitle)}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </section>
    </Localize>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  trend?: boolean;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <div className="metric">
        <div className="metric-top">
          <span>{t(label)}</span>
          <span className="metric-icon">{icon}</span>
        </div>
        <strong>{value}</strong>
        <small className={trend ? "positive" : ""}>
          {trend && <ArrowUpRight size={13} />} {t(detail)}
        </small>
      </div>
    </Localize>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <Localize>
      <div className={`notice ${tone}`}>
        {tone === "success" ? <Check size={19} /> : <AlertCircle size={19} />}
        <div>{children}</div>
      </div>
    </Localize>
  );
}
export function Text({ children }: { children: string }) {
  const { t } = useApp();
  return (
    <Localize>
      <>{t(children)}</>
    </Localize>
  );
}
