---
title: running a security guild for 3 months
author: Christos Paschalidis
date: 2022-02-15
excerpt: Reviewing code, updating packages, and reading threat models so you don't have to
---

# running a security guild for 3 months

Every quarter someone new leads the security guild. I got the short straw. Here's what 3 months actually looks like.

### what I did

- **reviewed every PR touching auth or payments** — tedious but necessary, caught 2 cases where tokens were logged to console
- **updated dependencies with known CVEs** — automated with `npm audit`, manual review for breaking changes
- **read threat models and gave feedback** — mostly pointing out "what happens if this service is down?" edge cases the product team missed
- **ran OWASP ZAP against staging** — found an open redirect we fixed before it hit prod
- **wrote a 1-page checklist** — "before you ship auth changes, verify...", pinned in Slack

### what worked

- **dependency alerts in Slack** — proactive beats reactive, everyone ignored the email version
- **pairing with juniors on reviews** — they learned what to look for, I learned what they didn't know
- **keeping it to 30 min/week** — anything longer and people find excuses

### what didn't

- **threat model meetings** — product had already decided, our feedback was decoration
- **company-wide security training** — mandatory, boring, retention near zero

### one thing I'd do again

OWASP ZAP in CI. Caught the redirect. Caught a missing CSP header. Cheap insurance.

### one thing I'd skip

Writing the "secure coding guidelines" doc. 12 pages nobody read. The 1-page checklist got used.
