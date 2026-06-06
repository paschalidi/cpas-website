---
title: Designing a multi-tenant chat API with API keys and usage limits
author: Christos Paschalidis
date: 2023-09-10
excerpt: "Organization isolation, API key auth, rate limiting, and Stripe billing"
---

# Designing a multi-tenant chat API with API keys and usage limits

Chat-as-a-service means multiple organizations sharing one backend. Each org needs isolation, authentication, and billing. Here is how I built it.

## Data model

Every table has `organization_id`. No cross-org queries. No accidental data leaks.

Organizations have users, channels, messages, and api_keys. The api_keys table tracks monthly usage. Simple enough.

## API key authentication

I used Axum's custom extractor pattern. The `ApiKeyAuthorizer` validates the key and resolves the organization. The `_auth` parameter in the handler forces the middleware to run. No annotation needed. Axum extracts it automatically.

This is powerful. Auth, rate limiting, usage tracking — all reusable extractors that compose naturally.

## Usage limiting with tiers

The middleware pipeline: Request → ApiKeyAuthorizer → UsageTracker → UsageLimiter → Handler.

Each step is a custom extractor. If the API key is invalid, the request fails early. If usage is over the limit, it returns 402. Otherwise, it hits the handler.

## Graceful degradation

The difficult decision: what happens when usage tracking fails? If the database is slow, do I block all requests?

Answer: No. If I cannot check usage, I let the request through. Only block if I can confirm the limit is exceeded.

This is a product decision, not a technical one. Better to serve a slightly over-limit request than to block everything during a DB hiccup. I see this in my code: every failure path in the usage limiter returns `Ok(Self)` and lets the request through. Only when usage is confirmed over the limit does it block.

## Stripe integration

I used Stripe for billing. Organizations get a Stripe customer record and a subscription. The subscription is tied to a price ID that defines the tier. I store the `subscription_id` on the organization row.

Stripe handles payments. I handle counting. Webhooks update the tier when payment succeeds or fails.

## What I learned

- Custom extractors in Axum are powerful. Auth, rate limiting, usage tracking — all reusable.
- Graceful degradation matters more than perfect enforcement.
- SeaORM migrations with `sea-orm-cli` make schema changes manageable. Never modify the DB directly.
