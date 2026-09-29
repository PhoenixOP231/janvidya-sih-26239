"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  UserRoundCheck,
  SlidersHorizontal,
  ChartNoAxesCombined,
  ArrowUpRight,
} from "lucide-react";
import type { Role } from "@/lib/domain";
import { api, useApp } from "./providers";
const roles = [
  {
    role: "student",
    name: "Student",
    icon: GraduationCap,
    description:
      "Apply, upload documents, resolve deficiencies, and track your journey.",
  },
  {
    role: "officer",
    name: "Scrutiny officer",
    icon: UserRoundCheck,
    description:
      "Compare evidence, review exceptions, and make reasoned decisions.",
  },
  {
    role: "scheme_admin",
    name: "Scheme administrator",
    icon: SlidersHorizontal,
    description: "Configure a scheme, change rules, and generate merit lists.",
  },
  {
    role: "ministry_admin",
    name: "Ministry administrator",
    icon: ChartNoAxesCombined,
    description:
      "Explore regional analytics, payment records, and the audit trail.",
  },
];
export function DemoRoles() {
  const router = useRouter();
  const { notice } = useApp();
  const [busy, setBusy] = useState("");
  return (
    <Localize>
      <div className="demo-role-grid">
        {roles.map((r) => (
          <button
            className="demo-role-card"
            key={r.role}
            disabled={!!busy}
            onClick={async () => {
              setBusy(r.role);
              try {
                await api("auth/demo", { role: r.role as Role });
                router.push("/workspace");
                router.refresh();
              } catch (error) {
                notice((error as Error).message, true);
                setBusy("");
              }
            }}
          >
            <r.icon size={26} />
            <strong>{r.name}</strong>
            <small>{r.description}</small>
            <span className="text-button">
              {busy === r.role ? "Opening…" : "Enter workspace"}
              <ArrowUpRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </Localize>
  );
}
