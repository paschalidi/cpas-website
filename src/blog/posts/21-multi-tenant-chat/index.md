---
title: Designing a Multi-Tenant Chat API with API Keys and Usage Limits
author: Christos Paschalidis
date: 2023-09-10
excerpt: Organization isolation, API key auth, rate limiting, and Stripe billing
---

# Designing a Multi-Tenant Chat API with API Keys and Usage Limits

Chat-as-a-service means multiple organizations sharing one backend. Each org needs isolation, authentication, and billing.

### Data Model

```
organizations
├── users
├── channels
├── messages
└── api_keys (with monthly usage tracking)
```

Every table has `organization_id`. No cross-org queries. No accidental data leaks.

### API Key Authentication

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

### Usage Limiting with Tiers

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

Graceful degradation: if usage tracking fails, the request still goes through. Only block if we can confirm the limit is exceeded.

### Stripe Integration

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

Stripe handles the billing. We store the `subscription_id` on the organization. Webhooks update the tier when payment succeeds or fails.

### What I Learned

- Custom extractors in Axum are powerful. Auth, rate limiting, usage tracking — all reusable.
- Graceful degradation matters more than perfect enforcement. A blocked request because the usage tracker is down is worse than a slightly over-limit request.
- SeaORM migrations with `sea-orm-cli` make schema changes manageable. Never modify the DB directly.
