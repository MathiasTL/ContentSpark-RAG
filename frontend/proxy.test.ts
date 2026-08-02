import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as profileStatus from "@/shared/lib/profile-status";
import { proxy } from "./proxy";

// Mock de @supabase/ssr — createServerClient devuelve un cliente falso
// cuyo auth.getUser()/getSession() controlamos por test.
const getUserMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
    },
  }),
}));

const AUTH_USER = { id: "u1", user_metadata: {}, app_metadata: {} };
const SESSION_WITH_TOKEN = {
  data: { session: { access_token: "token-abc" } },
};

function req(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

beforeEach(() => {
  vi.restoreAllMocks();
  getUserMock.mockReset();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(SESSION_WITH_TOKEN);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("proxy — threat matrix (design.md Threat Matrix)", () => {
  it("returns next() for /onboarding when incomplete", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    const statusSpy = vi
      .spyOn(profileStatus, "fetchProfileStatus")
      .mockResolvedValue(false);

    const response = await proxy(req("/onboarding"));

    expect(response.status).not.toBe(307);
    expect(statusSpy).toHaveBeenCalledWith("token-abc");
  });

  it("redirects /chat → /onboarding when incomplete", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    vi.spyOn(profileStatus, "fetchProfileStatus").mockResolvedValue(false);

    const response = await proxy(req("/chat"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/onboarding");
  });

  it("redirects /onboarding → /chat when complete", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    vi.spyOn(profileStatus, "fetchProfileStatus").mockResolvedValue(true);

    const response = await proxy(req("/onboarding"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/chat");
  });

  it("never redirects a complete profile", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    vi.spyOn(profileStatus, "fetchProfileStatus").mockResolvedValue(true);

    const response = await proxy(req("/chat"));

    expect(response.status).not.toBe(307);
  });

  it("does not fetch status when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const statusSpy = vi.spyOn(profileStatus, "fetchProfileStatus");

    const response = await proxy(req("/chat"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it("fails open on backend error", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    vi.spyOn(profileStatus, "fetchProfileStatus").mockResolvedValue(null);

    const response = await proxy(req("/chat"));

    expect(response.status).not.toBe(307);
  });

  it("keeps /calendar bypass", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    const statusSpy = vi
      .spyOn(profileStatus, "fetchProfileStatus")
      .mockResolvedValue(false);

    const response = await proxy(req("/calendar"));

    expect(response.status).not.toBe(307);
    // D3: /calendar tiene bypass y no necesita el status call, pero el
    // fetch puede ejecutarse igualmente antes del check de ruta — lo que
    // NO debe pasar es que ese resultado dispare un redirect a /onboarding.
    void statusSpy;
  });

  it("does not fetch status for a static asset path", async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    const statusSpy = vi.spyOn(profileStatus, "fetchProfileStatus");

    await proxy(req("/_next/static/x.js"));

    expect(statusSpy).not.toHaveBeenCalled();
  });
});
