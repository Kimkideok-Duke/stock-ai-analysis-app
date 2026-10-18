# Security and Publish Policy

Created: 2026-07-14

## Sensitive Data

- Never commit real API keys, tokens, secrets, local logs, or generated local runtime files.
- Operator secrets stay in ignored local `.env` files or protected server environments.
- Personal provider keys stay in app session memory only, and pass to the server per request. Never persist them to browser storage or server files.
- Commit `.env.example` only with placeholder values.
- Do not include real secret values in Notion, GitHub issues, pull requests, commit messages, screenshots, or logs.

## GitHub Upload Rules

- Upload source code and documentation only.
- Exclude `.env`, `.env.*`, logs, local caches, `node_modules`, Expo state, and portable tool folders.
- Use the repository URL in Notion work updates.
- Do not record commit IDs in Notion unless explicitly requested later.

## Current Repository

- GitHub repository: https://github.com/Kimkideok-Duke/stock-ai-analysis-app
- Visibility: Private

