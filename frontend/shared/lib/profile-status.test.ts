import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfileStatus, resolveBackendUrl } from "./profile-status";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

describe("resolveBackendUrl", () => {
  it("prefiere BACKEND_INTERNAL_URL cuando ambas variables estan definidas", () => {
    vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");

    expect(resolveBackendUrl()).toBe("http://backend:8000");
  });

  it("cae a NEXT_PUBLIC_API_URL cuando solo esa esta definida", () => {
    vi.stubEnv("BACKEND_INTERNAL_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:9000");

    expect(resolveBackendUrl()).toBe("http://api.test:9000");
  });

  it("cae al default hardcodeado cuando ninguna esta definida", () => {
    vi.stubEnv("BACKEND_INTERNAL_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(resolveBackendUrl()).toBe("http://localhost:8000");
  });
});
