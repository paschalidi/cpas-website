# RFC 03 — Reliable Delivery (no duplicates, no lost sends)

> **TL;DR** — The scanner writes the `attempt`, advances the cursor, and enqueues the send command
> **in one Postgres transaction** via an **outbox** table; a relay publishes outbox rows
> at-least-once. A **deterministic idempotency key** + "write intent before send" +
> **reconcile-on-unknown** make duplicates impossible in practice. Failures are classified, retried
> with backoff, guarded by a **per-provider circuit breaker**, and dead-lettered visibly. A `sent`
> message is **never** auto-resent.

| | |
|---|---|
| **Status** | Draft |
| **Decision** | Outbox + idempotency key + reconcile + classified retries + circuit breaker + DLQ |
| **Related** | 01 Data Model · 02 Scheduling · 06 Channels |

---

## The dual-write problem (why outbox)

When a step fires we must do two things: change DB state and tell a channel worker to send. If those
are separate operations they can diverge:
- DB commits, queue publish fails → **lost send**.
- Queue publish succeeds, DB rolls back → **ghost/duplicate send**.

Both are exactly the recruiter's nightmare. The **outbox** removes the dual write: the "send this"
command is inserted into an `outbox` table **in the same transaction** as the attempt + cursor
update. A separate **relay** polls the outbox and publishes to the queue, marking rows dispatched.

```
TX {
  re-check status = active
  INSERT attempt(status = sending, idempotency_key)
  UPDATE enrollment SET current_step_index+1, next_run_at = snap+jitter
  INSERT outbox(topic = 'channel.send', payload = {...})
}  -- atomic commit
relay: poll outbox -> publish -> mark dispatched   (at-least-once)
```

At-least-once delivery means the worker may see a command twice → handled by idempotency below.

---

## Idempotency & exactly-once *effect*

- `idempotency_key = hash(enrollment_id, step_index, campaign_version_id)` is written on the
  `attempt` row (unique) **before** the provider call.
- On (re)delivery the worker looks up the attempt by key:
  - `sent` already → **no-op**.
  - `sending` with unknown outcome → **reconcile** (query provider status API) instead of blind resend.
  - not present → create and proceed.
- We also pass the key to providers that support it (Twilio, modern email APIs) for a second layer.

Result: **at-least-once transport, exactly-once effect.**

---

## Failure classification & retries

| Class | Examples | Action |
|---|---|---|
| **Transient** | 5xx, timeout, throttled | Retry with exponential backoff + jitter, capped attempts |
| **Permanent** | invalid number, hard bounce, unsubscribed | No retry → mark enrollment `stopped`/`failed`, record reason, surface to recruiter |
| **Unknown** | timeout *after* possible send | **Reconcile** via provider status before any retry |

- **Per-provider circuit breaker**: if a whole provider is failing, open the breaker → hold that
  channel's sends (don't burn retries, don't advance cursors), auto-resume on recovery. Prevents a
  09:00 spike from hammering the DLQ during an outage.
- **Dead-letter queue**: after max retries, the touchpoint goes to the DLQ and the enrollment is
  paused on that step with a recruiter-visible failure — never silently dropped.
- **Never auto-resend a `sent` attempt.** Once `sent`, the step is permanently complete.

---

## Worker-crash safety

The send command lives in the queue (from the outbox) and the `attempt` row records intent. If a
worker crashes mid-send, the queue message reappears after its visibility timeout; the
idempotency/reconcile path prevents the double-send. No state is lost because nothing was deleted —
only appended/advanced.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Publish to queue directly from the API/scanner** (no outbox) | Re-introduces the dual-write race we're trying to kill. The outbox is cheap insurance. |
| **Two-phase commit across DB + broker** | Operationally fragile, poor support, latency cost. Outbox achieves the same guarantee pragmatically. |
| **Exactly-once delivery from the broker** | No broker delivers true exactly-once across process crashes; chasing it is a trap. We design for at-least-once + idempotent effect. |
| **Trust provider dedupe only** | Not all providers support idempotency keys, and it doesn't cover our internal dual-write. We own the key on the attempt row. |
| **Silent drop on max retries** | Recruiters fear silent loss as much as duplicates. DLQ + visible failure is mandatory. |
