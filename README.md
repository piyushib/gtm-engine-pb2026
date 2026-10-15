# GTM Unit Economics Engine

Traces every marketing dollar from **spend → channel → motion → cohort → retained gross profit**, and shows the unit economics at each hop. Same live model, two presentations: a dense **spreadsheet** for editing and comparison, and a **dashboard** for the narrative. On top of it sits a **heat sensor** layer that flags deteriorating unit economics *before* they cross a concerning level.

```bash
npm install
npm run dev     # http://localhost:3000
```

## The organizing idea

A dollar is not fungible. The same dollar produces a different lifetime value depending on which channel it buys and which motion the resulting customer lands in. So the model is built at **(channel × motion) stream grain** — 9 channels × 3 motions = 27 cohort streams — and aggregates *dollars*, never averages of ratios.

Three motions, each with its own ARPA, cost-to-serve and retention behaviour:

| Motion | ARPA/mo | Cost to serve | Character |
| --- | --- | --- | --- |
| Self-serve (PLG) | $140 | 6% | cheap to acquire, churns hard |
| Sales-assisted | $1,450 | 10% | the volume middle |
| Enterprise | $6,200 | 16% | expensive, retains and expands |

## What the model actually computes

**Saturation.** Each channel has a diminishing-returns response curve, `customers = K·spend / (spend + h)`, where `K` is the monthly ceiling and `h` is the spend level delivering half of it. The derivative `K·h/(spend+h)²` gives **marginal CAC** — the cost of the *next* customer, which is the only honest basis for allocation. Average CAC tells you what already happened.

**Fully-loaded vs paid-only CAC.** Spend is a four-part stack — media, people, content, tooling/AI. Ad platforms report CAC on media alone; the board cares about all four. The portfolio runs $3,074 paid-only against $9,179 fully loaded, a 3.0x gap. Human outbound is 93% people cost, which is why it looks fine on a media report and expensive on a P&L.

**Retention.** Churn starts at `monthlyLogoChurn` and decays toward `minMonthlyChurn` as a cohort seasons — ignoring survivorship understates LTV badly. Expansion and contraction accrue on surviving revenue. Channel quality multiplies the motion baseline, so an AEO-sourced enterprise logo and an outbound-sourced one are not the same asset at identical CAC.

**NRR decomposition.** The waterfall splits net dollar retention into churn, contraction and expansion. All three are measured on a **dollar-weighted** base (`dollarSurvival`), not the customer-weighted `logoSurvival` — mixing the two produces a decomposition that doesn't reconcile, and can render a negative contraction bar, because higher-ARPA motions retain differently.

**LTV.** Discounted cumulative gross profit per acquired customer over `ltvHorizonMonths`, net of per-motion cost-to-serve. Payback is interpolated within the crossing month, `null` if the cohort never pays back.

**Allocation optimizer.** Greedy: 600 increments, each handed to whichever channel has the highest marginal return, bounded to 40–200% of current spend so it can't propose deleting a channel. It scores each increment on *average* return across the increment rather than the point derivative, which otherwise overshoots into the flat part of a steep curve. It equalizes marginal returns — the textbook optimality condition — and at the seed values lifts GP/$1 from $0.81 to $0.88 at constant budget.

## Early warning: seeing it before it happens

A threshold alarm on CAC payback fires after the money is gone. The sensor layer exists to fire *before* that, so it reads each metric twice:

**Level** — which band the value sits in now (`amber` / `red` thresholds in `lib/sensors.ts`).

**Trend** — a least-squares fit over the last 14 days, extrapolated linearly to the threshold. A metric sitting comfortably inside its healthy band but projected to breach within 30 days is promoted to **`watch`**, the tier that does the actual work. Projections past 90 days are suppressed — a near-flat slope extrapolated four years out is false precision, not information.

Severity ramps `ok → watch → amber → red`. Only **escalations** notify; recoveries update the heat silently, otherwise a metric oscillating around a threshold would fire forever.

