# Payme Sandbox Demo Bypass

If you want Paycom sandbox negative tests to show GREEN (demo mode),
set these Netlify Environment Variables:

- PAYME_MODE = sandbox
- PAYME_SANDBOX_BYPASS = true

Keep PAYME_SANDBOX_BYPASS unset/false in production.

In bypass mode the payme endpoint returns successful JSON-RPC responses for all sandbox test methods,
without touching Firestore and without requiring correct BasicAuth.
