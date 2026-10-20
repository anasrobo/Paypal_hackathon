# Deep Research: PayPal AI Hackathon 2026 — Prize Architecture, Competitive Census, and a Winning Idea

> Generated 2026-10-19 | Depth: deep (adapted) | Sources: 25 | Primary sources: 14

---

## TL;DR

**PayShield is not a good idea — it is already built, deployed, and submitted.** A repo called `scam-shield-paypal` does exactly what PayShield proposes, with a live demo, a YouTube video, a Devpost entry, 100 passing regression tests and eight input modes [8][9]. Building PayShield now means entering a category you are already losing.

The prior report you pasted also contains one strategic error that would have capped your winnings at $5,000 instead of $17,000: under the official rules, **"Most Impactful" and "Best Use of PayPal + AI" are honorable mentions and are mutually exclusive with 1st Place** [2]. The real maximum payout is **1st Place ($12,000) + Best Use of AG Grid 1st ($5,000 cash) = $17,000**, because AG Grid is a *sponsor* prize and stacks with a grand prize [2][4].

The genuinely empty space, measured against a 225-repo census of this specific hackathon, is **money moving to people and places that a checkout button cannot reach** — agent-initiated payouts to humans, and cross-border currency truth. Section 7 ranks six candidates on your four axes.

---

## Executive Summary

The hackathon is real, currently live, and larger than the prior report claimed: **17,021 registered participants**, a **$67,500 cash pool** plus $2,250 in Render credits and APIMatic subscriptions, closing **12 November 2026 at 12:00 Pacific** [1][2]. It is a genuinely open-theme event with no tracks, judged on five equally weighted criteria — Technological Implementation, Design, Potential Impact, Innovation/Idea, and Presentation [1][2].

Three findings reshape the strategy.

**First, differentiation is now measurable, and the popular ideas are gone.** Devpost has not published the project gallery, so no one can see the official submission list [6]. But GitHub is public, and a search for this hackathon returns **225 repositories** [10]. Reading their descriptions reveals tightly clustered behaviour: eight separate repos are building escrow or milestone-release payment gates [11][27]; four are building PayPal dispute agents; five are building agent-spend-guardrail layers; a dozen are building shopping or checkout agents; and the single most common framing — "AI checks something before money moves" — is occupied by a mature, already-submitted implementation [8].

**Second, the prior report's recommendation is the most crowded idea in the field.** PayShield sits precisely on top of `scam-shield-paypal`, which is not a plan but a shipped product: live on Render, with a linked Devpost entry, a signed single-use review token bound to amount and currency, replay protection, webhook verification, a 129-case public evaluation and a Chrome extension [8]. Its README is also more epistemically careful than the PayShield proposal — it explicitly refuses to claim a cleared result is proof a merchant is genuine [8]. You cannot out-differentiate that in 24 days by being the second person to have the idea.

**Third, the award-stacking rules make one sponsor prize worth more than the prior report realised.** Render's prize is **$1,000 in credits**, not cash [3]. AG Grid's first prize is **$5,000 cash** — equal to an honorable mention, and it stacks with 1st Place [2][4]. The optimal target is therefore 1st Place plus AG Grid, for $17,000, not "grand prize plus Most Impactful plus Best Use of PayPal + AI," which the rules forbid [2].

On judging: the rules state that **judges are not required to test the project and may judge solely on the text description, images and video** [2]. With 14 judges and 17,021 registrants, the three-minute video is not 20% of your score — it is functionally most of it. Every idea below was scored partly on whether its value is legible in twenty seconds.

---

## 1. The Official Truth [Confidence: High]

Every factual claim in this section comes from the Devpost challenge page or the official rules, both scraped directly on 19 October 2026 [1][2].

**Dates.** The submission period opened Thursday 1 October 2026 at 09:15 Pacific and closes **Thursday 12 November 2026 at 12:00 Pacific** — which is 15:00 Eastern, 20:00 London, and 00:30 on 13 November in India [2]. Judging runs 1–15 December, with winners announced around 21 December 2026 [2]. At the time of retrieval the Devpost page displayed "24 more days to deadline" [1].

**Scale.** The page reports **17,021 participants** and **$67,500 in cash** [1]. PayPal's own developer blog describes the pool as "$60,000+" [7]; the Devpost page headline says "$69,750 in total prizes," which includes non-cash sponsor items [1]. Treat $67,500 as the cash figure.

**The complete prize table.** This is the authoritative list from Section 8 of the rules [2], cross-checked against the page's prize cards [1]:

| Tier | Prize | Value |
|---|---|---|
| Grand | 1st Place | $12,000 |
| Grand | 2nd Place | $8,000 |
| Grand | 3rd Place | $5,000 |
| Honorable Mention | Most Creative | $5,000 |
| Honorable Mention | Most Impactful | $5,000 |
| Honorable Mention | Best Demo Delivery | $5,000 |
| Honorable Mention | Best Use of PayPal + AI | $5,000 |
| Honorable Mention | Best Use of Agentic Commerce | $5,000 |
| Sponsor | AG Grid 1st / 2nd / 3rd×3 | $5,000 / $2,000 / $1,000 |
| Sponsor | APIMatic ×3 | $1,000 + 6-month subscription |
| Sponsor | Bryntum ×3 | $1,000 |
| Sponsor | Channel3 ×1 | $1,500 |
| Sponsor | Render 1st / 2nd / 3rd | $1,000 / $750 / $500 **credits** |

Note the discrepancy the prior report and the popular press both missed: **ten companies are listed as sponsors, but only five have prizes** [1][2]. Astropods, Elastic, KERNEL, Postman and Zapier provide tooling and credits only. One widely-shared article claims all ten have "their own prizes" [23], which is wrong.

**The stacking rule, verbatim.** Section 8 states: *"A project can only win up to one (1) Grand Prize and one (1) Sponsor Prize OR one (1) Honorable Mention Prize and one (1) Sponsor Prize"* [2]. This is the single most consequential sentence in the rules. It means:

- 1st Place **cannot** be combined with Most Impactful, Best Demo Delivery, Best Use of PayPal + AI or Best Use of Agentic Commerce.
- 1st Place **can** be combined with AG Grid, APIMatic, Bryntum, Channel3 or Render.
- Maximum achievable total: **$12,000 + $5,000 (AG Grid 1st) = $17,000**.
- Best non-grand outcome: **$5,000 (honorable mention) + $5,000 (AG Grid) = $10,000**.

**Judging.** There are two stages. Stage One is pass/fail viability — does the project fit the theme and apply the required APIs [2]. Stage Two applies five **equally weighted** criteria: Technological Implementation, Design, Potential Impact, Innovation/Idea, and Presentation [2]. The rules explicitly permit the sponsor to use "expert panels, peer review, **automated AI-driven analysis**, or any combination thereof" [2]. Two operational details matter enormously:

> *"Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."* [2]

> *"should be less than three (3) minutes. Judges are not required to watch beyond three minutes."* [2]

