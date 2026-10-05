# Jurio OpenAI plugin — submission checklist

## Already prepared

- Portable root `plugin.json`.
- Remote MCP `mcp.json` with `https://jurio.it/mcp`.
- Onboarding skill.
- Five positive and three negative review cases.
- Primary logo and composer icon.
- Release notes.
- Italian listing translation.

## Still required before final review submission

1. **Verified developer identity** in the OpenAI Platform Dashboard, using the name under which Jurio should appear publicly.
2. **Privacy policy URL**: replace the missing `privacyPolicyURL` field with the real published Jurio privacy-policy page.
3. **Terms of service URL**: add the real published Jurio terms page as `termsOfServiceURL`.
4. **Reviewer account**: create a dedicated test account with sample data and the permissions needed by all five positive tests. Enter credentials only in OpenAI's Review details form, not in this package.
5. **Run the eight test cases** against the production MCP server and confirm the observed tool calls/results match the manifest.
6. **Demo recording**: record the main workflows and put the accessible URL in `extensions.com.openai.review.demo_recording_url`.
7. **OpenAI submission**: upload the ZIP through Plugins → Upload new or existing plugin, resolve validation findings, scan the MCP server, complete the review details, and submit the draft.

## Optional hardening before submission

- Confirm the OAuth discovery documents at `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, and `/.well-known/openid-configuration` are reachable from the public internet.
- Confirm the MCP endpoint accepts Streamable HTTP requests at `https://jurio.it/mcp` and preserves the Bearer-token boundary.
- Verify that the five tool names and schemas remain unchanged during the review snapshot.
- Keep a production test account available for future review cycles.
