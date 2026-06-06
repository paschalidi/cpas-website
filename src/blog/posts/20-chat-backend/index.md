---
title: How I handle real-time messages across multiple servers
author: Christos Paschalidis
date: 2023-07-15
excerpt: "WebSockets for client connections, Redis for server-to-server broadcast"
---

# How I handle real-time messages across multiple servers

A single server can only handle so many WebSocket connections. When you need to scale, you have multiple servers. The problem: a user connected to server A sends a message, but the recipient is on server B. How does server B know?

This was the first hard problem I hit after learning Rust basics. I knew how to build a WebSocket echo server. I did not know how to make it work across multiple machines.

## The architecture

I use Axum for HTTP and WebSocket handling. Axum is built on Tokio, Rust's async runtime. It handles the HTTP upgrade to WebSocket, then gives me a persistent connection.

Each connection is split into two halves: one for reading, one for writing. This lets me handle incoming and outgoing messages independently. When a user sends a message, I read it from the WebSocket, publish it to Redis, and forget about it. Another task listens to Redis and writes incoming messages to the WebSocket.

## Why Redis pub/sub

Redis pub/sub is fire-and-forget. When a server publishes a message to a channel, Redis forwards it to all subscribers instantly. No persistence, no queue. Perfect for real-time chat where the only thing that matters is the now.

Each chat room has its own Redis channel. Server A publishes to `chat:room-123`. Servers B and C are subscribed to the same channel. They receive the message and forward it to their local WebSocket connections.

I chose this because it is simple. I did not want to run RabbitMQ or Kafka for a side project. Redis was already in the stack for caching and session storage. Pub/sub came free.

## The hard part: connection cleanup

WebSocket connections drop. Users close laptops, switch networks, lose signal. The server needs to know when a connection dies so it can clean up resources and stop listening to Redis channels.

I run two tasks per connection: one reads from the WebSocket, one reads from Redis. If either task ends (connection closes, error, etc.), I abort the other. This prevents resource leaks and orphaned Redis subscriptions.

In Rust, this is `tokio::select!` — wait for either task to finish, then clean up the other. In JavaScript, you would use Promise.race. The concept is the same. The implementation is safer because Rust forces you to handle every error case.

## The difficult decision: no unwrap policy

Rust has a compiler flag that bans `.unwrap()` — a method that crashes the program if something fails. I enabled it for the entire codebase.

```rust
#![deny(clippy::unwrap_used)]
#![deny(clippy::expect_used)]
#![deny(clippy::panic)]
```

This sounds pedantic, but it forces explicit error handling. When a Redis connection fails, what should the WebSocket handler do? Panic? No. Log the error and close the connection gracefully. The client will reconnect.

Every possible failure path must be handled. No silent crashes. In production, this matters more than convenience.

## What worked

Redis pub/sub handles the cross-server broadcast without custom infrastructure. WebSocket split lets me process both directions independently. Tokio's async runtime manages thousands of concurrent connections efficiently.

## What did not

Redis pub/sub does not persist messages. If a server restarts, it misses messages sent between restart and client reconnect. For my use case (customer support chat), this is acceptable. Users see history via the REST API when they reconnect. The WebSocket only carries live messages.

If I needed guaranteed delivery (financial trading, medical alerts), I would use Redis Streams instead. Streams persist messages and support consumer groups for acknowledgment and redelivery.

## The result

This is designed for three Axum servers behind a load balancer. Any user can connect to any server and talk to anyone in the same room. Redis handles the cross-server coordination. No custom message broker needed.

I did not actually deploy three servers. This is theoretical. I ran one server locally and tested the Redis pub/sub logic. But the architecture is sound. If I ever need to scale, I know what to do.

This is good enough for a learning project. It is not good enough for a real product. But that was never the goal.