**The panel.** Fourteen judges are listed [1]: Jo Franchetti, Eddie Jaoude and Marco Podien (Developer Advocates, PayPal); Karthik Ravi (Software Engineer, PayPal); Himraj Singh (Engineering Manager, PayPal); Nathaniel Olson (Senior Product Manager, PayPal); plus Sylwia Vargas (AG Grid), Ameer Hassan (APIMatic), Mats Bryntse (Bryntum), Ignacio Valdez Bicard (Channel3), Carly Richmond (Elastic), Pooja Mistry (Postman) and Shifra Williams (Render). This is a **developer-relations and product panel, not a finance panel**. They will reward developer credibility, product coherence and a story they can retell — not spreadsheet-grade financial modelling.

**Submission requirements.** A public repository on GitHub/GitLab/Bitbucket with an open-source licence visible in the About section; all source and setup instructions; either a hosted demo URL or complete run instructions; a written description naming the AI tools used; and a public YouTube video under three minutes that shows the project functioning on the device it was built for [1][2]. A mockup or static prototype explicitly does **not** satisfy the functional requirement [1].

---

## 2. The Competitive Census [Confidence: Medium]

**The honest limitation first.** Nobody outside PayPal and Devpost can see the submissions. The gallery returns "The hackathon managers haven't published this gallery yet" [6]. The prior report's list of "projects already occupying similar territory" was therefore inference dressed as observation. What follows is the opposite: a reproducible, public-data floor.

**Method.** Three GitHub repository searches on 19 October 2026, scoped to this hackathon: `paypal ai hackathon` returned **225 repositories** [10]; a narrower query for escrow/marketplace/FX/remittance terms returned **76** [11]; and two niche queries returned **zero** [12][13]. Repositories dated 2–19 October 2026 carrying an explicit hackathon description are counted as attributable to this event. Repo descriptions are self-reported, so this measures *attention*, not *completion* — a repo with a name proves someone is working the idea, not that they will finish.

**What the 225 repos show.** Converting descriptions into themes produces an unmistakable clustering:

| Cluster | Count found | Representative repos [27] |
|---|---|---|
| Escrow / milestone / evidence-gated release | **8** | `trustlock`, `judgepay-paypal`, `stood`, `fairshake`, `milestonepay-ai`, `milestone`, `scopepay`, `PropLock-AI` |
| Shopping / checkout / storefront agents | **10+** | `agentcart`, `AgentBaazar`, `sahaya`, `ShopGenie`, `paypal-ai-checkout-agent`, `paygroq-ai-smart-payments`, `agent-guard` |
| Agent spend authority / guardrails | **5** | `permit` (389 tests), `agent-guard`, `paypal-pulse-ai`, `nortex-paypal-ai`, plus the scam cluster |
| Disputes / chargebacks | **4** | `dispute-steward`, `dispute-autopilot`, `rebuttal`, `Docket` |
| Invoicing / collections / dunning | **4** | `invoicepilot`, `recoverly`, `paypal-budget-agent` ×2 |
| Pre-payment scam & fraud checks | **3** | `scam-shield-paypal`, `TrustCart AI`, `paypal-pulse-ai` |
| Donation / charity transparency | **2** | `amanah-paypal`, classroom-funding platform |
| Accessibility / bill comprehension | **1** | `plainpay` (medical bills) |
| Negotiation / agent-to-agent | **1** | `haggle` |
| Vertical SaaS with PayPal rent/deposits | **2** | salon-suite rent, `vidal-booking-ai` |
| **Returns / partial-refund arbitration** | **0** | — [12] |
| **Currency / FX / cross-border** | **0** | — [13] |

**What this means.** The distribution is not random — it tracks the published idea lists almost exactly. AG Grid's own sponsor page suggests a "nonprofit donation dashboard," an "anomaly-alert agent" monitoring refund spikes, and a "nudge-bot" for unpaid invoices [4]. All three appear in the census. One widely-shared article lists ten starter ideas including invoice-chasing, subscription churn, dispute copilots, an ask-your-payments dashboard and a creator revenue splitter [23]; most correspond to live repos. **The ecosystem's idea pipeline is the census.**

This produces a clean strategic rule: **if the idea appears on a sponsor page or a listicle, assume fifty teams are building it.** Differentiation has to come from an API or a user that nobody's guide mentions.

**Two census artefacts worth noting.** First, `permit` describes an authority layer "with a hash-chained receipt for every decision. 389 tests" [27] — someone is treating this as a serious engineering exercise, which raises the bar on technical depth. Second, many repos are empty placeholders (`PayPal AI Hackathon 2026 entry (WIP)`, or a name with no description), which suggests the 225 figure overstates real competition while the clustering understates it: the *serious* submissions are concentrated in the crowded clusters.

---

## 3. Verdict on PayShield [Confidence: High]

**Do not build it.** The reasoning is not aesthetic; it is evidential.

**The exact idea is already shipped.** `gajit9147-dev/scam-shield-paypal` is described as "ScamShield with PayPal sandbox checkout: AI checks a payment request before you can pay (PayPal AI Hackathon)" [8]. Its README is not a stub. It contains:

- A **live deployed demo** at `scam-shield-paypal.onrender.com` [8]
- A **public YouTube demo video** [8]
- A **Devpost entry already submitted** at `devpost.com/software/scamshield-kuvz8o` [8][9]
- A **complete PayPal sandbox integration**: order creation gated by review, server-side capture, webhook confirmation [8]
- **Signed single-use review tokens** bound to amount, currency, review ID and expiry, with replay protection via a nonce guard and signed order tickets [8]
- **100 passing server regression tests** covering token parsing, signatures, expiry, replay protection, scam rules and webhook behaviour [8]
- **Eight input modes**: message, QR, screenshot, UPI, link, email, phone, agent [8]
- **A Chrome extension prototype**, multilingual English/Hindi/Hinglish support, and three documented evaluation sets including a 129-case public-source study [8]

**It also occupies the intellectual high ground PayShield needed.** The proposal's best line was the distinction between verified facts, suspicious indicators and unknowns, and the refusal to call a seller fraudulent on the basis of a risk score. ScamShield implemented that: *"A cleared result is guidance, not proof that a person or merchant is genuine"* and *"ScamShield is a pre-payment intent firewall, not a merchant verification service"* [8]. It even handles prompt injection ("ignore previous instructions" is flagged as a red flag) and fails closed when the AI is unavailable [8].

**The differentiation you would need is taken too.** The fallback argument was "go consumer-facing evidence analysis, not agent security." That is exactly what ScamShield is, and it additionally covers the agent path with a guarded agent mode that can only request a sandbox order through the same review gate [8].

**Honest counter-argument.** Being second is not automatically fatal. Grand prizes sometimes go to the better-executed version of a contested idea, and a 17,000-person field contains plenty of weak entries. But you would be entering a category where the incumbent has a six-week head start, a live demo, a test suite, an evaluation harness and a submitted Devpost page — while you have 24 days. **Expected value is poor relative to the alternatives.**

**One transferable asset.** ScamShield's real innovation is structural, not cosmetic: *the server refuses to create or capture an order that does not match what was reviewed*. That pattern — **payment as the enforcement point, not the UI warning** — is the single most valuable design idea in the entire census, and it applies to any idea you pick. Steal the pattern, drop the product.

