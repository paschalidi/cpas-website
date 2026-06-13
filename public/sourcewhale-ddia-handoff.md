# Handoff — DDIA interview prep kit + SourceWhale take-home deck

## What this session produced

Two related bodies of work for a candidate preparing for **staff/senior
engineering interviews**: (1) a DDIA-based study kit, and (2) a finished slide
deck for SourceWhale's senior take-home challenge.

All deliverables are in `/mnt/user-data/outputs/`. Do not regenerate them from
scratch — read them first.

### Deliverables (by path)

| File | What it is | Status |
|------|------------|--------|
| `ddia-staff-flashcards.md` | 109 deep Q/A cards, DDIA 1st-ed structure, teaching-style answers + verified "go deeper" links | done |
| `ddia-2e-main-ideas-flashcards.md` | 66 high-level cards, all 14 chapters of DDIA **2nd ed**, each with a 📖 chapter+section pointer | done |
| `ddia-2e-deeper-flashcards.md` | 49 "one level deeper" cards (named mechanisms/patterns), no overlap with the 66 | done |
| `ddia-mock-design-interviews.md` | 10 full staff-level mock system-design scenarios, worked end-to-end | done |
| `sourcewhale-outreach-design.pptx` | 14-slide deck for the SourceWhale challenge (see below) | done, QA'd |

Deck build source lives at `/home/claude/sourcewhale-deck/build.js`
(pptxgenjs). Rendered QA images `slide-01.jpg`..`slide-14.jpg` are in the same
dir but the workspace resets between sessions — rebuild if you need them
(commands below).

## SourceWhale deck — context the next agent needs

**The brief** (candidate-supplied, senior take-home, ~2–3h, deck shared 24h
ahead): design a high-level architecture for a system that **schedules and
sends multi-step outreach campaigns** (e.g. Day-1 email, Day-3 follow-up,
Day-7 LinkedIn, Day-10 SMS) reliably at scale. Hard requirements: send only in
candidate-local working hours; stop instantly on reply / recruiter verdict
("in process" / "not suitable"); recruiters pause, edit messaging, edit
cadence mid-flight, and bulk-add thousands; duplicates and bad-time sends are
trust-killers. Channels: email via recruiter SMTP/API (reply detection, varied
rate limits), SMS via Twilio (inbound STOP halts; per-number/account limits),
LinkedIn has **no API** → surface manual tasks. Graded on trade-offs,
pragmatism, real-world reasoning.

**The design decisions that are locked in** (candidate approved each via a
"grill-me" Q&A before the deck was built — do not silently reverse them):

- **Thesis:** correctness-and-control problem at *modest* throughput, not a
  throughput problem. Envelope: ~5M in-flight touchpoints ÷ ~3-day cadence ≈
  ~20 sends/s avg, ~100s/s peaks per timezone band. Hidden insight:
  per-sender deliverability limits (a mailbox ≈ few hundred/day, Twilio ≈
  1 msg/s/number) cap volume at ~1–2M/day *from outside the system*. → boring
  tech (Postgres + queue), complexity spent on invariants.
- **Backbone = "DB-as-scheduler" (option A).** `enrollments.next_action_at`
  column holds the future; sweepers poll ~30–60s and claim due rows via
  `FOR UPDATE SKIP LOCKED`; the queue carries **intents only**; workers
  **decide late** (re-validate state/version/window/budget/suppression at fire
  time). Stale intents die at the validation gate.
- **Option B (timer-per-step delay queues) was considered and rejected on the
  record** because the brief's every requirement mutates the future
  (pause/edit/reply ⇒ mass cancel/reschedule; cancellation races ⇒ fire-time
  validation needed anyway ⇒ timers demoted to hints; lost timers fail
  silently ⇒ needs a reconciling sweep = option A again). Hybrid (timers as
  wake-up hints over the same DB truth) is named as the 100× evolution.
  **Option C (durable workflow engine) rejected** for this problem: mid-flight
  edits become workflow versioning, the hard part of those systems.
- **Idempotency:** `sends` ledger row keyed `UNIQUE(enrollment, step)`,
  claimed (INSERT … ON CONFLICT DO NOTHING) *before* any provider call;
  provider idempotency key reused on retries; provider timeout = UNKNOWN
  outcome → leave row SENDING and reconcile by key, **never** retry with a
  fresh key.
- **Content edits** apply mid-flight (render latest template at send);
  **cadence edits** bump a campaign version and recompute `next_action_at`.
- **LinkedIn** step type = MANUAL: runs the same gate, claims the same ledger
  slot, emits a `manual_tasks` row, auto-expires to SKIPPED after N days.

**Deck contents** are fully described in the build source and were visually
QA'd (titles shortened to one line each; slide-4 event-loop arrows and slide-6
state-machine arrows redrawn; slide-8 code lines trimmed to fit). 14 slides:
title, envelope, principles, architecture diagram, data model, state machine,
sweep pseudo-code, validation-gate pseudo-code, stop semantics, change
semantics, timing/budgets, bulk+LinkedIn, failure modes, trade-offs. Speaker
notes on every slide.

## Open items / likely next requests

- **Candidate said they will study the deck and suggest changes** — the next
  turn is most likely deck revisions. Edit `build.js`, re-run, re-render,
  re-QA only affected slides. Minor known nit: slide-4 "events" caption sits
  slightly close under the ingester box (legible; nudge if asked).
- Candidate should add their **real name** to the title-slide footer before
  sending (currently `author = "Candidate"`). Not done — their call.
- **Standing unaccepted offer:** bundle the 4 prep `.md` files + a 5th
  "books & prep research" `.md` into one zip. The research + book list already
  exists in the conversation (5 culture/leadership books: Reilly *Staff
  Engineer's Path*, Larson *Staff Engineer*, *Software Engineering at Google*,
  Ousterhout *A Philosophy of Software Design*, *Accelerate*; plus a
  system-design supplement list: Alex Xu SDI Vol 1&2, Vitillo, Petrov,
  *Software Architecture: The Hard Parts*, Google SRE book; plus a practice-
  platform stack: ByteByteGo→Codemia→Bugfree.ai/Exponent, interviewing.io,
  IGotAnOffer, Tech Interview Handbook, levels.fyi) — it has **not** yet been
  written to a file.

## Rebuild / re-QA commands

```bash
cd /home/claude/sourcewhale-deck   # recreate build.js from outputs if reset
node build.js                      # writes the .pptx
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf sourcewhale-outreach-design.pptx
rm -f slide-*.jpg && pdftoppm -jpeg -r 110 sourcewhale-outreach-design.pdf slide
# then view slide-0N.jpg for visual QA
cp sourcewhale-outreach-design.pptx /mnt/user-data/outputs/
```

## Suggested skills

- **pptx** — required for any edit to the deck. Read `/mnt/skills/public/pptx/SKILL.md`
  and `pptxgenjs.md` before touching `build.js`. Key rules already followed
  (don't regress them): no `#` in hex colors, fresh shadow object per shape,
  `bullet: true` not unicode bullets, no accent stripes / edge bars, one-line
  titles to avoid kicker collision, visual-QA via subagent after changes.
- **docx** — only if the candidate asks for a written doc deliverable instead
  of slides.
- Use **web_search** to re-verify any book/platform/URL before writing the
  prep-resources file (the landscape changes; links were verified this session
  but treat as perishable).

## Notes on tone / approach that worked

The candidate responds well to: being grilled on decisions before building;
trade-offs argued as "options → choice → consequence I accept"; honesty about
failure shapes and residual races rather than hand-waving. They are
knowledgeable (clearly targeting staff level) — match that register; don't
over-explain basics.
