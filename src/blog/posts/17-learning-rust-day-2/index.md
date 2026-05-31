---
title: learning rust - day 2
author: Christos Paschalidis
date: 2023-06-17
excerpt: Structs, enums, Result, and building a small HTTP server
---

# learning rust - day 2

today i learned how to model data and handle errors properly. no more throwing exceptions. everything is explicit.

### structs and enums

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

enums with data are powerful. `Banned(String)` carries the reason. no need for nullable `ban_reason` fields.

### the Result type

```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err(String::from("cannot divide by zero"));
    }
    Ok(a / b)
}

fn main() {
    match divide(10.0, 2.0) {
        Ok(result) => println!("result: {}", result),
        Err(e) => println!("error: {}", e),
    }
}
```

no exceptions. every possible error is in the type signature. the compiler forces you to handle it.

### the ? operator

```rust
fn read_file(path: &str) -> Result<String, std::io::Error> {
    let content = std::fs::read_to_string(path)?;
    Ok(content)
}
```

the `?` early returns the error. less nesting than `match`. but the function must return `Result`.

### building a small HTTP server

```rust
use axum::{
    routing::get,
    Router,
};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { "hello, axum!" }));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

axum is the web framework i chose. it feels like express.js but typed. routing is composable. handlers are just async functions.

### what i learned today

- `#[derive(Debug)]` — print structs without writing display code
- `Option<T>` — enum for values that might be absent. no nulls.
- pattern matching with `match` is exhaustive. the compiler checks every case.
- `tokio` is the async runtime. add `#[tokio::main]` and you get async/await.

### what frustrated me

understanding when to use `String` vs `&str`. `String` is owned. `&str` is borrowed. for function arguments, `&str` is usually better. for struct fields, `String` because they need to own the data.

```rust
fn greet(name: &str) -> String {
    format!("hello, {}", name)
}
```