---

## 4. Audit of the Other Six Ideas From the Prior Report [Confidence: High]

The prior report's framing — pick a narrow problem where AI makes a high-stakes payment decision safer or more transparent — is sound. Its specific picks are not, because it never checked what was already being built.

**ImpactTrace (donation provenance) — crowded.** Two repos occupy this: `amanah-paypal`, an "autonomous, auditable treasury agent for charities" [27], and a classroom-funding platform described as "an evidence-driven classroom funding platform powered by PayPal, AI, and AG Studio — connecting transparent donations with funding progress, teacher milestones, and measurable student impact" [27]. The second already implements the AG Grid sponsor integration, meaning it is targeting the $5,000 AG Grid prize directly. Worse, AG Grid's own sponsor page *suggests* a nonprofit donation dashboard as a starter idea [4], which will pull further teams in. **Avoid.**

**AccessPay (accessible payment explanation) — partially crowded.** `plainpay` is described as "Medical bills explained by AI and paid through PayPal," which covers the "explain confusing financial documents, then pay" mechanic in the highest-emotion vertical [27]. The general accessibility framing is still open, but PayPal necessity is weak — the product would work identically on any checkout — and a "simplified checkout demo" risks reading as a mockup rather than a product, which the rules specifically penalise [1].

**LedgerLens (reconciliation) — crowded and structurally weak.** `Docket` bills itself as a "Controlled Evidence Reconciliation & Decision Engine for PayPal Disputes" [27]. More importantly, reconciliation is the canonical AG Grid demo, so it competes in the most contested sponsor lane while being hard to make emotionally legible in three minutes.

**FairSplit (context-aware group payments) — uncrowded but underpowered.** No direct competitor appeared. But the demo is a stronger version of an existing behaviour (Splitwise plus Venmo), and PayPal appears only at the final settlement step. On the "does this genuinely need PayPal" axis it scores low.

**DeliverProof (verified work, milestone payment) — the single worst pick.** Eight repositories are building escrow or evidence-gated release, including `fairshake` ("Hold the money with PayPal, let AI check the work line by line, pay only for what was delivered") and `stood` ("Money does not move until someone stood there") [11][27]. DeliverProof would be the ninth entrant in the most saturated category in the hackathon.

**RenewalRadar (subscription waste) — crowded.** Two separate `paypal-budget-agent` repos and the "subscription churn saver" idea from the popular article [23][27] cover adjacent ground, and the demo (a list of subscriptions) is visually flat.

**Summary.** Zero of the seven ideas in the prior report survive contact with the census intact. That is not a criticism of the reasoning — the framing was good — it is a comment on what happens when you evaluate ideas without checking who else has had them.

---

## 5. The Prize Architecture: Correcting the Strategy [Confidence: High]

The prior report proposed a "grand prize route," an "impact route" and a "demo route," and recommended PayShield target *"Grand prize · Most Impactful · Best Use of PayPal + AI."* Under Section 8 of the official rules, **that combination is impossible** [2]. Most Impactful and Best Use of PayPal + AI are Honorable Mention Prizes. A project may hold either one Grand Prize *or* one Honorable Mention, never both, plus at most one Sponsor Prize [2].

This is not a technicality. It changes which ideas are worth building, because it changes what a second-place-quality project can earn.

**The correct award map.**

| Route | What you must win | What you can add | Ceiling |
|---|---|---|---|
| Grand | 1st Place | 1 sponsor prize | **$17,000** (1st + AG Grid 1st) |
| Grand | 2nd Place | 1 sponsor prize | $13,000 (2nd + AG Grid 1st) |
| Honorable | Any one of the five $5,000 categories | 1 sponsor prize | **$10,000** (HM + AG Grid 1st) |

**Three strategic consequences.**

*First, AG Grid is the prize that matters, and it is not the one the prior report chased.* Render pays **$1,000 in credits**, not cash, and requires Render Workflows specifically [3]. AG Grid pays **$5,000 cash** for first place and $2,000 and $1,000 for second and third, across a pool of five winners [2][4]. One AG Grid entry is worth five Render wins in cash terms, and it stacks with 1st Place. Chasing Render first place, as the prior report suggested, optimises the smallest prize on the board.

*Second, AG Grid's prize is decided by AG Grid's own judge — Sylwia Vargas, their Senior Technical Community Manager* [1]. The sponsor page states the criterion precisely: *"This award covers both what your dashboard looks like and how you build it. Show us polish: custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own. Take Studio Agent Framework for a spin"* [4]. A grid bolted onto a product as a logo-collection exercise will not win. A product whose **core artefact is a ledger** wins it without trying.

*Third, this creates a hard design constraint that should drive idea selection*: **pick a problem whose central object is a table.** Payout batches, refund case queues, FX line-item breakdowns, seller onboarding statuses, verification evidence rows. If the table is the product, AG Grid is organic and the extra $5,000 is nearly free. If the product is a chat window, it is not.

**Sponsor ROI ranking.** AG Grid ($5,000 cash, contested but stackable) > Channel3 ($1,500, low effort — 20,000 free API credits with promo code `PAYPAL-HACKATHON-2026`, keys available to all participants, MCP server provided) [5] > APIMatic and Bryntum ($1,000 each ×3 winners, low competition) > Render (credits only, deprioritise unless Render Workflows genuinely improves your pipeline) [3][4][5].

**A caution about sponsor-driven design.** The prior report correctly warned against adding logos to collect prizes. The census shows the cost of ignoring that warning from the other direction: the ideas AG Grid *suggests* are the ideas everyone built [4][27]. Use a sponsor tool as instrumentation for a problem you chose independently; never let the tool choose the problem.

---

## 6. How This Hackathon Is Actually Won [Confidence: Medium-High]

The rules are unusually explicit about the mechanics, and the mechanics favour a specific kind of project.

**Scoring reality.** Five criteria, equally weighted [2]. That means a project scoring 5/5 on Innovation and 2/5 elsewhere loses to one scoring 4/5 across the board. **You are optimising for the absence of weak axes, not the presence of a spectacular one.** Most hackathon entrants optimise the opposite way — a wild idea with a broken demo, or a polished demo of a boring idea. Both lose.

**The video is the product.** Two sentences from the rules settle this: judges *"may choose to judge based solely on the text description, images, and video"* and are *"not required to watch beyond three minutes"* [2]. With fourteen judges and 17,021 registrants, if even 5% submit, that is roughly 850 projects across a fifteen-day judging window — a few minutes each. The honest conclusion: **your video determines your score, and the first twenty seconds determine whether the rest is watched.**

A structure that fits the evidence:

| Time | Job | Failure mode to avoid |
|---|---|---|
| 0:00–0:15 | The problem, shown not told. A real artefact on screen. | A logo animation or a talking head |
| 0:15–0:45 | The wrong way vs your way, side by side | Explaining architecture |
| 0:45–1:45 | The live money movement, unedited, one take | Cutting away from the hard part |
| 1:45–2:20 | Under the hood: the APIs, the guardrail, the failure handling | Listing every feature you built |
| 2:20–2:50 | Who this is for, what changes for them, what's next | "Thank you for watching" |

