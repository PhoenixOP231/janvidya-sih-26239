"use client";
import { Localize } from "@/components/localize";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, ArrowUpRight } from "lucide-react";
import type { notifications } from "@/db/schema";
import { dateLabel } from "@/lib/domain";
import { api, useApp } from "./providers";
import { PageTitle, Panel, Empty, Button } from "./ui";
export function Notifications({
  rows,
}: {
  rows: (typeof notifications.$inferSelect)[];
}) {
  const { t, notice } = useApp();
  const router = useRouter();
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Communication center"
          title="Stay up to date."
          description="Application updates and messages, all in one place."
          actions={
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api("notifications");
                  router.refresh();
                  notice("Notifications marked as read");
                } catch (e) {
                  notice((e as Error).message, true);
                }
              }}
            >
              <CheckCheck size={15} />
              {t("Read all")}
            </Button>
          }
        />
        <Panel>
          {rows.length ? (
            rows.map((n) => (
              <div
                className={`notification-item ${n.read ? "" : "unread"}`}
                key={n.id}
              >
                <span className="notification-icon">
                  <Bell size={19} />
                </span>
                <div style={{ flex: 1 }}>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>
                    {dateLabel(n.createdAt)} · {n.delivery}
                  </small>
                  <div style={{ marginTop: 12 }}>
                    <Link
                      className="text-button"
                      href={n.href}
                      onClick={() => {
                        api(`notifications/${n.id}`).catch(() => {});
                      }}
                    >
                      {t("View details")}
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
                {!n.read && (
                  <span className="live-dot" style={{ marginTop: 7 }} />
                )}
              </div>
            ))
          ) : (
            <Empty
              title="No notifications yet"
              description="Application updates will appear here as you move through the process."
            />
          )}
        </Panel>
      </>
    </Localize>
  );
}
