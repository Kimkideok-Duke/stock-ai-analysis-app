# Chat Subscription Connection

Updated: 2026-10-18

## Availability

- ChatGPT: official Sign in with ChatGPT flow for local PC execution. Eligibility and model access are checked during authorization.
- Gemini / Claude: subscription connections are not offered; personal API connections remain available.
- This does not enable subscription use in a hosted commercial service or iPhone deployment. Those need their own supported registration and eligibility review.

## Local Flow

1. Choose Chat subscription and GPT, then Continue with ChatGPT.
2. The server creates random state, nonce, PKCE verifier and an independent polling credential.
3. The system browser uses OpenAI's documented dynamic registration or the saved issued client ID.
4. Callback is exactly http://127.0.0.1:8787/auth/callback (or configured local API port).
5. The server exchanges the code, verifies JWT signature, issuer, audience, expiry, nonce and required plan scopes.
6. Models are retrieved from the selected account's catalog. Only then can the app run subscription analysis.
7. Responses uses store=false, stream=true and waits for response.completed.

## Credential Handling

- OAuth access tokens stay in server memory, never returned to browser JavaScript.
- The UI holds only a random local session handle. Disconnect deletes the server session.
- Server restart or token expiration requires login again. Automatic token refresh is not implemented.
- The stable host ID and issued registration ID/subject are saved under ignored .localappdata/chatgpt-host.json; no access/refresh/ID tokens are written there.
- The registration is reused on later login; another account can start a fresh registration.
- API keys and subscription sessions use separate request paths and never silently substitute for one another.

## Verification

Run `.tools/node/node.exe --test server/*.test.js` and `npm run typecheck`.
Real user consent, eligible-plan login and live subscription analysis require manual verification.

## Official References

- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
