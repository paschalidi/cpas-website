---
title: Designing a multi-tenant chat API with API keys and usage limits
author: Christos Paschalidis
date: 2023-09-10
excerpt: Organization isolation, API key auth, rate limiting, and Stripe billing
---

# Designing a multi-tenant chat API with API keys and usage limits

Chat-as-a-service means multiple organizations sharing one backend. Each org needs isolation, authentication, and billing. Here is how we built it.

## Data model

```
organizations
├── users
├── channels
├── messages
└── api_keys (with monthly usage tracking)
```

Every table has `organization_id`. No cross-org queries. No accidental data leaks.

## API key authentication

Axum custom extractor pattern:

```rust
#[derive(Debug, Clone)]
pub struct ApiKeyAuthorizer {
    pub key_type: ApiKeyType,
}

#[async_trait]
impl FromRequestParts<AppState> for ApiKeyAuthorizer {
    type Rejection = MiddlewareError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let org_id = extract_organization_id(parts, state).await?;
        let api_key = extract_api_key(parts)?;
        let key = find_and_validate_key(&api_key, &org_id, &state.db.connection).await?;
        
        Ok(Self { key_type: key.key_type })
    }
}
```

Usage in handlers:

```rust
pub async fn create_channel(
    _auth: ApiKeyAuthorizer,
    State(state): State<AppState>,
    Json(body): Json<CreateChannelRequest>,
) -> Result<Json<ChannelResponse>, ApiError> {
    // Only reaches here if API key is valid
}
```

The `_auth` parameter forces the middleware to run. No annotation needed. Axum extracts it automatically.

## The middleware pipeline

```
Request → ApiKeyAuthorizer → UsageTracker → UsageLimiter → Handler
             (Validate)      (Count)         (Enforce)
```

Each middleware is a custom extractor. They compose naturally in Axum.

## Usage limiting with tiers

```rust
#[async_trait]
impl FromRequestParts<AppState> for UsageLimiter {
    type Rejection = MiddlewareError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let org_id = extract_organization_id(parts, state).await?;
        let usage = check_usage(&state, &org_id).await?;
        let tier = OrganizationTiers::find_by_id(org_id)
            .one(&state.db.connection).await?;
        
        if usage >= tier.monthly_request_limit {
            return Err(MiddlewareError::UsageLimitExceeded(
                "Usage limit exceeded. Please upgrade your subscription.".to_string()
            ));
        }
        
        // Track the request
        increment_usage(&state, &org_id).await?;
        
        Ok(Self)
    }
}
```

## Graceful degradation

The difficult decision: what happens when usage tracking fails? If the database is slow, do we block all requests?

Answer: No. If we cannot check usage, we let the request through. Only block if we can confirm the limit is exceeded.

```rust
let usage = match check_usage(&state, &org_id).await {
    Ok(u) => u,
    Err(e) => {
        tracing::error!("Failed to check usage: {}", e);
        return Ok(Self); // Let it through
    }
};
```

This is a product decision, not a technical one. Better to serve a slightly over-limit request than to block everything during a DB hiccup.

## Stripe integration

```rust
use async_stripe::{Client, CreateSubscription, Subscription};

pub async fn create_subscription(
    customer_id: &str,
    price_id: &str,
) -> Result<Subscription, StripeError> {
    let client = Client::new("sk_live_...");
    
    let subscription = CreateSubscription::new()
        .customer(customer_id)
        .add_item(CreateSubscriptionItems {
            price: price_id.to_string(),
            ..Default::default()
        });
    
    Subscription::create(&client, subscription).await
}
```

Stripe handles billing. We store the `subscription_id` on the organization. Webhooks update the tier when payment succeeds or fails.

## What I learned

- Custom extractors in Axum are powerful. Auth, rate limiting, usage tracking — all reusable.
- Graceful degradation matters more than perfect enforcement.
- SeaORM migrations with `sea-orm-cli` make schema changes manageable. Never modify the DB directly.
