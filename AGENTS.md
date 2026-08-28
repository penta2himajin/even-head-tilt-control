# even-head-tilt-control

## Overview

Even G2 Even Hub plugin: bind head gestures (IMU) to four touch controls and fire `control: …` when the bound gesture is detected after finger release. Phone WebView mirrors bindings and logs. Deskless verification via `@penta2himajin/even-deskless` (L0 + L2a).

## Project Structure

```
src/
  main.ts           # Hub bridge, event loop, IMU + long-press binding
  gesture.ts        # Pure IMU classification + persistence parse/serialize
  hub-page.ts       # ListContainer page builder
  phone-ui.ts       # Phone mirror DOM
  mock-imu.ts       # ?mockImu=1 deskless injection
  constants.ts      # Thresholds, IDs
docs/               # handoff / i18n (from templates)
app.json            # com.pentalab.head-tilt-control
```

## Development Setup

```bash
npm ci
git config core.hooksPath git-hooks
```

Node 20+. Global `@evenrealities/evenhub-simulator` is pulled as devDependency; L2a uses `even-deskless verify-l2a`.

## Build & Test

```bash
npm run verify:deskless   # typecheck + vitest + simulator smoke
npm run dev               # http://127.0.0.1:5173
npm run pack              # .ehpk
```

Log `[head-tilt] ready` only after `createStartUpPageContainer`. Log `[head-tilt] bindings:` on load/save for deskless/agent inspection.

## Development Principles

- Keep IMU classification in pure functions (`gesture.ts`) with vitest coverage.
- Hub Simulator does not emit IMU; use `?mockImu=1` or `window.__headTiltInjectImu` for deskless IMU paths.
- List content changes require `rebuildPageContainer` (no in-place list updates).

## Architectural Boundaries

- Do not fork `@evenrealities/*` packages.
- Threshold constants in `constants.ts` are tuned on real hardware, not in simulator.

## Prohibitions

1. Do not require USB glasses or Even Hub login for `verify:deskless`.
2. Do not treat simulator IMU as hardware fidelity.

## Session Handoff

See `docs/handoff-protocol.md`. Label: `session-handoff`.

## Internationalisation

Follow `docs/i18n-policy.md`. User-facing: `README.md` + `README.ja.md`.

---

<!-- Common rules below this line apply to every project. -->

## Common Development Rules

### TDD (Red → Green → Refactor)

All implementation work proceeds in this cycle:

1. **Red**: write a failing test that captures the intended behaviour.
2. **Green**: write the minimum code that makes the test pass.
3. **Refactor**: tidy up while keeping tests green.

When a test fails, fix the production code — do not delete, skip, or weaken the test.

### Measure, Don't Conjecture

Base decisions on observed data, not assumptions.

### Git Conventions

- **Conventional Commits**: `feat:` `fix:` `docs:` `refactor:` `test:` `ci:` `chore:`.
- **Branch naming**: `cursor/<topic>-b9a8`, etc.
- **Trailer**: when an AI agent authors the commit, append a trailer crediting the agent.

### Pull Requests

- Always ready for review (never draft-by-default).
- One PR per workstream; reference handoff issues with `Closes #N` when applicable.

### Common Prohibitions

1. Do not delete, skip, or comment out existing tests.
2. Do not modify CI configuration without explicit instruction.
3. Do not weaken production code merely to make tests pass.
4. Do not commit credentials, API keys, signed URLs, or anything in `.env*`.
