# GameShot — GameLift onboarding & build console

Coded prototype of the ★ flow in the Figma file
[Game lift](https://www.figma.com/design/iuHhpN85XtICrGOFgG3yQ8/Game-lift?node-id=0-1) (Page 1).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run build:share  # self-contained pages → dist-share/gameshot.html and gameshot-mac.html (MacBook frame)
```

Shareable link: https://claude.ai/artifact/46oWX71yc6nXUtnwufCWEo. The share build navigates in memory,
so the address bar doesn't change between screens.

**Stack:** Vite · React 18 · TypeScript · React Router 6 · CSS Modules · `lucide-react` (the icons used in Figma are Lucide).

## Screens ↔ Figma frames

| Route | Figma frame (node id) | What's interactive |
|---|---|---|
| `/onboarding/policy` | Foundation screen `4:118095` | Accept → step 1 |
| `/onboarding/upload` | Foundation screen `4:119222`, Uploaded `4:120770` | Drag & drop / file picker, remove file, show more, enable repo access. Continue unlocks once there's a file or repo access is on |
| `/onboarding/executables` | Uploaded `4:123868`, `4:126669` | Search, sort, select-all with indeterminate state, launch arguments |
| `/onboarding/compute` | Uploaded `4:129471` + modal `4:149060` | Recommended / Custom tabs; Continue opens **Create build** modal → creates build |
| `/builds/:id/versions` | build list `4:132805` | Search, sort, select, delete; "Run game session" needs exactly one selected version |
| `/builds/:id/optimize` | Optimization reco `4:145620` (redesigned) | AI recommendations with evidence, missing data, confidence, risk tier and approval route; approve per tier, reject with reason, roll back, re-analyze, change history |
| `/builds/:id/scale` | *(new, from the Scale Control spec)* | Live launch dashboard with a launch-day replay (T−60m → T+24h): state banner, CCU vs plan with forecast band, headroom/queue/cost meters, region table, AI recommendation cards (quiet, auto-executed, approval with countdown, conflicting options, auto-pending scale-down), earned-delegation prompt, post-launch review |
| `/builds/:id/scale/plan` | *(new)* | Launch plan editor: phases, expected curve (manual or AI-generated from comparable launches), capacity settings, projected cost, validation against guardrails, versioned arming |
| `/builds/:id/scale/simulate` | *(new)* | Five scenarios run through `logic/scaleSim.ts`; shows when caps are hit, how long a person has to respond, queue/headroom/cost results |
| `/builds/:id/scale/guardrails` | *(new)* | Limits and the three delegation tiers per action class |
| `/builds/:id/scale/audit` | *(new)* | Every automated and human action, filterable by phase and decision |
| `/builds/:id/policy` | *(new, not in Figma)* | Approval policy: auto-apply, cost limits, approvers, change windows, canary rules, expiry, with a live routing preview |
| `/builds/:id/sessions/:sid` | build list `4:142873` | Back, session tiles, recommendation card → Optimize |

`Sessions`, `Scale` and `Games` exist only as placeholders so the navigation works — they aren't in the ★ flow.

## Project layout

```
src/
  styles/tokens.css      ← design tokens, named after the Figma variables
  components/            ← reusable UI (Button, Tabs, DataTable, Modal, Card, Gauge…)
  screens/onboarding/    ← 3-step wizard
  screens/build/         ← build console (layout + tabs + session detail)
  state/                 ← wizard state (React context)
  data/mock.ts           ← all copy/data from Figma; each export notes its likely API endpoint
```

### Design tokens
Every color, size and radius comes from `src/styles/tokens.css`. Token names follow the
Figma variable paths (e.g. `sys/color/dynamic/on-surface` → `--sys-color-on-surface`), so a design
change in Figma maps to one line here.

### Wiring up real data
- Replace imports from `data/mock.ts` with fetch hooks; the shapes are typed in that file.
- `OnboardingContext` holds the wizard's answers in memory, so a page refresh loses them. Persist a draft on the server when the API exists.
- `TODO(design)` / `TODO(engineering)` comments mark the places that need a decision.

## AI recommendations

Sample recommendations live in `src/data/recommendations.ts`. Risk tier and approval route are **never stored**:
`src/logic/riskPolicy.ts` computes them from each recommendation's facts and the team's policy. The model's suggested
tier can raise the result, never lower it. State and the change history live in `src/state/RecommendationsContext.tsx`.
Buttons marked "(demo)" stand in for other people or the scheduler.

## Known gaps / open questions
- **Font:** Figma uses *Amazon Ember* (licensed, not bundled). The stack falls back to Inter → system UI.
  Self-host Ember under `public/fonts` if you have the license.
- **Naming:** the product is called both "GameShot" and "GameLift" in the designs, and the first console tab is
  "Versions" in one frame and "Iterate" in another. The code uses **Versions**.
- **File icons:** in the Figma upload list a `.png` uses a microphone icon. The code uses an image icon.
- Not designed yet: Custom select (compute), Add custom executables, Create version, Deploy to a game,
  Connect to host, policy Cancel.
