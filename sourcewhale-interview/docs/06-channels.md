# RFC 06 — Channels (Email, SMS, LinkedIn)

> **TL;DR** — One **channel adapter** contract with two execution modes: **auto** (Email, SMS →
> provider API) and **manual** (LinkedIn → a recruiter task; the sequence waits on a human). Sends
> are paced by a **token-bucket rate limiter keyed by (provider, account, number)** with a
> **circuit breaker**. LinkedIn steps move the enrollment to `awaiting_manual_action` and resume on
> task completion (or auto-skip on TTL).

| | |
|---|---|
| **Status** | Draft |
| **Decision** | Adapter + auto/manual modes; rate limiter; manual-task TTL |
| **Related** | 03 Reliable Delivery · 04 Reactive Stop |

---

## The adapter contract

Every channel implements the same interface so the scheduler/outbox machinery stays channel-agnostic:

```
ChannelAdapter:
  render(step, candidate, version)   -> message payload
  execute(payload, idempotency_key)  -> result (auto) | task (manual)
  normalize_result(provider_resp)    -> {sent | failed(class) | pending}
```

### Auto channels — Email, SMS

`outbox → queue → channel worker → provider API → result event`
- Worker applies **rate limiting** and the **circuit breaker** before calling the provider.
- Result updates the `attempt` row (`sent` / `failed(class)`); failures follow RFC 03.

### Manual channel — LinkedIn (no API)

LinkedIn cannot be automated, so a LinkedIn step is **not a send**:
- `outbox → queue → Manual Task Service` creates a `manual_task` and sets the enrollment to
  **`awaiting_manual_action`**; `next_run_at` becomes null (it's now event-driven, waiting on a human).
- The task is surfaced in the recruiter's work queue ("Send LinkedIn message to this candidate").
- On **task.completed** (or skip) → event → the cursor advances and the next step is scheduled.
- **TTL**: a configurable `task_ttl` on the campaign version auto-skips-or-stops an ignored task so a
  sequence never hangs forever; the outcome is logged.

---

## Rate limiting & provider limits

- **Token-bucket limiter keyed by (provider, account, number)** lives in the channel-worker layer
  (state in Redis), separate from scheduling.
- SMS has **per-number and per-account** limits → the composite key handles both.
- A send blocked by the limiter is **re-queued with backoff** — never dropped, never advanced past.
- Different email providers have different limits → per-provider bucket config.

This layer is the second smoother behind schedule-time jitter (RFC 02): jitter prevents the herd;
the limiter enforces hard provider ceilings.

---

## Why model LinkedIn as a task (not a fake send)

A LinkedIn step can wait on a human for **days**. Pretending it's a "send" would lie to the cursor
and break timing semantics. Modeling it as `awaiting_manual_action` + task honors the real-world
constraint and **reuses** the same adapter/outbox/attempt machinery.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Uniform "send" abstraction, LinkedIn faked as a send** | Hides that LinkedIn blocks on a human for days; corrupts cursor timing and completion semantics. |
| **Separate bespoke pipeline per channel** | Triples the scheduling/outbox/idempotency code; divergent failure handling. The adapter keeps one spine. |
| **Rate limiting at the scheduler** | Scheduler shouldn't know provider limits; coupling scaling of scan to send pacing. Limiter belongs at the send boundary. |
| **Automate LinkedIn via unofficial scraping** | Against platform terms, fragile, reputationally risky. Out of the question. |
| **No task TTL** | Ignored LinkedIn tasks hang sequences indefinitely; recruiters lose track. TTL with logged auto-skip keeps flow moving. |
