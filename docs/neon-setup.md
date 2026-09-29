# Requested Neon setup

Target: project `fragrant-bonus-17540843`, branch `production`.

Completed locally:
- Installed Neon CLI 7.0.0 at `/Users/alexei/.local/bin/neon`. The requested default global install failed because `/usr/local/lib/node_modules` is not user-writable; a user-global prefix succeeded.
- Ran `neon skills -y`: eight Neon skills installed for Codex in `.agents/skills`.
- Ran `neon config init`: created root configuration. Its package installation hit pnpm's workspace-root guard, so `pnpm add -w @neon/config @neon/env` completed it.
- Wrote the owner's exact `neon.ts` and `hello.ts` contents. Config and handler typecheck, and the local handler response is verified.

Completed remotely:
- Browser login succeeded on the second attempt.
- `neon mcp -y` was rejected by automatic approval review because its defaults mint account-wide writable access. The approved safer alternative succeeded: `neon mcp -y --agent codex --project --project-id fragrant-bonus-17540843`.
- Project-scoped MCP configuration is in ignored `.codex/config.toml` with permission 0600. Its key cannot access other projects. It still has write/delete capabilities within this project, as needed for the requested setup. Reload the Codex project/session if the new server is not yet available.
- Linked `.neon` to project `fragrant-bonus-17540843`, production branch `br-little-rice-b4m24npd`, region `aws-us-east-2`.
- Reviewed `neon config plan`: the only pending addition was `function api`.
- `neon deploy` succeeded. Live invocation returned HTTP 200 and exact body `Hello from Neon Functions`.
- Neon-managed variables are in ignored root `.env.local`, permission 0600. This is separate from the planner's local test env at `apps/web/.env.local`. No provider secrets or URLs containing credentials are stored in this document.

Function: https://br-little-rice-b4m24npd-api.compute.c-6.us-east-2.aws.neon.tech/

For future updates:

```sh
cd /Users/alexei/Documents/dev/Timely
export PATH="$HOME/.local/bin:$PATH"
neon config plan
neon deploy
```

`preview` is accepted by the installed config package, though current Neon docs prefer top-level `buckets`/`functions`. The supplied structure is retained exactly. This hello endpoint does not access private data. Managed Neon Auth is being provisioned only because the owner explicitly requested `auth: true`; the planner remains on self-hosted Better Auth unless the owner separately changes its architecture.

A post-deployment plan reports `~ function api` for the declared source. Deployment success is evidenced by the completed apply and live HTTP response, not by claiming a no-op plan.
