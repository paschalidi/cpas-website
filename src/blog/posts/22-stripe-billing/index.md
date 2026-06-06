---
title: How I built usage-based billing for a chat API
author: Christos Paschalidis
date: 2023-09-10
excerpt: "Stripe subscriptions, metered usage, and the graceful degradation problem"
---

# How I built usage-based billing for a chat API

I built a chat API to learn two things: Rust, and how to put a price tag on an API endpoint.

The Rust part was fun. The billing part was harder than I expected.

Chat-as-a-service means organizations pay for what they use. Some send 100 messages a month. Others send 100,000. I needed billing that scales with usage, not a flat rate that punishes small users or bankrupts large ones.

## The model

I landed on tiered subscriptions through Stripe.

- **Free tier**: 1,000 messages/month. Enough to test the integration.
- **Pro tier**: 10,000 messages/month. For small production apps.
- **Enterprise**: Custom limit. For the ones that need SLA guarantees.

Each organization gets a Stripe customer record and a subscription. The subscription is tied to a Stripe price ID that defines the tier. I store the `subscription_id` and `customer_id` on the organization row in PostgreSQL.

## Tracking usage

Every API request that creates a message or channel increments a counter in Redis. Redis is fast and the counter resets monthly. At the end of the billing period, I could reconcile with Stripe's usage records.

Actually, I do not use Stripe's metered billing API. I track myself. Why? Latency. Calling Stripe on every message would add ~200ms to each request. Unacceptable for real-time chat. Instead, I increment a local counter and sync to Stripe asynchronously.

## The middleware stack

Every request passes through three layers before hitting the handler:

1. **API Key Authorizer**: Validates the API key and resolves the organization.
2. **Usage Tracker**: Increments the message counter for that organization.
3. **Usage Limiter**: Checks if the organization has exceeded their tier limit.

If the limiter says no, the request returns a 402 with a clear message: "Usage limit exceeded. Upgrade your subscription." No vague errors. No mystery.

In Rust, this is just three custom extractors that compose naturally in Axum. The type system ensures every handler that needs auth gets it. No decorator magic, no reflection.

## The difficult decision: what if tracking fails?

Here is the hard part. What happens when the usage tracker cannot reach Redis? Or when the limiter cannot query PostgreSQL for the tier limit?

Option A: Block the request. If I cannot verify usage, assume the worst and shut it down.

Option B: Let it through. If I cannot verify usage, assume good faith and serve the request.

I chose Option B. Everywhere.

If the usage tracker fails, I log the error and continue. The request is not counted, but it is served. If the limiter cannot check the tier limit, I log the error and continue. The request is not blocked.

Only one case returns an error: when I successfully query the database, successfully check the counter, and confirm the limit is exceeded. Then and only then do I block.

This is a product decision, not a technical one. Better to serve a slightly over-limit request during a Redis hiccup than to block a paying customer because my infrastructure burped.

## Stripe webhooks

Stripe sends webhooks for payment success, failure, and subscription changes. I listen for three events:

- `invoice.payment_succeeded`: Customer paid. All good.
- `invoice.payment_failed`: Customer did not pay. Downgrade to free tier immediately. No grace period. Harsh, but clear.
- `customer.subscription.updated`: Customer upgraded or downgraded. Update the tier limit in my database.

Webhook handlers are idempotent. I store processed event IDs to avoid double-processing. Stripe retries failed webhooks, so idempotency matters.

## What I would do differently

Add a soft limit notification at 80% usage. Warn users before they hit the wall.

I added this in the code. The threshold check is there — it logs a warning when an organization hits 80% of their limit. But I never implemented the actual notification. No emails, no Slack messages, no in-app alerts. It was aspirational. I knew it would reduce support tickets, but I never finished it. The TODO is still in the code.

Also: I used Stripe's test mode during development. I did not accidentally create a real subscription. I am not that reckless.
