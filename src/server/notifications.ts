import { randomUUID } from "node:crypto";
import { notifications } from "@/db/schema";
import type { Executor } from "./db";
export interface DeliveryProvider {
  name: string;
  send(message: { title: string; body: string }): Promise<string>;
}
export const mockEmail: DeliveryProvider = {
  name: "Mock email",
  async send() {
    return "Recorded in demo outbox";
  },
};
export const mockSms: DeliveryProvider = {
  name: "Mock SMS",
  async send() {
    return "Recorded in demo outbox";
  },
};
export async function notify(
  tx: Executor,
  userId: string,
  title: string,
  body: string,
  href: string,
) {
  await tx.insert(notifications).values({
    id: randomUUID(),
    userId,
    title,
    body,
    href,
    delivery: "In-app delivered · mock email/SMS outbox",
  });
  await Promise.all([
    mockEmail.send({ title, body }),
    mockSms.send({ title, body }),
  ]);
}
