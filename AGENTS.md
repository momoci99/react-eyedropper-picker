# AGENTS.md

pnpm monorepo for the `react-eyedropper-picker` npm library (a React color picker that supports the native EyeDropper API).

## Layout

```
packages/react-eyedropper-picker   # the published npm library (tsup → ESM + CJS + d.ts)
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
- `react` is a peer dependency (`>=17`). Don't use React APIs newer than 17 in library code without bumping the peer range. Keep the library free of runtime dependencies.
- `sideEffects: false`: no top-level side effects in `src/`.
- EyeDropper API is not available everywhere (Chromium only, not in jsdom). Guard with `isEyeDropperSupported`; mock it in tests.
- Changes to `src/index.ts` exports are public API changes; call them out.

## npm publish boundary

- The library is published from `packages/react-eyedropper-picker` (`pnpm publish --access public`; `prepublishOnly` runs typecheck, test, build).
- Its `package.json` `files` whitelist is `dist`, `README.md`, `LICENSE` only. Keep it a whitelist. Never add `.npmignore`-style blacklisting instead.
- Agent tooling stays at the repo root and must never ship to npm: `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `skills-lock.json` (Vercel agent skills: `vercel-react-best-practices`, `web-design-guidelines`). Don't put agent files inside `packages/`.
- Verify the tarball before publishing:
  ```bash
  cd packages/react-eyedropper-picker && npm pack --dry-run   # expect only dist/, README.md, LICENSE, package.json
  ```
