# FairScale Submission Narrative — Kleos

## Core Positioning

**FairScore becomes the identity layer that determines how much influence a user's capital carries in belief markets.**

Kleos turns reputation into a persistent progression stat that directly affects market impact across every interaction. Users don't just bet—they express signals, build credibility, and sharpen instinct. FairScore is the gameplay stat that makes this possible.

---

## Key Points for FairScale

| Principle | Kleos Implementation |
|-----------|----------------------|
| **Reputation is persistent** | FairScore (Credibility) cached per wallet, synced across all positions |
| **Reputation is visible** | Credibility badge in header, tier labels (Bronze/Silver/Gold/Platinum) |
| **Reputation affects allocation** | Reputation multiplier (1→2.5x) directly scales effective stake |
| **Reputation affects influence** | Raw stake × reputation × timing × streak = influence on outcomes |
| **Reputation cannot be bypassed with capital** | No whale dominance—reputation ceiling caps influence; raw stake alone is insufficient |

---

## Product Language (User-Facing)

We use **product language**, not technical jargon:

- **FairScore** (technical) → **Credibility** (product)
- **Effective Stake** (technical) → **Influence** (product)
- "Whale" → "High credibility signal"
- "Stake" → "Conviction" / "Signal"

This framing positions FairScore as the identity layer users care about, not an opaque score.

---

## Influence Hierarchy

The correct order of impact:

1. **Raw stake** → commitment (floor)
2. **Reputation** → identity ceiling (FairScore drives 1–2.5x)
3. **Streak** → engagement reward (1–1.25x, hard cap)
4. **Timing** → tactical edge (1–1.15x for early signals)

**Rule:** Reputation changes influence more than streak. Whales cannot auto-win; grinders cannot dominate via streak alone.

---

## Abuse Prevention (Why FairScore Matters)

- **Micro-stake farming:** Qualifying stake threshold: `rawStake >= max(0.001 SOL, user_median * 0.2)`
- **Late safe streak:** Streak does NOT count if placed in final 10% of market window (t ≥ 0.9)
- **Streak dominance:** Hard cap 1.25x on streak multiplier
- **Multi-wallet farming:** Reputation tied to FairScore; new wallets = weak influence
- **Spam same market:** One position per market per user (enforced)

FairScore ensures reputation is the primary identity signal—not easily gamed, not bypassable with capital.

---

## Product Loops

1. **Daily Swipe Loop** — User opens app, swipes 3 markets, sees streak, leaves (< 30s)
2. **Result Reveal Loop** — Weekly ranking drop = content moment ("You gained influence", "Your signal beat X%")
3. **Identity Progression Loop** — Streak, credibility, influence growth (Profile = RPG stats)
4. **Social Proof Loop** — "High credibility signals leaning toward X" (not copy trading)

---

## What We're Building

We are **not** building prediction market UI.

We are building a **signal game** where users:
- Express conviction
- Build credibility
- Sharpen instinct

Language and motion matter more than charts. FairScore is the stat that makes credibility visible and consequential.
