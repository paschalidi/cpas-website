# RFC 05 — Campaign Versioning & Edits In-Flight

> **TL;DR** — Campaigns are **immutable versioned**. Editing copy or cadence creates a new
> `campaign_version`; an enrollment **pins** the version it runs against. On edit the recruiter
> explicitly chooses scope — **new candidates only** vs **also migrate in-flight**. Every attempt
> references the exact version+step that produced it, so the system is fully auditable.

| | |
|---|---|
| **Status** | Draft |
| **Decision** | Immutable versions + explicit in-flight migration choice |
| **Related** | 01 Data Model · 02 Scheduling |

---

## How it works

- A `campaign_version` is a frozen snapshot: ordered steps, per-step content refs, cadence offsets,
  and working hours. It is **never mutated** after creation.
- `enrollment.campaign_version_id` pins the version. The cursor resolves the **current step content
  lazily at fire time** against the pinned version.
- "Edit" = create version `n+1`. The recruiter chooses:
  - **New only** → existing enrollments keep their pinned version; only future enrollments use `n+1`.
  - **Migrate in-flight** → bump active enrollments to `n+1` for steps **not yet sent**; already-sent
    steps stay attributed to the version that sent them.

Because steps already sent are recorded as `attempt` rows pinned to their version, a migration can
never rewrite history — it only changes the *future* of a sequence.

### Cadence edits + the cursor

Changing offsets is just a new version. On migration we recompute `next_run_at` for in-flight
enrollments from the new version's offset for the **current** step, re-snapped to working hours.
One timestamp recomputation per enrollment — cheap, thanks to the cursor model.

---

## Why this matters

- **Auditability / debuggability** (a first-class goal): "what did we send, when, under which copy?"
  is answerable from `attempt → campaign_version → step`.
- **Control** (a core recruiter fear is loss of control): the recruiter decides whether a fix touches
  people already mid-sequence, rather than the system guessing.
- **Safe fixes**: correcting a typo in step 5 can't accidentally change semantics for someone sitting
  at step 2 unless the recruiter opts in.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Live-reference (mutate in place)** | Instantly changes meaning for all in-flight candidates; no attribution of what was actually sent. Fails audit + control goals. |
| **Copy full definition onto each enrollment at enroll time** | Edits then can't reach in-flight candidates at all (every enrollment is a frozen island); also duplicates data massively. Version pinning gives the same isolation with a shared, dedup'd snapshot and an opt-in migration. |
| **Auto-migrate everyone on every edit (no choice)** | Removes recruiter control; a small wording fix would silently re-cadence thousands. |
| **Event-sourcing the whole campaign** | Powerful but heavy; more machinery than the audit requirement needs. Append-only attempts + versions cover it. |
