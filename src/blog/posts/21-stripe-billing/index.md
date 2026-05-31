---
title: How we built usage-based billing for a chat API
author: Christos Paschalidis
date: 2023-09-10
excerpt: Stripe subscriptions, metered usage, and the graceful degradation problem
---

# How we built usage-based billing for a chat API

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

Actually, I do not use Stripe's metered billing API. I track myself. Why? Latency. Calling Stripe on every message would add 200ms to each request. Unacceptable for real-time chat. Instead, I increment a local counter and sync to Stripe asynchronously.

## The middleware stack

Every request passes through three layers before hitting the handler:

1. **API Key Authorizer**: Validates the API key and resolves the organization.
2. **Usage Tracker**: Increments the message counter for that organization.
3. **Usage Limiter**: Checks if the organization has exceeded their tier limit.

If the limiter says no, the request returns a 402 with a clear message: "Usage limit exceeded. Upgrade your subscription." No vague errors. No mystery.

In Rust, this is just three custom extractors that compose naturally in Axum. The type system ensures every handler that needs auth gets it. No decorator magic, no reflection.

## The difficult decision: what if tracking fails?

Here is the hard part. What happens when the usage tracker cannot reach Redis? Or when the limiter cannot query PostgreSQL for the tier limit?

Option A: Block the request. If we cannot verify usage, assume the worst and shut it down.

Option B: Let it through. If we cannot verify usage, assume good faith and serve the request.

I chose Option B. Everywhere.

If the usage tracker fails, I log the error and continue. The request is not counted, but it is served. If the limiter cannot check the tier limit, I log the error and continue. The request is not blocked.

Only one case returns an error: when I successfully query the database, successfully check the counter, and confirm the limit is exceeded. Then and only then do I block.

This is a product decision, not a technical one. Better to serve a slightly over-limit request during a Redis hiccup than to block a paying customer because our infrastructure burped.

## Stripe webhooks

Stripe sends webhooks for payment success, failure, and subscription changes. I listen for three events:

- `invoice.payment_succeeded`: Customer paid. All good.
- `invoice.payment_failed`: Customer did not pay. Downgrade to free tier immediately. No grace period. Harsh, but clear.
- `customer.subscription.updated`: Customer upgraded or downgraded. Update the tier limit in our database.

Webhook handlers are idempotent. I store processed event IDs to avoid double-processing. Stripe retries failed webhooks, so idempotency matters.

## The result

Organizations sign up via the web app. They get an API key instantly. They start sending messages. When they hit the limit, they see a clear error. They upgrade in the web app. Stripe handles the payment. The API key continues working. No manual intervention.

## What I would do differently

Add a soft limit notification at 80% usage. Warn users before they hit the wall. I added this later. It reduced support tickets by half.

Also: start with Stripe's test mode. I accidentally created a real subscription during development. The $0.50 charge was embarrassing.
