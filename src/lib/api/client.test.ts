/** The mock transport must never masquerade as a production data source. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, mockRequest } from "@/lib/api/client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockRequest — environment boundary", () => {
  it("refuses mock data outside Vitest unless local demo mode is explicitly enabled", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATA", "false");
    const resolver = vi.fn(() => ({ studentId: "demo" }));

    await expect(mockRequest(resolver)).rejects.toMatchObject({
      status: 501,
      code: "feature_deferred",
    } satisfies Partial<ApiError>);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("permits mock data only after explicit non-production opt-in", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATA", "true");
    const result = await mockRequest(() => ({ studentId: "demo" }));
    expect(result).toEqual({ studentId: "demo" });
  });

  it("ignores demo opt-in in production", async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATA", "true");
    const resolver = vi.fn(() => ({ studentId: "demo" }));

    await expect(mockRequest(resolver)).rejects.toMatchObject({
      status: 501,
      code: "feature_deferred",
    });
    expect(resolver).not.toHaveBeenCalled();
  });
});
