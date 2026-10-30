import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import webpush, { type PushSubscription } from "web-push";
import { pushSubscriptions, saveStore, type DemoRole, type PushSubscriptionRecord } from "./data/store";

export type PushTarget = { role: DemoRole; userName?: string; url: string };
export type PushMessage = { title: string; body: string; targets: PushTarget[] };

type VapidConfiguration = { publicKey: string; privateKey: string };

function getVapidConfiguration(): VapidConfiguration {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (publicKey || privateKey) {
    if (!publicKey || !privateKey) throw new Error("Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together.");
    return { publicKey, privateKey };
  }

  const keyFile = process.env.VAPID_KEY_FILE || path.resolve(__dirname, "..", "data", "vapid-keys.json");
  mkdirSync(path.dirname(keyFile), { recursive: true });
  if (existsSync(keyFile)) {
    const saved: unknown = JSON.parse(readFileSync(keyFile, "utf8"));
    if (!saved || typeof saved !== "object" ||
      typeof (saved as Record<string, unknown>).publicKey !== "string" ||
      typeof (saved as Record<string, unknown>).privateKey !== "string") {
      throw new Error(`The persisted VAPID key file is invalid: ${keyFile}`);
    }
    return {
      publicKey: (saved as VapidConfiguration).publicKey,
      privateKey: (saved as VapidConfiguration).privateKey
    };
  }

  const keys = webpush.generateVAPIDKeys();
  const temporaryFile = `${keyFile}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(keys), { encoding: "utf8", mode: 0o600, flag: "wx" });
  renameSync(temporaryFile, keyFile);
  console.info("Generated and saved persistent Web Push VAPID keys.");
  return keys;
}

const vapid = getVapidConfiguration();
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
webpush.setVapidDetails(subject, vapid.publicKey, vapid.privateKey);

export const pushConfigured = true;
export const getPushPublicKey = () => vapid.publicKey;

export function isPushSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Record<string, unknown>;
  if (typeof subscription.endpoint !== "string" || typeof subscription.keys !== "object" || !subscription.keys) return false;
  let endpoint: URL;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    return false;
  }
  const keys = subscription.keys as Record<string, unknown>;
  return endpoint.protocol === "https:" &&
    typeof keys.p256dh === "string" && /^[A-Za-z0-9_-]+$/.test(keys.p256dh) &&
    typeof keys.auth === "string" && /^[A-Za-z0-9_-]+$/.test(keys.auth);
}

export function savePushSubscription(subscription: PushSubscription, userName: string, role: DemoRole): void {
  const record: PushSubscriptionRecord = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    role,
    userName
  };
  const existingIndex = pushSubscriptions.findIndex((item) => item.endpoint === subscription.endpoint);
  if (existingIndex < 0) pushSubscriptions.push(record);
  else pushSubscriptions[existingIndex] = record;
}

export function removePushSubscription(endpoint: string): void {
  const index = pushSubscriptions.findIndex((item) => item.endpoint === endpoint);
  if (index >= 0) pushSubscriptions.splice(index, 1);
}

export async function sendPushNotification(message: PushMessage): Promise<void> {
  const deliveries = message.targets.flatMap((target) =>
    pushSubscriptions
      .filter((subscription) => subscription.role === target.role && (!target.userName || subscription.userName === target.userName))
      .map((subscription) => ({ subscription, url: target.url }))
  );
  await Promise.all(deliveries.map(async ({ subscription, url }) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: message.title,
        body: message.body,
        url
      }));
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error &&
        typeof error.statusCode === "number" ? error.statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) {
        removePushSubscription(subscription.endpoint);
        void saveStore().catch((saveError: unknown) => {
          console.error("Unable to remove an expired Web Push subscription from the SQLite data store:", saveError);
        });
        return;
      }
      console.error(`Unable to send Web Push notification to ${subscription.role} ${subscription.userName}:`, error);
    }
  }));
}
