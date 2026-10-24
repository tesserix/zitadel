import { describe, expect, it } from "vitest";
import { consumerEmailAllowed } from "./consumer-email-policy";

const entry = (key: string, value: string) => ({ key, value: new TextEncoder().encode(value) });
const valid = [
  entry("consumer_binding", "identity-operator/mediconnect"),
  entry("consumer_email_otp", '{"version":1,"enabled":true,"smsEnabled":false}'),
];
describe("consumer email policy", () => {
  it("allows only an explicitly enabled operator-owned consumer organization", () => {
    expect(consumerEmailAllowed("consumer-mediconnect", valid)).toBe(true);
  });
  it.each([undefined, "", "TESSERIX", "386377229942128837", "consumer-other"])("rejects foreign organization %s", (org) => {
    expect(consumerEmailAllowed(org, valid)).toBe(false);
  });
  it.each([
    [],
    [valid[1]],
    [valid[0]],
    [valid[0], entry("consumer_email_otp", '{"version":1,"enabled":false,"smsEnabled":false}')],
    [valid[0], entry("consumer_email_otp", '{"version":2,"enabled":true,"smsEnabled":false}')],
    [valid[0], entry("consumer_email_otp", '{"version":1,"enabled":true,"smsEnabled":true}')],
    [valid[0], entry("consumer_email_otp", '{"version":1,"enabled":"true","smsEnabled":false}')],
    [valid[0], entry("consumer_email_otp", "{")],
    [...valid, valid[1]],
  ])("fails closed for absent, revoked, malformed, or ambiguous metadata", (...entries) => {
    expect(consumerEmailAllowed("consumer-mediconnect", entries)).toBe(false);
  });
});