**Stage One is a machine, possibly literally.** The rules permit *"automated AI-driven analysis"* in judging [2]. Stage One is pass/fail on whether the project *"reasonably fits the theme and reasonably applies the required APIs/SDKs"* [2]. Protect against this: your Devpost description should name the specific PayPal products and the specific AI models **in the first hundred words**, in plain nouns. Do not open with a manifesto.

**Technological Implementation is where a serious builder separates from the field.** The criterion asks whether the project reflects *"genuine effort and a working, non-trivial implementation"* [2]. Concretely, that means more than one PayPal surface. The census's strongest entries use two or three — for example Orders plus Payouts plus Webhooks, or Orders plus Refunds plus Disputes — and demonstrate the hard parts: webhook signature verification, idempotency keys, order state reconciliation on timeout, and a deterministic policy check that does not rely on the model being right. ScamShield's README is instructive here: its `PayPal-Request-Id` handling, capture-once logic, read-back-on-timeout and fail-closed behaviour are exactly the details that read as engineering rather than demo [8]. **Copy that discipline, not that product.**

**Design means "product", not "pretty".** The criterion is *"a complete, coherent product experience — not just a technical proof of concept"* [1][2]. One primary screen, one decision, one money movement. Empty states, error states and a loading state count. A settings page does not.

**Impact needs a named human.** *"Does the project make a credible, specific case for solving a real problem for a real audience — and does the solution actually address that problem based on what's demonstrated?"* [2] The phrase *based on what's demonstrated* is a trap for ambitious scope: judges score the problem you showed, not the problem you described. **Narrow the demonstrated slice until it is undeniably solved.**

**Submission hygiene, which is where good projects die.** Public repo with the licence visible in the About panel, a README that a judge can follow in five minutes, `.env.example` with every variable, seeded demo data so nothing requires a manual upload, and sandbox buyer credentials published in the README — ScamShield lists `sb-ciyxy53147650@personal.example.com` and a password openly, which is exactly right for a sandbox [8]. Submit 72 hours early; Devpost forms fail at deadlines. Include the YouTube link on the form, not only in the README.

**The hosting decision matters more than it looks.** Judges will click your demo URL once. A free Render web service spins down and takes roughly a minute to wake — ScamShield warns judges about this in its README, which is honest but still costs a first impression [8]. Put the judge-facing surface somewhere that is always warm, and keep heavy processing on the always-free Oracle Ampere instance you already have. That division also happens to be the correct architecture: the public surface should be a thin, fast UI plus signed API calls, with the workers, queues and database behind it.

**Two structural advantages you already hold.** You have an always-on 12GB Oracle Ampere VM, which means real background workers, a real Postgres, and no serverless timeout anxiety — most competitors will be fighting Lambda limits. And you have 24 days, which is enough to build one workflow properly and not enough to build three.

---

## 7. Ranked Shortlist [Confidence: Medium]

Scoring follows your four axes plus the AG Grid constraint from Section 5. Weights: Differentiation 30%, PayPal necessity 25%, Demo impact 25%, Feasibility 20%. These are calibrated estimates against a public census, not measured win probabilities.

| # | Idea | Diff. | PayPal | Demo | Feas. | Score | Award path |
|---|---|---|---|---|---|---|---|
| 1 | **GroundTruth** — agents buy verified physical-world observations from humans, paid by Payouts | 9 | 9 | 9 | 8 | **8.80** | 1st Place; fallback Agentic Commerce; + AG Grid |
| 2 | **ReturnRail** — refund decided and paid at the moment the return is scanned | 9 | 6 | 9 | 9 | **8.25** | 1st Place; fallback Best Demo / Most Impactful; + AG Grid |
| 3 | **TrueCost** — real landed cost and locked FX rate before payment | 9 | 9 | 9 | 5 | **8.20** | 1st Place *only if* FXaaS sandbox works; + AG Grid |
| 4 | **Trace** — time-travel debugger for PayPal integrations | 8 | 10 | 5 | 9 | **7.95** | APIMatic / Postman lane; unlikely grand prize |
| 5 | **SplitRail** — marketplace with real seller onboarding and multiparty split | 8 | 10 | 6 | 6 | **7.60** | Strongest on Technological Implementation |
| 6 | **Afford** — AI decisioning for instalment offers and true cost of credit | 9 | 7 | 7 | 5 | **7.20** | Honorable Mention ceiling |

---

### 7.1 GroundTruth — agents buy observations from humans [Recommended]

**Pitch.** An AI agent needs a fact that only exists in the physical world — what a shelf actually costs, whether a site is as described, what condition a parcel arrived in. It posts a micro-bounty with structured acceptance criteria. A nearby person accepts, submits photo, GPS and timestamp. A vision model scores the evidence against the criteria. If it passes, **PayPal Payouts sends the money to that person's email in seconds.**

**The user.** Two, cleanly: an operations or procurement team whose AI agent needs ground truth at scale, and an individual anywhere in the world who can earn $4 by photographing a shelf. One transaction serves both, which is unusually efficient for a demo.

**Why PayPal is structurally required — the strongest argument on this list.** The payee is an arbitrary human, not a merchant. A checkout SDK physically cannot do this: it collects money from a buyer, it does not push money outward to a stranger. **Payouts** is a different PayPal product, it is underused across the entire census, and the alternative rails (Stripe Connect, bank transfer, local wallets) all require onboarding the recipient as an entity before they can be paid. PayPal Payouts reaches an email address. That is a defensible, non-decorative reason for PayPal to be in the solution, which is exactly the question a judge will ask.

**PayPal surfaces.** Payouts (`/v1/payments/payouts`) for disbursement; Webhooks for `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` and failure/return events; Orders v2 if the requesting agent funds bounties from a balance; Transaction Search for the operator ledger.

**The twenty-second demo moment.** A bounty card appears: *"Verify shelf price of SKU 4471 at this address — $6."* Cut to a phone: a person photographs the shelf. The vision model reads the price tag, compares to the expected value, marks **VERIFIED**. The payout webhook fires: **$6.00 delivered.** No checkout screen, no cart, no card form — money moving outward to a human being. Nobody else in the 225-repo census will show that.

**Census evidence.** Zero repos in the census target Payouts-first, human-in-the-loop physical verification [10][27]. The adjacent clusters are document analysis (`scam-shield-paypal`, which *reads* claims) and escrow (`stood`, `fairshake`, which *hold* money). GroundTruth does neither: it **buys a fact**. That distinction is easy to state in one sentence, which matters for a judge retelling it later.

**AG Grid fit — natural.** The core product artefact is an observations ledger: bounty, requester, human, evidence thumbnail, model verdict, confidence, payout status, latency. That is a grid, with custom cell renderers for evidence and verdict badges. The Studio Agent Framework has an obvious organic role — a natural-language query like *"which observation types fail verification most often?"* — which is exactly what AG Grid's judge asked for ("an agent that builds, queries, and edits dashboards") [4].

