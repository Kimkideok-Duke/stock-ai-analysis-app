# Personal AI Connections

- Providers: Gemini (Google), GPT (OpenAI Responses), Claude (Anthropic Messages).
- The Personal API tab connects API credentials. A separate Chat subscription tab supports local ChatGPT sign-in; see docs/chat-subscription.md.
- Model ID is editable because access depends on each user's API account.
- Connection tests make a small billable generation request. Analysis runs only on explicit action.
- Keys are held in React session memory only, masked in inputs, and cleared on disconnect or reload.
- Keys pass through the analysis server in a request header; the server does not persist them.
- No fallback to the operator's GEMINI_API_KEY. Provider errors are replaced with generic safe messages.
- Local development uses localhost HTTP. Remote deployments require HTTPS and an explicitly configured origin.
- Real multi-user production use still requires app authentication, rate limits, and a managed encrypted credential store if persistent connections are desired.
- Run tests: `.tools/node/node.exe --test server/aiProviders.test.js`.
