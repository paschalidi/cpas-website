---
title: Learning rust — day 2
author: Christos Paschalidis
date: 2023-06-17
excerpt: Structs, enums, Result, and building a small HTTP server
---

# Learning rust — day 2

Today I learned how to model data and handle errors properly. No more throwing exceptions. Everything is explicit.

## Structs and enums

```rust
struct User {
    id: u64,
    name: String,
    email: String,
}

enum Status {
    Active,
    Inactive,
    Banned(String), // reason
}
```

Enums with data are powerful. `Banned(String)` carries the reason. No need for nullable `ban_reason` fields. This matters when you are building a chat API where users can be banned, suspended, or limited.

## The Result type

```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err(String::from("cannot divide by zero"));
    }
    Ok(a / b)
}
```

No exceptions. Every possible error is in the type signature. The compiler forces you to handle it.

This is the thing I wish every language had. When a database query fails in a chat handler, what do you do? In Rust, the type system makes you decide before the code compiles. In JavaScript, you find out in production.

## Building a small HTTP server

I chose Axum. It feels like Express.js but typed. Routing is composable. Handlers are just async functions.

```rust
let app = Router::new()
    .route("/", get(|| async { "hello, axum!" }));
```

One line and you have a server. But the compiler checks every route, every handler, every database query at build time.

## What frustrated me

Understanding when to use `String` vs `&str`. `String` is owned. `&str` is borrowed. For function arguments, `&str` is usually better. For struct fields, `String` because they need to own the data.

I spent 30 minutes on this. It will make sense eventually.

## What I learned

- `#[derive(Debug)]` — print structs without writing display code
- `Option<T>` — enum for values that might be absent. No nulls.
- Pattern matching with `match` is exhaustive. The compiler checks every case.
- `tokio` is the async runtime. Add `#[tokio::main]` and you get async/await.