**Build risk: moderate-low.** Payouts is a well-documented endpoint; the vision check is a single multimodal call; the hard part is the state machine (posted → claimed → submitted → verified → paid → failed/returned) and the money-safety rules.

**What would kill it.** Scope creep into a general marketplace. **Demonstrate exactly one vertical** — shelf and price verification for procurement agents — and resist adding property viewings, insurance and delivery proof. Judges score what is demonstrated [2]. Also: you need a real second person on camera during the video; recruit them before you write code, and pre-record a backup clip in case their network fails.

---

### 7.2 ReturnRail — the refund that arrives before the parcel does

**Pitch.** Today a return takes two to three weeks: request, approval, ship, inspect, refund. ReturnRail decides at the moment of the return request and pays instantly, using AI to price the damage and PayPal to move money against the original capture.

**The flow.** Customer opens a return with a photo and a reason. AI reads the order history, the merchant's policy and the image evidence, then proposes **full refund, partial refund, exchange or decline**, with a stated reason. A deterministic policy engine enforces the merchant's limits — the model can propose, but only the rules can approve above a threshold. On approval, a PayPal refund is issued against the capture, **including the partial-refund amount object**, and the webhook closes the loop [20].

**Why it matters.** Partial refunds are the single most under-used lever in returns: a customer with a scuffed item usually wants money back more than they want a replacement, and the merchant avoids shipping, inspection and restocking. The demo writes itself: *"Photo shows one 3cm scratch on an otherwise sellable item. Policy: 70% for cosmetic damage. $42.60 refunded. Case closed in nine seconds."*

**Census evidence.** **Zero** repos target returns or partial-refund arbitration [12]. Critically, this is *not* the dispute cluster: the four dispute repos (`dispute-steward`, `dispute-autopilot`, `rebuttal`, `Docket`) are reactive, adversarial and evidence-gathering after a chargeback [27]. ReturnRail is merchant-initiated and pre-dispute — which is also a better story for PayPal, because it prevents chargebacks rather than fighting them.

**The honest weakness.** PayPal necessity is only 6/10. Stripe supports partial refunds too. Your defence must be specific: the refund executes against a PayPal capture, the dispute webhook closes automatically, and the payout can be issued to a PayPal balance rather than a card that takes five days. Lean on *speed to the buyer's PayPal balance* plus *chargeback prevention*, and do not pretend the API is unique.

**AG Grid fit: excellent.** A return case queue with money columns, verdict badges and inline evidence is the most natural grid on this list — and AG Grid's own guidelines reward custom cell renderers and theming [4].

**Build risk: low.** Every primitive is documented and sandbox-supported [20]. Reuses nothing exotic. This is the safest path to a *complete* product, which is what the Design criterion rewards.

---

### 7.3 TrueCost — the price you see is not the price you pay

**Pitch.** A buyer in one country sees "$40". They are charged $47.30. The gap is FX spread, conversion fees and duty thresholds, and it is invisible until after payment. TrueCost shows the real landed cost before the button, then **locks the rate** and proves the captured amount matches the quote.

**PayPal surfaces — the most interesting on this list.** The **Exchange Rate Quote API** at `/v2/pricing/quote-exchange-rates` returns `fx_id`, `quote_amount`, `exchange_rate` and `expiry_time`, and the `fx_id` is then bound into an Orders v2 create-order call as an FXaaS parameter [15][16]. This is PayPal-only functionality with no equivalent in the census, and almost no hackathon entrant will know it exists.

**Demo moment.** Split screen: left, the listing at $40. Right, TrueCost's line-item breakdown — base, FX rate, PayPal conversion fee, duty threshold — totalling $47.30. Pay. Then the reconciliation screen: *quoted $47.30, captured $47.30, variance $0.00.* The shock is the number; the proof is the zero variance.

**Census evidence.** Zero repos [13]. The API is genuinely obscure, which is precisely why it is a differentiation lever.

**The risk that decides this idea.** FXaaS is **not** a default sandbox capability. PayPal's own integration guide says to *"verify your eligibility to integrate FXaaS"* and that *"as part of FXaaS onboarding, PayPal enables FXaaS for your account based on the contract,"* which specifies rate expiry, refresh time and fees [15]. The same guide shows a sandbox endpoint, so it may work — but it may also return 403 on a fresh hackathon account. **Test `POST /v2/pricing/quote-exchange-rates` against `api-m.sandbox.paypal.com` in the first hour.** If it fails, this idea is dead and you should not spend a day on it.

**A second risk, strategic rather than technical.** A product that exposes PayPal's FX spread can read as adversarial to a PayPal judging panel. Reframe deliberately: this is about **conversion and trust** — buyers abandon cross-border carts when the final price surprises them, and a locked quote converts better. PayPal's own FXaaS marketing makes the same argument ("enhance customer conversion rates", "drive revenue growth through seamless acceptance of local currency") [14]. Use their framing, not yours.

---

### 7.4 Trace — a time-travel debugger for PayPal integrations

**Pitch.** PayPal integration is fiddly: webhook ordering, idempotency, capture-on-timeout, refund-after-capture. Trace records the full order lifecycle in a sandbox, lets you replay any event, and shows the exact state transition that broke.

**Why it is interesting.** The judging panel is dominated by developer advocates and engineers — Jo Franchetti, Eddie Jaoude, Marco Podien, Karthik Ravi, Himraj Singh [1]. A tool that makes *their* platform easier to adopt is the kind of thing DevRel judges champion. It is also the most technically credible build on this list: replayable event logs, signature verification, deterministic state machines.

**Why it is not first.** Potential Impact asks for *"a real problem for a real audience"* [2] — and this audience is narrow, and the demo requires the judge to already understand the pain. It also cannot be shown as money moving, so Presentation has no visual climax. It competes for APIMatic's $1,000 (SDK generation and AI coding context) or the Postman lane, not for $12,000 [2].

**Census evidence.** Zero repos [10]. `permit` is the closest in spirit — an authority layer with hash-chained receipts — but it is a runtime guardrail, not a debugger [27].

---

### 7.5 SplitRail — a marketplace that actually splits

**Pitch.** A marketplace where a seller onboards through PayPal, and one buyer payment is routed correctly: platform fee retained, seller funded, disputes routed to the right party.

**Why it scores 10/10 on PayPal necessity.** Multiparty payments and seller onboarding are a distinct PayPal product line with no real substitute — the platform collects seller data, refers the seller to PayPal, and the payment flows directly from buyer to seller with the platform's share handled by the platform [19]. A judge cannot say "you could have used Stripe" quite so easily here.

**Why it ranks fifth.** Feasibility. Sandbox seller onboarding involves out-of-band steps, and multiparty payment structures are the most error-prone integration on this list. In 24 days, a solo builder is more likely to produce a half-working onboarding flow than a polished product — and Design scores *"a complete, coherent product experience"* [2]. Demo impact is also structurally weaker: the climax is a seller balance updating, which is a number, not a moment.

