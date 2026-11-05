import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "./basic-auth";

const env = { user: "admin", pass: "s3cret" };
const basic = (value: string) => `Basic ${btoa(value)}`;

describe("checkBasicAuth", () => {
  it("accepts the configured user and password", () => {
    expect(checkBasicAuth(basic("admin:s3cret"), env)).toBe(true);
  });

  it("refuses wrong, missing or malformed credentials", () => {
    expect(checkBasicAuth(basic("admin:wrong"), env)).toBe(false);
    expect(checkBasicAuth(basic("admin:s3cret2"), env)).toBe(false);
    expect(checkBasicAuth(null, env)).toBe(false);
    expect(checkBasicAuth("Bearer abc", env)).toBe(false);
    expect(checkBasicAuth("Basic %%%not-base64", env)).toBe(false);
  });

  it("stays locked when no admin password is configured", () => {
    expect(checkBasicAuth(basic(":"), { user: "", pass: "" })).toBe(false);
    expect(checkBasicAuth(basic("admin:undefined"), { user: "admin" })).toBe(false);
  });
});
