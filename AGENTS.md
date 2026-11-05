# AGENTS.md

pnpm monorepo for the `react-eyedropper-picker` npm library (a React color picker that supports the native EyeDropper API).

## Layout

```
packages/react-eyedropper-picker   # the published npm library (tsdown → ESM + CJS + d.ts)
  src/components/                  # ColorPicker, SaturationPanel, HueSlider, EyeDropperButton
  src/hooks/                       # useColorPicker, useEyeDropper, usePointerDrag (internal)
  src/utils/color.ts               # color conversion helpers (all re-exported)
  src/index.ts                     # public API — every export here is public surface
  tests/                           # vitest + jsdom + Testing Library
apps/demo                          # private Vite playground; aliases library *source* for HMR
```

## Commands (run from root, Node 24 per .nvmrc)

```bash
pnpm install
pnpm dev          # demo at http://localhost:5173
pnpm test         # vitest run (library)
pnpm typecheck    # all workspaces
pnpm build        # build library to packages/react-eyedropper-picker/dist
pnpm format       # prettier
```

Run `pnpm typecheck && pnpm test` before considering a change done.

## Conventions

- Prettier: no semicolons, single quotes, trailing commas (es5).
- `react` is a peer dependency (`>=19.2`). Latest React APIs (`useEffectEvent`, `useId`, `<Activity>`, `useTransition`, ...) are allowed. Keep the library free of runtime dependencies.
- Use the latest versions of dev dependencies and tools. Check with `pnpm -r outdated`; upgrade with `pnpm -r update --latest`, then run typecheck, test and `pnpm build:demo`.
- `sideEffects: false`: no top-level side effects in `src/`.
- EyeDropper API is not available everywhere (Chromium only, not in jsdom). Guard with `isEyeDropperSupported`; mock it in tests.
- Changes to `src/index.ts` exports are public API changes; call them out.

## React best practices

When writing or reviewing React code (library or demo), follow the Vercel skill in `.agents/skills/vercel-react-best-practices/` (`SKILL.md` for the index, `rules/*.md` for details). Read the relevant rule files before implementing.

Rules that matter most for this library (Loupe, pointer tracking, sound):

- `rerender-use-ref-transient-values`: pointer position, current pixel, zoom gesture state live in refs. Draw in `requestAnimationFrame`, not via `setState` per move.
- `rerender-move-effect-to-event`: open/confirm/cancel/sound logic runs in event handlers, not state + effect.
- `advanced-use-latest`, `advanced-effect-event-deps`: wrap user callbacks (`onPick`, `onMagnificationChange`, ...) read inside effects or listeners with `useEffectEvent`, and never put the result in effect deps. Use refs (`advanced-event-handler-refs`) only for callbacks called outside effects, such as from `requestAnimationFrame` loops started in an event handler.
- `client-passive-event-listeners`: passive for tracking-only listeners. Wheel/touch listeners that zoom or block scroll call `preventDefault()`, so register them with `{ passive: false }` via `addEventListener` (React's `onWheel` is passive).
- `rerender-functional-setstate`, `rerender-derived-state-no-effect`, `rerender-dependencies`, `rerender-lazy-state-init`, `rerender-no-inline-components`, `rendering-conditional-render`, `rendering-hoist-jsx`, `rerender-memo-with-default-value`.
- `bundle-conditional`, `bundle-analyzable-paths`: Loupe code only under the `/loupe` entry; base entry must not import it.
- `js-*`: pixel loops (sampling, drawing) cache property access, avoid allocations per frame, return early.

Exceptions in this repo (library constraints override the skill):

- No runtime dependencies: no SWR (`client-swr-dedup`, `client-event-listeners` via `useSWRSubscription`). Dedupe global listeners with a plain module-level registry if needed.
- Not Next.js / no server code: `server-*`, `async-api-routes`, `next/dynamic`, `optimizePackageImports` don't apply. Keep SSR-safe anyway: no `window`/`document`/`AudioContext` access at module top level or during render (`server-no-shared-module-state`, `sideEffects: false`).

## npm publish boundary

- The library is published from `packages/react-eyedropper-picker` (`pnpm publish --access public`; `prepublishOnly` runs typecheck, test, build).
- Its `package.json` `files` whitelist is `dist`, `README.md`, `LICENSE` only. Keep it a whitelist. Never add `.npmignore`-style blacklisting instead.
- Agent tooling stays at the repo root and must never ship to npm: `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `skills-lock.json` (Vercel agent skills: `vercel-react-best-practices`, `web-design-guidelines`). Don't put agent files inside `packages/`.
- Verify the tarball before publishing:
  ```bash
  cd packages/react-eyedropper-picker && npm pack --dry-run   # expect only dist/, README.md, LICENSE, package.json
  ```