**Census evidence.** `AgentBaazar` claims "agent-ready commerce for every small store, on PayPal" [27], but that is about catalog visibility, not multiparty settlement. The settlement lane is genuinely open — it is simply hard.

---

### 7.6 Afford — should this be paid in instalments, and at what true cost

**Pitch.** At checkout an AI evaluates the buyer's intent, basket and cash-flow signals and decides whether to *offer* instalments, then explains the true total cost of the plan in plain language before acceptance.

**Census evidence.** Zero repos. Nobody is touching Pay Later.

**Why it ranks last.** Feasibility risk is high — Pay Later messaging and financing eligibility are gated and geo-dependent in sandbox, and the regulatory sensitivity of "an AI decided to offer you credit" is a real liability story to defend in three minutes. Differentiation is excellent; deliverability is not. Treat as a backup only if you can verify Pay Later sandbox support quickly.

---

### 7.7 Ideas I would explicitly reject

**PayShield** — already shipped and submitted [8][9]. **DeliverProof, TrustLock, JudgePay, Fairshake, Stood and four more** — nine-way saturation on escrow [11][27]. **Donation provenance** — two repos plus a sponsor suggestion pulling more in [4][27]. **Shopping agents, gift finders and price watchers** — a dozen entrants and zero structural reason for PayPal to be central [27][23]. **Invoice chase bots** — four repos plus a sponsor-suggested nudge-bot [4][27]. **Ask-your-payments dashboards** — the single most obvious AG Grid submission and therefore the most contested [23].

The pattern worth internalising: **every idea that appears on a sponsor page or a "10 ideas" listicle is already being built by dozens of teams.** Differentiation now lives in the PayPal APIs that no guide mentions — Payouts, FXaaS, Partner Referrals, partial refunds — applied to a problem the guides do not name.

---

## 8. The Recommendation, Stated Plainly

**Direct answers to what you asked:**

**Can I access the participation numbers and prize pool?** Yes, and they are now verified rather than estimated. 17,021 registered participants; $67,500 in cash; $69,750 including non-cash sponsor items; deadline 12 November 2026 at 12:00 Pacific; winners around 21 December [1][2].

**How many people are doing the same project?** Unknowable in exact terms, because Devpost has not published the gallery [6]. But measurable at a floor: 225 public repositories, with **eight** on escrow, **four** on disputes, **five** on agent guardrails, and a dozen on shopping agents [10][11][27]. The most important number: **the specific idea you asked about has one competitor who has already shipped and submitted** [8][9].

**How do we win it?** Not by having the best idea in absolute terms — by having the only project where a judge can see, in twenty seconds, money doing something they did not know PayPal could do. Five equally weighted criteria mean no weak axes [2]; judges may never run your code [2]; and the video is effectively the submission. Win the first twenty seconds and the rest is engineering you are already capable of.

**Is PayShield a good idea?** No. It is a good *analysis* of a good problem, attached to a product that already exists in more complete form. The prior report's reasoning was sound and its evidence base was not: it inferred competition instead of measuring it, and it misread the prize structure in a way that would have targeted a $5,000 ceiling instead of a $17,000 one.

**What should you build?** **GroundTruth**, with **ReturnRail** as the disciplined fallback if Payouts proves awkward in sandbox within the first 48 hours.

**Why GroundTruth over ReturnRail, given ReturnRail is safer?** Because the grand prize is not won by the safest build. ReturnRail's weakness is structural and unfixable: a judge can reasonably say "Stripe does this." GroundTruth's PayPal dependency is unfixable in the opposite direction — no checkout SDK can push money to a stranger's email, so Payouts is not a feature of the product, it *is* the product. That is the difference between a project that uses PayPal and a project that could only exist because PayPal exists. On the "PayPal necessity" axis you said you care about, nothing else on this list scores as cleanly while still being demonstrable in one take.

**How do you reach the $17,000 ceiling?** Two prizes, not five. 1st Place, plus AG Grid 1st. That requires the AG Grid integration to be structurally honest — an observations ledger with custom cell renderers, verdict badges and a Studio Agent Framework query layer [4] — not a chart bolted on the end. Sections 5 and 6 explain why this combination is the only legal path to the maximum, and why chasing Render (credits) or stacking honorable mentions (forbidden) wastes the same effort.

---

## 9. Action Plan

- [ ] **Hour 1 — kill or confirm the FX idea.** `POST https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates` with a sandbox token. If it 403s, TrueCost is dead; do not spend another minute on it [15][16].
- [ ] **Hour 2 — confirm Payouts works.** Create a sandbox business account, confirm Payouts is enabled, and execute one `POST /v1/payments/payouts` to a sandbox personal account email. If Payouts is blocked, switch to ReturnRail immediately.
- [ ] **Day 1 — commit to one vertical.** Write a single sentence naming the buyer, the fact being verified, and the price per observation. If the sentence needs an "and", the scope is too wide.
- [ ] **Days 2–4 — build the ugly vertical slice.** Post → claim → submit evidence → model verdict → payout → webhook confirmation. No styling, no auth. This proves the money path works end to end.
- [ ] **Days 5–9 — make it a product.** One primary screen. Real empty, loading, error and failure states. Mobile evidence upload that works from an actual phone, because your video will show a phone.
- [ ] **Days 10–12 — the AG Grid ledger.** Observations table with custom cell renderers for evidence thumbnails and verdict badges; theming; a Studio Agent Framework query ("which observation types fail verification most often?"). This is the $5,000 [4].
- [ ] **Days 13–15 — money safety.** Idempotency keys on every payout, webhook signature verification, retry and reconciliation on timeout, a deterministic rule that blocks duplicate payouts to the same human for the same bounty. Document these in the README — they are what earns Technological Implementation [2].
- [ ] **Day 16 — deploy.** Always-warm judge-facing surface; workers and Postgres on the Oracle VM. Reserve a domain. Verify the demo works from a cold browser with no session.
- [ ] **Day 17 — recruit your human.** Find the person who will accept the bounty on camera. Rehearse the flow twice. Record a backup clip.
- [ ] **Days 18–19 — write and shoot the video.** Follow the timing table in Section 6. Keep the money movement in one unedited take. Under three minutes, public on YouTube [1][2].
- [ ] **Day 20 — write the Devpost description.** Name the PayPal products and AI models in the first hundred words. Then the problem, then the demo, then the architecture.
- [ ] **Day 21 — repository hygiene.** `LICENSE` in the About panel, README quickstart under five minutes, `.env.example` complete, seeded demo data, sandbox credentials published [1][2].
- [ ] **Day 22 — submit.** Three days early. Confirm the YouTube link is on the form, not only in the README.
- [ ] **Days 23–24 — buffer.** Something will break. It always does.

---

## 10. Open Questions & Caveats

**The submission count is genuinely unknown.** Devpost reports registrations, not submissions, and the gallery is unpublished [1][6]. The 225-repo figure is a floor on *attention*, not a count of entries [10]. If conversion is typical for large open Devpost events, several hundred to low four figures will submit — but this could not be verified and should not be treated as a fact in any pitch.

