---
title: Learning rust — day 3
author: Christos Paschalidis
date: 2023-06-24
excerpt: "Async/await with tokio, building a websocket echo server"
---

# Learning rust — day 3

Today: WebSockets. I need them for the chat service. Rust async is different from JavaScript async.

## Tokio basics

`tokio::join!` runs multiple futures concurrently. `tokio::spawn` runs them on separate tasks. This is the runtime that will handle thousands of WebSocket connections.

## WebSocket echo server

The Axum handler upgrades the HTTP connection:

```rust
async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}
```

Then you read from the socket in a loop:

```rust
async fn handle_socket(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Text(t)) = msg {
            socket.send(Message::Text(t)).await.ok();
        }
    }
}
```

It took a few tries to get working. The first compile failed because I forgot to import the right types. The second because I was mixing `async` and `sync` code. Third try worked. Simple, but I know this will get complicated when I need to broadcast to multiple clients, handle disconnections, and scale across servers.

## Broadcasting with channels

Tokio broadcast channels are how I will send messages to all connected clients. One sender, many receivers.

```rust
let (tx, _rx) = broadcast::channel::<String>(100);
tx.send("hello everyone".to_string()).ok();
```

The problem: every WebSocket handler needs access to the broadcaster. I wrapped it in `Arc` (reference counting) so multiple async tasks can share it.

## What frustrated me

Lifetime errors when passing the broadcast sender between handlers. The fix was wrapping it in `std::sync::Arc`. `Arc` is reference counting for shared ownership across async tasks.

This took an hour. In other languages, you would just pass a reference around. In Rust, the compiler makes you prove it is safe.

## What I learned

- `async fn` returns a `Future`, not the result. You must `.await` it.
- `tokio::spawn` for fire-and-forget tasks
- WebSockets in Axum are clean. Upgrade, handle, done.
- `Arc` is your friend when you need shared state across async tasks.

## Resources

- [Tokio docs](https://docs.rs/tokio/latest/tokio/) — read the spawn and channel sections
- [Axum WebSocket example](https://github.com/tokio-rs/axum/blob/main/examples/websockets/src/main.rs) — official example
