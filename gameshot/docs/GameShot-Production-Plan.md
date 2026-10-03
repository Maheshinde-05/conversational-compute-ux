# GameShot: from prototype to production

A handoff for the engineers picking up the GameShot prototype (GameLift onboarding and build console).

- **Figma source:** [Game lift](https://www.figma.com/design/iuHhpN85XtICrGOFgG3yQ8/Game-lift?node-id=0-1) (Page 1, ★ row)
- **Code:** `maheshinde-05/conversational-compute-ux`, branch `claude/game-lift-designs-u1hyrh`, folder `gameshot/`
- **Live prototype:** https://claude.ai/artifact/46oWX71yc6nXUtnwufCWEo
- **MacBook presentation view:** https://claude.ai/artifact/CmguucuVjh4NhcKf5N1Pq7

---

## 1. What exists today

A clickable front-end prototype of the ★ flow in Figma, with sample data and no backend.

| Route | Figma frame (node id) | What works |
|---|---|---|
| `/onboarding/policy` | Foundation screen `4:118095` | Accept moves to step 1 |
| `/onboarding/upload` | Foundation screen `4:119222`, Uploaded `4:120770` | Drag and drop, file picker, remove, show more, enable repo access |
| `/onboarding/executables` | Uploaded `4:123868`, `4:126669` | Search, sort, select all, launch arguments |
| `/onboarding/compute` | Uploaded `4:129471` + modal `4:149060` | Recommended / Custom tabs, Create build modal |
| `/builds/:id/versions` | build list `4:132805` | Search, sort, select, delete, run game session |
| `/builds/:id/optimize` | Optimization reco `4:145620` | Recommendation rail, approve / reject with undo, sortable tables |
| `/builds/:id/sessions/:sid` | build list `4:142873` | Session tiles, recommendation card |

**Stack:** Vite, React 18, TypeScript, React Router 6, CSS Modules, `lucide-react` (the icon set used in Figma).

```
gameshot/src/
  styles/tokens.css      design tokens, named after the Figma variables
  components/            Button, Tabs, DataTable, Modal, Card, Gauge, LineChart…
  screens/onboarding/    3-step wizard
  screens/build/         build console and session detail
  state/                 wizard state (React context)
  data/mock.ts           all sample data; each export names its likely API endpoint
```

**Run it:**

```bash
cd gameshot
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run build:share  # self-contained pages for sharing (plain + MacBook frame)
```

---

## 2. Decisions to make first

These change the plan, so settle them before building.

1. **Backend.** Does the console call AWS GameLift directly, or go through a service of our own? Recommended: our own thin service, because the AI recommendations and onboarding steps aren't GameLift features.
2. **Users.** A few internal studios, or a public product? This decides the scope of sign-in, teams and billing.
3. **House stack.** If the engineering team has a standard stack, follow it. This plan assumes React + TypeScript, which the prototype already uses.
4. **Naming.** The designs say both "GameShot" and "GameLift". Decide which is the product name.
5. **Font.** Figma uses Amazon Ember, which needs a license. Until then the code falls back to Inter.

---

## 3. Make the design system the shared language

- **Split the repo into three parts:**
  - `packages/tokens`: colours, type and spacing
  - `packages/ui`: reusable components
  - `apps/console`: product screens

  The pieces already exist in `gameshot/src/`; this step mostly moves them.
- **Generate tokens from Figma.** Export variables with the Figma Variables API and build them with Style Dictionary into CSS variables and TypeScript. A colour change in Figma then becomes a pull request, with no hex values retyped by hand.
- **Use Storybook as the handoff surface.** Show every component in each state (default, hover, disabled, loading, error). Publish a Storybook preview on each pull request so design can approve UI changes without running code.
- **Use Figma Code Connect** to link each Figma component to its code component.
- **Add visual regression tests** (Chromatic or Playwright screenshots) to catch unintended visual changes.

---

## 4. Data layer

- **Contract first.** Write an OpenAPI spec. `data/mock.ts` already sketches the shapes and endpoints.
- **Mock the API with MSW**, using today's sample data, so the front end runs fully before the backend exists. Turn the mocks off at launch.
- **TanStack Query** for server data: caching, retries, loading states, refetching live data.
- **React Hook Form + Zod** for forms (Create build, launch arguments), for validation and error messages.
- **Generate a typed API client** from the OpenAPI spec so front end and backend can't drift apart.

---

## 5. The hard parts hiding in the flow

| Screen | What production needs |
|---|---|
| **Upload** | Game builds are gigabytes. Upload directly to S3 using presigned multipart uploads: resumable, with per-file progress. This is the biggest piece of engineering in the flow, and it needs designs for progress, failure and retry. |
| **Enable GameLift** | Granting access to S3 and ECR means creating an IAM role, usually through a CloudFormation quick-create link. Needs "waiting for permission" and "permission denied" states. |
| **Choose compute** | Show *why* this instance was recommended, and handle "no recommendation available". |
| **Session detail / Optimize** | Live data: poll every few seconds or push over WebSockets. Replace the prototype chart with Recharts or visx. |
| **Approve / Reject** | Approving changes real infrastructure and costs money. It needs a confirmation step, an audit log (who approved what, when), status tracking for the scheduled change, and rollback. |

---

## 6. Design work needed before production

For every screen, design:

- **Loading:** skeleton placeholders
- **Empty:** no builds yet, no sessions yet
- **Error:** upload failed, API down, permission denied
- **Edge data:** 200 versions, very long names, slow networks

Screens not designed yet (marked `TODO(design)` in the code):

- Custom select (compute)
- Add custom executables
- Create version
- Deploy to a game
- Connect to host
- Scale tab, Sessions tab, Games section
- Where Cancel on the policy screen leads

Inconsistencies found in the Figma file:

- The first console tab is "Versions" in one frame and "Iterate" in another. The code uses **Versions**.
- In the upload list, a `.png` file has a microphone icon. The code uses an image icon.

---

## 7. Quality from day one

- **On every pull request:** ESLint, Prettier, TypeScript, unit tests (Vitest + Testing Library), and an end-to-end Playwright test of the full flow (one already exists as a script).
- **Accessibility:** axe checks on every screen. The prototype already uses native buttons, labelled inputs and a native dialog; keep it that way.
- **Preview deploys:** every pull request gets its own link for design review.
- **Feature flags:** ship unfinished screens hidden.
- **Monitoring:** error tracking (e.g. Sentry) and basic product analytics on the onboarding funnel (where do people drop off?).

---

## 8. Roadmap

| Phase | Scope | Outcome |
|---|---|---|
| **0. Foundations** (about 1–2 weeks) | Repo split, tokens pipeline, Storybook, MSW mock API, CI, preview deploys | A base engineers can build on |
| **1. Onboarding** | Sign-in, S3 multipart upload, IAM permission step, Create build | A user can onboard a real build |
| **2. Console** | Versions, sessions, live session details | A user can run and monitor game sessions |
| **3. Optimize** | Recommendations, approve / audit flow, cost display | A user can act on recommendations safely |

Each phase ends with something clickable and shareable for review.

---

## 9. Where to start

1. Read `gameshot/README.md` and run the prototype locally.
2. Settle the decisions in section 2.
3. Start Phase 0 in this repo: restructure into packages, add Storybook and MSW, and wire up CI.
