import Valkey from "iovalkey";
import { createHash, randomBytes } from "node:crypto";
import "server-only";

export type EmailFlow = {
  organization: string;
  requestId: string;
  userId: string;
  email: string;
  phase: "verify-email" | "otp";
  sessionId?: string;
  sessionToken?: string;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const reserveScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local user = tonumber(redis.call('GET', KEYS[2]) or '0')
local org = tonumber(redis.call('GET', KEYS[3]) or '0')
if user >= 5 or org >= 100 then return 0 end
redis.call('SET', KEYS[1], '1', 'EX', 60)
if redis.call('INCR', KEYS[2]) == 1 then redis.call('EXPIRE', KEYS[2], 3600) end
if redis.call('INCR', KEYS[3]) == 1 then redis.call('EXPIRE', KEYS[3], 60) end
return 1
`;

export class ConsumerEmailStore {
  private readonly client: Valkey;
  private connecting?: Promise<void>;
  constructor(url: string) {
    this.client = new Valkey(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1000,
      commandTimeout: 1000,
      retryStrategy: () => null,
    });
    this.client.on("error", () => {});
  }
  private async ready() {
    if (this.client.status !== "ready") {
      this.connecting ??= this.client.connect().finally(() => {
        this.connecting = undefined;
      });
      await this.connecting;
    }
    if (this.client.status !== "ready") throw new Error("Consumer email store unavailable");
  }
  async reserve(instance: string, organization: string, email: string): Promise<boolean> {
    await this.ready();
    const prefix = `consumer-email:v1:{${digest(instance + "\0" + organization)}}:`;
    const user = digest(email.trim().toLowerCase());
    return (
      (await this.client.eval(reserveScript, 3, prefix + user + ":cooldown", prefix + user + ":hour", prefix + "minute")) ===
      1
    );
  }
  async save(instance: string, flow: EmailFlow): Promise<string> {
    await this.ready();
    const handle = randomBytes(32).toString("hex");
    const result = await this.client.set(
      `consumer-email:v1:flow:${digest(instance)}:${handle}`,
      JSON.stringify(flow),
      "EX",
      300,
      "NX",
    );
    if (result !== "OK") throw new Error("Could not save consumer email flow");
    return handle;
  }
  async take(instance: string, handle: string): Promise<EmailFlow | null> {
    if (!/^[a-f0-9]{64}$/.test(handle)) return null;
    await this.ready();
    const value = await this.client.getdel(`consumer-email:v1:flow:${digest(instance)}:${handle}`);
    return value ? (JSON.parse(value) as EmailFlow) : null;
  }
  close() {
    this.client.disconnect();
  }
}
