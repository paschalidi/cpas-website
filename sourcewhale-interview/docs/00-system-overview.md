# SourceWhale Outreach — System Overview

> **TL;DR** — A reliable, auditable engine that schedules and sends multi-step recruiter
> outreach (email, SMS, manual LinkedIn) on a **per-candidate timeline**. It respects local
> working hours, **stops instantly** when a candidate replies or is re-qualified, survives
> edits/pauses mid-sequence, and is built to **never duplicate a message**. Architecture is a
> pragmatic **modular monolith on Postgres** with independently scaled worker pools.

| | |
|---|---|
| **Status** | Draft for review |
| **Scope** | Scheduling + sending of campaign outreach steps at scale |
| **Audience** | Eng interview panel |
| **Related RFCs** | 01 Data Model · 02 Scheduling · 03 Reliable Delivery · 04 Reactive Stop · 05 Versioning · 06 Channels · 07 Bulk & Lifecycle |

---

## 1. The problem in one paragraph

Recruiters set up an ordered **campaign** (e.g. Day 1 email → Day 3 follow-up → Day 7 LinkedIn →
Day 10 SMS) and apply it to many candidates. Each candidate then progresses **independently**
based on when they were added, their timezone, and whether they respond. The system must run this
chasing automatically while feeling "professionally and socially correct" — right time, no
duplicates, and an instant stop the moment a human signal says so. It must hold up under thousands
of recruiters, hundreds of campaigns each, millions of in-flight touchpoints, and bursty load.

The hard part is **not** sending messages (providers do that). It is **reliable, reactive,
per-entity scheduling under constant mutation** — and being able to prove what happened.

---

## 2. What the system CAN do

- **Run ordered, multi-channel sequences per candidate** with independent timing for each
  enrollment (timezone-aware, add-time-relative).
- **Send within local working hours** and spread sends across a jitter window to avoid robotic
  "09:00:00 sharp" blasts and provider spikes.
- **Stop outreach immediately** when a candidate replies / sends `STOP`, or a recruiter marks them
  *in process* / *not suitable* — with a late safety re-check so a stopped candidate is never sent to.
- **Absorb mutation mid-flight**: pause/resume (freeze-and-shift, no catch-up burst), edit copy or
  cadence (creates a new immutable version), and choose whether changes apply to in-flight candidates.
- **Handle large bursts**: add thousands of candidates via an async background job; the recruiter is
  notified on completion; first-step sends are spread, not dumped.
- **Treat LinkedIn correctly as human work**: a LinkedIn step becomes a recruiter task and the
  sequence waits on a human, then resumes.
- **Guarantee no duplicates and no lost sends** through an outbox + deterministic idempotency keys +
  reconcile-on-unknown.
- **Survive provider failure** with retries/backoff, per-provider circuit breakers, and a
  dead-letter path that surfaces failures rather than silently dropping them.
- **Be fully auditable**: every attempt is an append-only log row pinned to the exact campaign
  version and step that produced it.

---

## 3. What the system CANNOT (and will NOT) do — non-goals

- **Not a zero-race guarantee.** A reply landing in the same millisecond as a send may not be caught
  *before* that one send. We shrink the window to ~ms and log every outcome; we do **not** take
  per-candidate distributed locks to make it mathematically impossible (cost > benefit here).
- **Not real-time / sub-second scheduling.** Cadence is measured in hours/days; we accept
  **scheduler latency on the order of the poll interval** (seconds to a minute), not instant firing.
- **Not a message-content / deliverability product.** We don't do spam scoring, warm-up, inbox
  placement, or template A/B as part of this design.
- **No guaranteed email reply *understanding*.** We detect "a reply happened"; we do not classify
  intent ("interested" vs "out of office") — that's a pluggable signal, out of scope here.