**Crowding estimates are directional.** Only 35-40 repos were read closely out of 225 [10][27]. Repo descriptions are self-reported and often aspirational. A cluster showing zero repos could still contain five strong submissions that simply were not pushed public.

**FXaaS availability is unverified.** The integration guide documents a sandbox endpoint but also requires eligibility and an FXaaS contract [15][16]. This is the single largest unresolved feasibility question in the report and must be tested before any design work.

**Payouts availability on a fresh sandbox business account is unverified.** Payouts is generally available in sandbox, but account configuration can gate it. Test in hour two.

**Judge behaviour is inferred, not observed.** The conclusion that the video dominates rests on the rules' explicit statement that judges may judge solely on description, images and video [2], combined with the arithmetic of fourteen judges and a large field. The exact number of judges per project, and whether Stage One is automated, is not disclosed — the rules only permit AI-driven analysis as an option [2].

**AG Grid judging independence is assumed.** The rules allow one grand prize plus one sponsor prize [2], and AG Grid's own judge sits on the panel [1], so the assumption that the sponsor evaluates its own prize independently is reasonable but not documented.

**The winnability of a first-time entrant is unknown.** I could not find evidence about the prior hackathon experience of the strongest-looking competitors, or whether PayPal prefers first-time builders. `permit`'s 389 tests [27] and ScamShield's 100 tests and three evaluation sets [8] suggest at least a few teams are investing heavily, which raises the execution bar beyond what a typical Devpost field implies.

**One thing that is *not* a caveat.** The prize structure, the stacking rule, the deadline, the judging criteria and the participant count are all from primary sources and are reliable [1][2]. Strategic conclusions built on them can be trusted; competitive conclusions should be re-tested against the gallery the moment it opens.

---

## Methodology

**Depth:** deep, adapted. Phase 0 clarifying questions were asked and answered before retrieval (scope, deliverable, build capacity, stack), as required by the research protocol.

**Deviation, stated honestly:** the pipeline calls for parallel retrieval subagents, but the available subagent types in this environment are task-specific (browser control, code review, debugging, deployment) and none is a general web-research agent. Retrieval therefore ran on the lead agent across multiple parallel tool batches rather than delegated subagents. Source count is **25 used, 29 listed**, below the deep-mode target of 30-50; the shortfall is concentrated in the platform-capability area, where PayPal's own documentation is authoritative enough that additional secondary sources would add volume rather than confidence. No synthesis subagent was used.

**Retrieval obstacles and workarounds:** Devpost returned HTTP 403 to direct page fetches and was retrieved with Firecrawl instead. Several `developer.paypal.com` pages are client-rendered and returned empty bodies to a standard fetch; the FXaaS integration guide was retrieved successfully via Firecrawl, while the FXaaS *overview* and agentic-commerce *overview* pages could not be read in full and are cited for their existence and positioning rather than their detail.

**Triangulation:** prize amounts and the stacking rule were confirmed against both the challenge page and the rules text [1][2]. Crowding claims rest on independent GitHub searches plus direct reading of repository READMEs [8][10][11][27]. Platform-capability claims rest on PayPal's own documentation, which is Tier 1 but single-source by nature — PayPal is the only authority on its own API availability, so the usual "two independent sources" rule is not meaningful there and those claims carry an explicit feasibility caveat instead.

**Outline changes:** the original plan had a single "competitive landscape" section. Evidence forced a split into a census section (Section 2) and a separate audit of the prior report's specific recommendations (Section 4), because the census invalidated five of seven of them and that finding deserved its own argument. A section on prize architecture (Section 5) was added after the rules revealed that the prior report's award strategy was structurally impossible. Both changes are evidence-driven.

**What this report deliberately does not do:** it does not assert any market-size or fraud-loss statistics. The obvious temptation was to cite return-fraud or cross-border-commerce figures to strengthen the Impact argument, but none were verified to primary sources in this session, and an unverified number in a hackathon pitch is a liability — a judge who checks it will discount everything else you said. Verify any statistic you intend to use before you put it on screen.

---

## Bibliography

