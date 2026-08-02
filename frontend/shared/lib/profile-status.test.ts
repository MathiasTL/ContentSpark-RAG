import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfileStatus } from "./profile-status";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchProfileStatus", () => {
  it("retorna true cuando el backend responde is_complete: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ is_complete: true, missing_fields: [] }),
      }),
    );

    await expect(fetchProfileStatus("token-123")).resolves.toBe(true);
  });

  it("retorna false cuando el backend responde is_complete: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_complete: false,
          missing_fields: ["niche"],
        }),
      }),
    );

    await expect(fetchProfileStatus("token-123")).resolves.toBe(false);
  });

  it("retorna null (fail-open) cuando la respuesta no es 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(fetchProfileStatus("token-123")).resolves.toBeNull();
  });

  it("retorna null (fail-open) ante un error de red, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));

    await expect(fetchProfileStatus("token-123")).resolves.toBeNull();
  });

  it("retorna null (fail-open) ante un timeout, sin lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")),
    );

    await expect(fetchProfileStatus("token-123")).resolves.toBeNull();
  });
});
