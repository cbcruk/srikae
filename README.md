# GraphQL Mock Extension

Mock/modify GraphQL responses per operation in Chrome DevTools.
See [DESIGN.md](./DESIGN.md) for the full spec and rationale.

## Develop

```bash
vp install   # install dependencies
vp dev       # build + watch (HMR)
vp test      # unit tests (match / merge-patch)
vp check     # format, lint, type check
vp build     # production build into dist/
```

## Load in Chrome

1. `vp build` (or `vp dev` for watch mode)
2. `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open DevTools on any page → **GraphQL Mock** panel → add a rule

## Architecture

- `src/main-world/injected.ts` — MAIN world: `@mswjs/interceptors` traps fetch/XHR, matches rules, mocks or merge-patches responses.
- `src/content/bridge.ts` — ISOLATED world: bridges `chrome.storage` to the MAIN world via `CustomEvent`.
- `src/devtools/` — React rule editor (CRUD + JSON import/export).
- `src/shared/` — rule matching, RFC 7386 merge-patch, storage, types.