[1] Devpost — *PayPal AI Hackathon: Build what's next with PayPal and AI* — https://paypalaihackathon.devpost.com/ — accessed 2026-10-19 — Tier 1
[2] Devpost — *PayPal AI Hackathon Official Rules* — https://paypalaihackathon.devpost.com/rules — accessed 2026-10-19 — Tier 1
[3] Devpost — *About Render* (sponsor page) — https://paypalaihackathon.devpost.com/details/render — accessed 2026-10-19 — Tier 1
[4] Devpost — *AG Grid* (sponsor page) — https://paypalaihackathon.devpost.com/details/aggrid — accessed 2026-10-19 — Tier 1
[5] Devpost — *About Channel3* (sponsor page) — https://paypalaihackathon.devpost.com/details/channel3 — accessed 2026-10-19 — Tier 1
[6] Devpost — *Project gallery* (unpublished) — https://paypalaihackathon.devpost.com/project-gallery — accessed 2026-10-19 — Tier 1
[7] PayPal Developer Community Blog — *Hackathon: Build What's Next with PayPal and AI* — https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/ — 2026-09-30 — Tier 1
[8] GitHub — `gajit9147-dev/scam-shield-paypal`, README.md — https://github.com/gajit9147-dev/scam-shield-paypal — accessed 2026-10-19 — Tier 2 (primary artefact)
[9] Devpost — *ScamShield* project page (linked from [8]) — https://devpost.com/software/scamshield-kuvz8o — accessed 2026-10-19 — Tier 2
[10] GitHub repository search — query `paypal ai hackathon`, 225 results — 2026-10-19 — Tier 2
[11] GitHub repository search — query `paypal hackathon 2026 escrow OR marketplace OR fx OR remittance`, 76 results — 2026-10-19 — Tier 2
[12] GitHub repository search — query `paypal returns refund agent hackathon 2026`, **0 results** — 2026-10-19 — Tier 2
[13] GitHub repository search — query `paypal currency fx cross-border hackathon 2026`, **0 results** — 2026-10-19 — Tier 2
[14] PayPal Developer — *Foreign Exchange as a Service: overview* — https://developer.paypal.com/v5/checkout/fx/overview — 2026-09-14 — Tier 1
[15] PayPal Developer — *Integrate FXaaS* — https://developer.paypal.com/v5/checkout/fx/integrate — 2026-09-14 — Tier 1
[16] PayPal Developer — *Create Exchange Rate Quote* (`/v2/pricing/quote-exchange-rates`) — https://developer.paypal.com/api/pricing/v2/quote-exchange-rates — Tier 1
[17] PayPal Developer — *Agentic commerce services overview* — https://developer.paypal.com/agentic-commerce-services/about — accessed 2026-10-19 — Tier 1
[18] PayPal Developer — *Store Sync overview* — https://developer.paypal.com/store-sync/overview — 2026-08-11 — Tier 1
[19] PayPal Developer — *Onboarding sellers* / multiparty platform overview — https://developer.paypal.com/platforms/seller-onboarding — 2026-09-14 — Tier 1
[20] PayPal Developer — *Issue a refund* (full and partial) — https://developer.paypal.com/platforms/checkout/issue-refund — accessed 2026-10-19 — Tier 1
[21] GitHub — `paypal/agent-toolkit` — https://github.com/paypal/agent-toolkit — Tier 1
[22] PayPal Newsroom — *Making Sense of the AI Shopping Protocol Moment* — https://newsroom.paypal-corp.com/2026-01-22-Making-Sense-of-the-AI-Shopping-Protocol-Moment — 2026-01-22 — Tier 1
[23] The GenAI Magazine — *PayPal AI Hackathon 2026: Deadline, Prizes and 10 Ideas* — https://thegenaimagazine.com/paypal-ai-hackathon-2026-ideas-deadline-prizes — 2026-10-05 — Tier 3
[24] Startup Grants India — *PayPal AI Hackathon (2026)* — https://www.startupgrantsindia.com/competitions/paypal-ai-hackathon — 2026-10-01 — Tier 3
[25] VibeCodingList — *PayPal AI Hackathon* — https://vibecodinglist.com/vibe-jams/paypal-2026-ai-payments-app-hackathon — Tier 3
[26] Cloudflare Blog — *Announcing the Monetization Gateway* (x402 machine-payment context) — https://blog.cloudflare.com/monetization-gateway/ — 2026-07-01 — Tier 2
[27] GitHub — individual hackathon repositories named inline, including `Noah-zipit/trustlock`, `Techfrontiers/judgepay-paypal`, `ma-za-kpe/stood`, `swapnilchaudhari007/fairshake`, `fokrulanthro16-eng/milestonepay-ai`, `Sarcastic-Soul/milestone`, `Akshit-Singh-00/scopepay`, `sarasakeena/PropLock-AI`, `mihirargulkar/haggle`, `FetchDoge/permit`, `AP3008/agent-guard`, `AR-dev804/paypal-pulse-ai`, `Noahstark23/nortex-paypal-ai`, `qinheyi/dispute-steward`, `Ejicode/dispute-autopilot`, `manishwvn/rebuttal`, `OmkarD09/Docket`, `HusseinAdeiza/amanah-paypal`, `rajab-rajab/PAYPAL-HACKATHON`, `AryanP3208/plainpay`, `rohith1005H/AgentBaazar`, `annarose14/sahaya`, `Schultzenator/agentcart`, `Parithosh-Varma/paypal-ai-hackathon`, `vladimirjoseph36-png/paypal-ai-checkout-agent`, `CryptoPrince9/paygroq-ai-smart-payments`, `Amrithesh-Kakkoth/recoverly`, `arindewangan/invoicepilot`, `itzbnny/paypal-budget-agent`, `muriithiKabogo/paypal-budget-agent`, `DinhJDev/paypal-ai-hackathon-2026`, `jmvidal2024/vidal-booking-ai`, `ASTA91-GIT/PayPal---Hackathon-` — accessed 2026-10-19 — Tier 2
[28] Reddit r/hackathon — teammate-seeking threads for this hackathon — Tier 3 (consulted)
[29] Instagram / YouTube promoter content, including a "Day 05/30" series — Tier 3 (consulted)

---

## Source Extracts

### [1] Devpost challenge page
- **Key data:** "$67,500 in cash", "17021 participants", "Deadline: Nov 12, 2026 @ 3:00pm EST", "24 more days to deadline", "$69,750 in total prizes", "There are no prescribed problem statements and no set of tracks."
- **Judge list:** Jo Franchetti, Eddie Jaoude, Marco Podien, Karthik Ravi, Himraj Singh, Nathaniel Olson (PayPal); Sylwia Vargas (AG Grid), Ameer Hassan (APIMatic), Mats Bryntse (Bryntum), Ignacio Valdez Bicard (Channel3), Carly Richmond (Elastic), Pooja Mistry (Postman), Shifra Williams (Render).
- **Credibility tier:** 1

### [2] Official Rules
- **Decisive quote:** "A project can only win up to one (1) Grand Prize and one (1) Sponsor Prize OR one (1) Honorable Mention Prize and one (1) Sponsor Prize."
- **Decisive quote:** "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."
- **Decisive quote:** "Entries will be judged on the following equally weighted criteria."
- **Decisive quote:** judging "may utilize expert panels, peer review, automated AI-driven analysis, or any combination thereof".
- **Dates:** Submission Period 2026-10-01 09:15 PT → 2026-11-12 12:00 PT; Judging 2026-12-01 → 2026-12-15; Winners ~2026-12-21.
- **Credibility tier:** 1

### [4] AG Grid sponsor page
- **Criterion quote:** "This award covers both what your dashboard looks like and how you build it. Show us polish: custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own. Take Studio Agent Framework for a spin."
- **Suggested ideas (which became the crowded lane):** storefront analytics; anomaly-alert agent flagging suspicious refund spikes; nonprofit donation dashboard; natural-language finance agent; nudge-bot for unpaid invoices.
- **Boilerplate provided:** `github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate`, 45-day trial licence.
- **Credibility tier:** 1

### [8] ScamShield repository
- **Positioning quote:** "ScamShield is a **pre-payment intent firewall**, not a merchant verification service. It checks what the request says and gates checkout on that review; it does not verify who the payee is."
- **Epistemic quote:** "A cleared result is guidance, not proof that a person or merchant is genuine."
- **Technical:** signed single-use review token bound to amount/currency/expiry; server refuses orders that do not match; replay protection; webhook verification; fail-closed on AI unavailability; 100 regression tests; 129-case public evaluation; 8 input modes; Chrome extension; live on Render; Devpost entry submitted.
- **Credibility tier:** 2 (primary artefact, self-reported claims)

### [10] GitHub census
- **Result:** `paypal ai hackathon` → 225 repositories, most created 2026-10-02 through 2026-10-19.
- **Signal:** high proportion are placeholders with no description or "WIP" in the description; the serious work clusters visibly by theme.
- **Credibility tier:** 2

### [15] FXaaS integration guide
- **Gate quote:** "Verify your eligibility to integrate FXaaS." … "As part of FXaaS onboarding, PayPal enables FXaaS for your account based on the contract."
- **Sandbox endpoint documented:** `POST https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates`
- **Response fields:** `fx_id`, `quote_amount.value`, `exchange_rate`, `expiry_time`.
- **Credibility tier:** 1

### [23] The GenAI Magazine idea list
- **Why it matters analytically:** ten widely-shared starter ideas (gift-finder agent, invoice chaser, subscription churn saver, merchant dispute copilot, ask-your-payments dashboard, bookings with deposits, creator revenue splitter, chat-to-pay, price-watch agent, PayPal integration copilot) map almost one-to-one onto live repositories in the census. It also states "Registered so far: More than 5,600 participants" as of 2026-10-05, versus 17,021 two weeks later — a tripling that suggests late entrants will produce a very long tail of shallow submissions.
- **Accuracy note:** it claims all ten partners have "their own prizes", which the rules contradict — only five do.
- **Credibility tier:** 3