- **No LinkedIn automation.** We never automate LinkedIn messaging; it is always surfaced as a
  manual task (respects the platform's lack of an API).
- **Never auto-resends a `sent` message.** Once an attempt is `sent`, that step is permanently done;
  only an explicit human action can create a new attempt.
- **Not UI/frontend design** and **not cloud/vendor-specific** — we reason about component behaviour,
  not specific products.

---

## 4. Key constraints we are designing against

| Constraint | Source | Design response |
|---|---|---|
| Send only in reasonable local hours | Social correctness | Snap `next_run_at` into candidate-local window at schedule time (RFC 02) |
| Predictable "9am local" spikes | Usage pattern | Per-enrollment jitter (~20 min) + downstream rate limiting (RFC 02/03) |
| Stop on reply / status change | Recruiter trust | Event-driven stop + late transactional re-check (RFC 04) |
| Duplicate messages damage trust | Recruiter fear | Outbox + deterministic idempotency key + reconcile (RFC 03) |
| Frequent edits / re-cadence | Recruiter behaviour | Cursor model + immutable versioning (RFC 01/05) |
| Bursty bulk adds (10k at once) | Usage pattern | Async idempotent bulk job + completion notification (RFC 07) |
| Per-provider / per-number rate limits | Channel reality | Token-bucket limiter keyed by provider/account/number (RFC 06) |
| LinkedIn has no API | Channel reality | Manual task + `awaiting_manual_action` state (RFC 06) |

---

## 5. Shape of the system (one screen)

- **Application tier** (stateless, behind a load balancer): the Campaign & Enrollment API.
- **Worker fleets** (scaled independently): Scheduler/Scanner, Outbox Relay, Channel Send workers,
  Bulk Enrollment workers, Inbound/Reply workers.
- **Data & messaging**: Postgres (system of record — campaigns, versions, enrollment **cursors**,
  append-only **attempts**, **outbox**, tasks), Redis (rate-limit buckets, scanner locks), a message
  queue (send commands + domain events), and a dead-letter queue.
- **External**: email providers (SMTP/API), Twilio (SMS); LinkedIn via manual tasks.

The two mental models to hold:
1. **Data plane** — how a step gets sent: `API/Bulk → cursor in Postgres → Scanner → outbox → queue
   → channel worker → provider`.
2. **Control plane** — how outreach stops or changes: `reply/STOP/status/pause/edit → enrollment
   state change → Scanner respects it`.

---

## 6. Core design decisions (locked)

| # | Decision | Why | RFC |
|---|---|---|---|
| D1 | Modular monolith + worker pools (not microservices) | Scaling pressure is on workers; one transactional DB keeps audit simple | all |
| D2 | **Cursor model** (one advancing row per enrollment) + append-only attempt log | Cheap edits/cancels; auditability | 01, 02 |
| D3 | **Immutable campaign versions**, enrollment pins a version | Auditable; recruiter controls in-flight scope | 05 |
| D4 | Polling **Scanner** over delay-queues / workflow engine | Simple, debuggable, edit-friendly | 02 |
| D5 | **Outbox** for scanner→queue handoff | Kills dual-write loss/dup | 03 |
| D6 | **Layered stop**: event-driven cancel + late re-check | Reliable halt without heavy locking | 04 |
| D7 | Working hours **snap-at-schedule** + ~20-min jitter | Removes thundering herd before it forms | 02 |
| D8 | Channel **adapter** with auto vs manual modes | Honest LinkedIn modelling; reuse machinery | 06 |
| D9 | Retries + classification + **per-provider circuit breaker** + DLQ | Survive outages without burning or losing work | 03 |

The "if we had more scale / a platform team" alternative — a durable workflow engine (Temporal) with
one workflow per enrollment — is documented and deliberately rejected for now in RFC 02.

---

## 7. Glossary

| Term | Meaning |
|---|---|
| **Campaign** | Recruiter-defined ordered sequence of steps. |
| **Campaign version** | Immutable snapshot of a campaign's steps/cadence/hours. |
| **Step** | One node in a sequence (channel + offset + content). |
| **Enrollment** | One candidate's participation in one campaign; holds the cursor. |
| **Cursor** | `(current_step_index, next_run_at)` — where an enrollment is and when it fires next. |
| **Touchpoint / Attempt** | A single concrete send attempt; append-only, idempotency-keyed. |
| **Outbox** | Table written in the same TX as state changes; relayed to the queue. |
| **Manual task** | A LinkedIn (or other human) step surfaced to the recruiter to action. |
