import { Router } from "express";

export const metadataRouter = Router();

// 1. Server Card
metadataRouter.get(["/.well-known/mcp/server-card", "/.well-known/mcp/server-card/"], (req, res) => {
  res.status(200).json({
    name: "Jurio MCP Server",
    version: "1.0.4",
    description: "Server MCP per la ricerca nella giurisprudenza italiana",
  });
});

// 2. Protected Resource (RFC 9723)
metadataRouter.get([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/",
  "/.well-known/oauth-protected-resource/mcp"
], (req, res) => {
  res.status(200).json({
    resource: "https://jurio.it/mcp",
    authorization_servers: ["https://jurio.it/mcp"]
  });
});

// 3. Authorization Server Metadata (RFC 8414 & OpenID Discovery)
metadataRouter.get([
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/",
  "/.well-known/oauth-authorization-server/mcp",
  "/.well-known/openid-configuration",
  "/.well-known/openid-configuration/",
  "/.well-known/openid-configuration/mcp"
], (req, res) => {
  res.status(200).json({
    issuer: "https://jurio.it/mcp",
    authorization_endpoint: "https://jurio.it/mcp/authorize",
    token_endpoint: "https://jurio.it/mcp/token",
    registration_endpoint: "https://jurio.it/mcp/register",
    authorization_response_iss_parameter_supported: false,
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});
