# Mureeh Study Assistant — Frontend

> Mureeh doesn't simply tell students what to study. It manages their learning journey until they achieve their goal.

Production-grade Next.js frontend for the Mureeh learning-journey platform. Dark-first premium design system, feature-based architecture, typed service layer with swappable mock API, i18n + RTL ready.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript (strict)**
- **Tailwind CSS** with CSS-variable design tokens (dark/light, RTL)
- **TanStack Query** (server state) · **React Hook Form + Zod** (form state)
- **Framer Motion** (purposeful state animation) · **Recharts** (analytics)
- **lucide-react** icons · **next-themes**

## The journey model

Every surface maps to the spine:

```
Understand → Diagnose → Goal → Commit → Roadmap →
Execute → Measure → Correct → Master → Achieve
```

Product rules enforced in the UI:

| Rule | Enforcement |
| --- | --- |
| Goal 🔒 | Lock dialog + deliberate change-request flow (`/app/goal`) |
| Roadmap 🔒 | Approval step, lock banner, non-editable phases (`/app/roadmap`) |
| Execution 🤖 | Focus mode, adaptive daily loop (`/app/mission`) |
| Mastery 🧠 | Evidence grid: completion ≠ mastery (`/app/mastery`) |
| Failure 🔄 | Diagnosis + fixed recovery pipeline (`/app/recovery`) |
| Delay 📊 | "Delay recorded" insight cards, never punishment (`/app/behavior`) |
| Progress 🎯 | Movement toward goal, no points (`/app/progress`) |

## Architecture

```
UI (app/ routes)
 ↓
Feature components (features/*)
 ↓
Hooks — TanStack Query (features/*/hooks)
 ↓
Services — typed domain contracts (services/*)
 ↓
API layer — mockRequest ⇄ httpRequest seam (lib/api/client.ts)
 ↓
Backend (mock-db today; REST/Supabase later)
```

- `src/app/(marketing)` — landing page
- `src/app/(auth)` — sign-in / sign-up / password recovery / email verification
- `src/app/(onboarding)` — adaptive assessment → goal discovery + lock
- `src/app/(student)/app/*` — application shell: My Day, Mission, Goal, Roadmap, Progress, Learning, Recall, Tests, Mastery, Profile, Behavior, Insights, Mentor, Recovery, Achievements, Certificates, Notifications, Settings, Subscription
- `src/app/(guardian)/guardian` — guardian oversight view
- `src/components/ui` — design-system primitives (tokens only, no ad-hoc styling)
- `src/components/{layout,navigation,charts,feedback}` — shared composition layer
- `src/types/domain.ts` — domain models · `src/schemas` — Zod form schemas
- `src/mocks/data.ts` — typed mock data (mockStudent, mockGoal, mockRoadmap, mockDailyPlan, …)
- `src/lib/i18n` — dictionaries (en source of truth, ar with fallback), `useT()`, `<html dir>` sync

### Swapping mocks for the real backend

1. Implement REST handlers (or Supabase queries) matching `src/services/*` signatures.
2. Set `USE_MOCK = false` in `src/lib/api/client.ts` and route through `httpRequest`.
3. No component or hook changes required.

## Internationalization & RTL

- All copy goes through translation keys (`useT()`); no hardcoded strings in components.
- `ar` dictionary ships with the core journey vocabulary; missing keys fall back to English.
- Direction is handled with logical properties (`ps/pe/ms/me/start/end`) so RTL is layout-native.

## Accessibility

- Semantic landmarks, skip link, visible focus rings, ARIA roles for progressbars/timers/radiogroups
- State communicated by icon + color + label, never color alone
- `prefers-reduced-motion` neutralizes animation
- Keyboard-operable dialogs (focus trap, Escape), tabs (arrow keys), navigation

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
```
