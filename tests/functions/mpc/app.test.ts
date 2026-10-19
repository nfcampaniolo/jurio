import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  metadataRouter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  oauthRouter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  mcpRouter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("@functions/mpc/config/cors", () => ({ corsOptions: { credentials: true } }));
vi.mock("@functions/mpc/routes/metadata.routes", () => ({ metadataRouter: mocks.metadataRouter }));
vi.mock("@functions/mpc/routes/oauth.routes", () => ({ oauthRouter: mocks.oauthRouter }));
vi.mock("@functions/mpc/routes/mcp.routes", () => ({ mcpRouter: mocks.mcpRouter }));

import { app } from "@functions/mpc/app";

describe("MPC Express app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs an Express app and installs the hardening and route middleware", () => {
    const stack = app.router.stack.map((layer: { handle: unknown }) => layer.handle);

    expect(typeof app).toBe("function");
    expect(stack.length).toBeGreaterThanOrEqual(7);
    expect(stack[0]).toEqual(expect.any(Function));
    expect(stack[1]).toEqual(expect.any(Function));
    expect(stack[2]).toEqual(expect.any(Function));
    expect(stack).toContain(mocks.metadataRouter);
    expect(stack).toContain(mocks.oauthRouter);
    expect(stack).toContain(mocks.mcpRouter);
  });

  it("normalizes the /mcp prefix and calls next for downstream route matching", () => {
    const normalize = app.router.stack[3].handle;
    const next = vi.fn();
    const slashRoute = { url: "/mcp/tools?x=1" };
    const rootRoute = { url: "/mcp" };

    (normalize as (req: typeof slashRoute, res: unknown, next: () => void) => void)(slashRoute, {}, next);
    (normalize as (req: typeof rootRoute, res: unknown, next: () => void) => void)(rootRoute, {}, next);

    expect(slashRoute.url).toBe("/tools?x=1");
    expect(rootRoute.url).toBe("/");
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("returns the JSON 404 response from the final fallback", () => {
    const fallback = app.router.stack.map((layer: { handle: unknown }) => layer.handle)
      .find((middleware: unknown) => typeof middleware === "function" && (middleware as { length: number }).length === 2);
    const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    (fallback as (req: unknown, response: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }) => void)({}, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "not_found", message: "Endpoint non trovato." });
  });
});
