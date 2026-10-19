import { beforeEach, describe, expect, it, vi } from "vitest";

import { metadataRouter } from "@functions/mpc/routes/metadata.routes";

function handlerFor(path: string) {
  const layers = (metadataRouter as unknown as {
    stack: Array<{ route?: { path: string | string[]; stack: Array<{ handle: (req: unknown, res: unknown) => unknown }> } }>;
  }).stack;
  const route = layers.find(({ route }) =>
    route && (Array.isArray(route.path) ? route.path.includes(path) : route.path === path)
  )?.route;
  return route?.stack[0].handle as
    (req: unknown, res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }) => void;
}

describe("metadataRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers and serves the MCP server card", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    handlerFor("/.well-known/mcp/server-card")({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      name: "Jurio MCP Server",
      version: "1.0.4",
      description: "Server MCP per la ricerca nella giurisprudenza italiana",
    });
  });

  it("serves protected resource discovery on all supported paths", () => {
    const paths = [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/",
      "/.well-known/oauth-protected-resource/mcp",
    ];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    paths.forEach((path) => handlerFor(path)({}, res));

    expect(res.status).toHaveBeenCalledTimes(paths.length);
    expect(res.json).toHaveBeenCalledWith({
      resource: "https://jurio.it/mcp",
      authorization_servers: ["https://jurio.it/mcp"],
    });
  });

  it("serves OAuth authorization-server and OpenID discovery metadata", () => {
    const paths = [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/",
      "/.well-known/oauth-authorization-server/mcp",
      "/.well-known/openid-configuration",
      "/.well-known/openid-configuration/",
      "/.well-known/openid-configuration/mcp",
    ];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    paths.forEach((path) => handlerFor(path)({}, res));

    expect(res.status).toHaveBeenCalledTimes(paths.length);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      issuer: "https://jurio.it/mcp",
      authorization_endpoint: "https://jurio.it/mcp/authorize",
      token_endpoint: "https://jurio.it/mcp/token",
      code_challenge_methods_supported: ["S256"],
    }));
  });
});