**The leading indicator is marginal return per dollar**, spend-weighted across channels. It degrades well before blended CAC does, because an average is dominated by the dollars already spent. If one number deserves a sensor, it's that one.

**Channel alerts are level-only and capped at one per channel** (the worst of its marginal-return and LTV:CAC checks). Nine channels × three checks is 27 alerts, and noise is how early-warning systems get ignored. At channel grain the question is already binary — at seed values four channels are flagged "the next dollar here destroys value," which the portfolio aggregate completely hides.

**Live tracker.** `lib/live.ts` advances the world a day at a time: small mean-reverting baseline drift per channel group, plus discrete **shocks** (a competitor entering an auction, cohort quality degrading) lasting 12–30 days. Degradation in real GTM arrives in lumps, not on a smooth ramp. Drift moves `saturation.h` (rising `h` = the same spend buys fewer customers = rising CAC) and churn, clamped against the seed so long runs can't wander into absurdity. The won/lost/expanded/cost event tape is narrated from the same drift that moves the model, so the activity feed and the economics cannot disagree.

History is appended inside the same store transaction that advances the day, so the trend fit can never miss a day or double-count one. The **Shock** button forces an adverse regime onto the largest unshocked channel — that's the fast way to exercise the alert path without waiting.

## Assumptions worth arguing with

Every number in `lib/seed.ts` is an assumption, not a measurement. Two deserve scrutiny:

**`salesEffortExponent` (0.80)** — how a channel's spend splits across its motions, as an exponent on ARPA. At `0`, spend follows customer count, so every motion in a channel has identical CAC, which badly understates enterprise acquisition cost. At `1`, spend follows revenue, so every motion has the same CAC:ARPA ratio, which erases the difference between motions entirely. In between says "bigger deals cost more to win, but sub-linearly." **Self-serve economics are more sensitive to this single number than to anything else in the model** — it is a slider in the UI for exactly that reason.

**Self-serve ARPA ($140)** — at the seed calibration self-serve runs 0.93x LTV:CAC blended, but that blend hides the real finding: Lifecycle/PLG loops return 2.27x and AEO 1.88x, while paid-search self-serve returns 0.52x and paid-social 0.25x. Product-loop and organic self-serve pays; *renting* self-serve customers does not.

The seed is calibrated to a ~$32M ARR hybrid B2B SaaS at $1.1M/mo: 15.2-month blended payback, magic number 1.15, 102% NRR, 80% GRR, 2.3x LTV:CAC. Deliberately not spectacular — a model that says everything is wonderful isn't useful for deciding anything.

## Swapping in real data

`lib/model.ts` is pure functions over `lib/types.ts` — no React, no fetching. Replace `lib/seed.ts` with a warehouse query returning `Channel[]` and `Assumptions` and nothing else changes.

What you need per channel: the four-part cost stack, motion mix, funnel conversion rates, retention per motion, and a saturation curve. The curve is the one thing you can't read directly off a dashboard — fit `K` and `h` to historical spend/customer pairs, ideally from periods where spend actually moved. Without real variance in spend, marginal CAC is guesswork and the optimizer is just restating your priors.

## Layout

```
lib/types.ts     domain model — the contract everything else depends on
lib/model.ts     the engine: saturation, cohorts, LTV, payback, NRR, optimizer
lib/seed.ts      synthetic seed — swap this for your warehouse
lib/sensors.ts   thresholds, trend fit, projected days-to-breach, severity
lib/live.ts      day-at-a-time simulation: drift, shocks, event tape
lib/store.ts     zustand state + memoized derived selectors
lib/format.ts    formatters, loose money parsing ("45k", "$1.2m"), color scales
components/      Workspace (view toggle) → SpreadsheetView | DashboardView
                 DollarFlow (the Sankey), ChannelDrawer (drill-down), charts/
                 LiveControls (the clock), AlertCenter (bell), AlertToasts
```

Spend cells are editable in the spreadsheet view at both channel and cost-line
grain; the entire model recomputes synchronously on every keystroke-commit.
