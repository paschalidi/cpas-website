---
title: Why exposing API keys in the frontend killed the project
author: Christos Paschalidis
date: 2023-12-01
excerpt: "I shipped a chat SDK that required users to paste their API key in React props. It took me two weeks to realize why this was wrong. Then I shut it down."
---

# Why exposing API keys in the frontend killed the project

I shipped the React SDK and thought I was done. Then I opened DevTools on the demo page.

```html
<ChatProvider
  apiKey="rechat_live_abc123..."
  appId="org_xyz"
  channelName="support"
  userId="user_1"
>
```

The API key was right there in the HTML. Readable by anyone. Copy-pasteable.

I built a chat API with API key authentication. I built a React SDK that takes the API key as a prop. I told users to paste their key in their frontend code. And then I realized anyone who visits their website can steal their key and send messages on their behalf.

This is not a subtle bug. This is the whole security model falling apart.

## Why I did it

Because it is easy. Because Stripe does it with publishable keys. Because every JavaScript SDK example shows you passing a key to a constructor.

```js
const stripe = Stripe('pk_live_...');
```

The difference: Stripe's publishable keys can only create tokens. They cannot charge cards, refund payments, or access customer data. They are designed to be public.

My API keys can send messages, create channels, delete data. They are designed to be secret. And I told everyone to paste them in the frontend.

## Why it is a problem

The API key is sent with every request. It is in the HTML, in the JavaScript bundle, in the WebSocket handshake. Anyone with browser DevTools can copy it. Once copied, they can:

- Send messages impersonating any user
- Create spam channels
- Exhaust the usage limit
- Delete messages

The middleware validates the key. It checks the organization. It enforces usage limits. But if the key is stolen, all of that validation passes because the key is valid. The system has no way to know the request is coming from an attacker, not the real frontend.

## How Algolia does it

Algolia has two types of keys: search-only and admin.

Search-only keys are public. They go in the frontend. They can only read data. Even if stolen, the worst someone can do is run searches. They cannot modify indices, delete records, or access billing.

Admin keys are secret. They stay on the backend. They can write data, change settings, manage users.

This separation is the whole point. Public keys for public operations. Secret keys for secret operations.

I did not build this separation. I built one key that does everything, and then I told users to put it in the frontend.

## What I should have done

There are three ways to fix this. Backend proxy (too much friction). JWT tokens (still need a token endpoint). Or public/private key pairs.

Public/private key pairs are the right answer. The frontend gets a public key. The backend signs the request with the secret key. The server verifies the signature. Secret never leaves the backend.

This is how AWS does it. No proxy, no token server, no expiration logic. The customer's backend only generates the signature. The frontend talks directly to ReChat.

**How this actually prevents abuse:**

The customer's backend holds the secret key. When a user opens the chat widget, the backend generates a signature that includes the user's ID and a timestamp. The frontend sends this signature with every WebSocket connection and API request.

The ReChat server verifies the signature using the public key. If the signature is valid and not expired, the request is processed. If someone steals the public key, they cannot forge a signature without the secret key. They cannot impersonate users, create channels, or send messages.

The public key only identifies the organization. The signature proves the request is legitimate. Without the signature, the public key is useless.

This means even if someone copies the public key from the HTML, they cannot do anything with it. They can see the organization ID, but they cannot send messages, create channels, or delete data. The secret key never touches the frontend, so it cannot be stolen.

I did not do this. I did not do anything. I left the API key in the React prop and moved on to the next feature.

Then I got the bill.

## Why the project died

DigitalOcean Kubernetes: $120 per month. Managed PostgreSQL: $60 per month. Managed Redis: $40 per month. Domain, registry, load balancer. $150 per month for a side project with zero users.

I could have run it cheaper. Docker Compose on a single droplet. Self-hosted Postgres. Self-hosted Redis. But I wanted to learn Kubernetes. I wanted to do it "the right way." The right way was expensive.

I shut it down. Cancelled the DO account. Let the domain expire. The GitHub repos are still there, public, frozen in time.

Another pet project that did not make it past the "this is cool" phase. The difference this time: I actually learned something. The API key problem is the kind of mistake you only make once. Next time, I will think about auth before I write the first line of the SDK.

## What I learned

I should have thought about auth before I wrote the first line of the SDK. Not after. Not when the bill arrived.

Public/private key pairs are the answer. Secret stays on the backend. Public key goes everywhere. Signature proves the request is real. No proxy, no token server, no expiration logic.

And $150 a month is stupid for a learning project. Next time: one VPS, Docker Compose, $20 budget. Done.
