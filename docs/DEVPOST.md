# Devpost submission copy

Everything below is ready to paste. The submission itself is a manual step —
**submit before 9 November**.

**Live demo:** https://groundtruth-ten-beta.vercel.app
**Repository:** https://github.com/anasrobo/Paypal_hackathon
**Video:** https://www.youtube.com/  ← *replace with your upload link*

---

## Project name

**GroundTruth** — agents buy verified physical-world facts from humans

## Tagline (one line, for the gallery)

An AI agent posts a bounty for a fact that only exists in the physical world. A
human proves it with a phone. A deterministic rule set decides. **PayPal
Payouts** sends the money.

---

## Description

*Paste this into the "About your project" box. The first hundred words name
the PayPal products and the AI model, because Stage One is a pass/fail screen
and those are the words it looks for.*

> **GroundTruth uses PayPal Payouts, PayPal webhooks, and a vision model, to
> let an AI agent buy a fact from a human.**
>
> An agent needs to know whether SKU 4471 is on the shelf at the store on
> Market Street, and whether the price tag reads $6.00. No amount of browsing
> answers that. A person standing in the shop can.
>
> So the agent posts a micro-bounty. A human nearby opens the link, accepts
> it, photographs the shelf with their phone, and the phone records a GPS fix
> and the time. A vision model reads the price tag. **A deterministic rule set
> — six rules, no model judgement — decides whether the evidence is good.** If
> it is, **PayPal Payouts** sends the money to that person's email, through a
> **signed PayPal webhook**, in seconds.
>
> This is the one thing a checkout SDK cannot do. Payouts is a different
> PayPal product: money *out*, to a stranger, for a fact. It is the product,
> not a feature bolted on.
>
> **The model never decides.** It contributes to two of the six rules and can
> only ever cause a rule to fail. A perfect model output with a capture 900 m
> from the store is rejected, and no payout row is created. That case is a
> test, not a claim.
>
> The demo: post a bounty, open the claim link on a phone, accept it,
> photograph a shelf, submit. Six rules go green. `PAID — $6.00 delivered`.
> No cart. No card form.

## Built with

| | |
|---|---|
| **PayPal** | **Payouts** (money out to a stranger), **webhooks** (signed, idempotent, replay-safe) |
| **AI** | a **vision model** that reads a price tag — advisory only, never the decision |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind v4, **AG Grid Community** |
| **Backend** | Node, raw SQL over `postgres.js`, Supabase Postgres + private Storage, deployed on Vercel |
| **Testing** | Vitest against a **real** Postgres, Playwright at 390 px and 1280 px |

## What we want to try next

- Swap the mock vision provider for a real multimodal model — the seam is one
  interface and one env var, and the gate does not change.
- Turn on the **sandbox** PayPal provider and pay a real person a real cent
  in a real sandbox account.
- Extend the same rule set to a second vertical: proof of delivery, or a
  property viewing. The vertical is deliberately one for now.

---

## Demo script

Three minutes, from [`docs/DEMO.md`](DEMO.md). The short version:

1. **The console** — post a bounty for SKU 4471 at $6.00.
2. **The phone** — open the claim link, accept, photograph a shelf.
3. **The money** — six green rules, `PAID — $6.00 delivered`.
4. **The ledger** — ask it *"show failed payouts"* in plain language.

**The backup clip** is recorded in advance. If the second person's phone fails,
the clip plays and the run continues.

---

## What the judges should look at

- **The eight money-safety invariants** in
  [`docs/INVARIANTS.md`](INVARIANTS.md). Each one is a mechanism, and each one
  has a test that fails if the mechanism is removed. A rejected bounty leaves
  **no** payout row at all.
- **The ops ledger** at `/ops`. AG Grid Community, the infinite row model, a
  custom theme, six custom cell renderers, and a natural-language layer that
  **refuses to guess** — an unknown phrase returns *"I did not understand"*
  with the supported intents, because a wrong filter is worse than no filter.
- **The commit history.** The bugs we hit and fixed are in the history, with
  the reason in each message.

---

## Before you submit — the checklist

- [ ] The video is uploaded and the link is in the submission form, **under
      three minutes**.
- [ ] The description above is pasted, and the first hundred words still name
      **PayPal Payouts**, **PayPal webhooks** and the **vision model**.
- [ ] The repository link points at `anasrobo/Paypal_hackathon` and is public.
- [ ] The About panel reads **GNU General Public License v3.0**. *(Verified:
      GitHub auto-detects it from the `LICENSE` file. Nothing to do.)*
- [ ] `https://groundtruth-ten-beta.vercel.app/api/health` returns
      `{"status":"ok","db":"up"}` **on the day you submit**. A free Supabase
      project pauses after seven days of inactivity; a daily keepalive cron
      prevents it, but check anyway.
- [ ] The demo works on a phone, on cellular data, with the camera.
- [ ] **Submitted before 9 November.** The deadline is 12 November, 12:00 PT,
      and the judging window is 1–15 December.
