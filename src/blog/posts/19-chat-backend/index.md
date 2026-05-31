---
title: building a chat backend with axum and websockets
author: Christos Paschalidis
date: 2023-07-15
excerpt: Connection management, Redis pub/sub, and why I banned unwrap
---

# building a chat backend with axum and websockets

the echo server works on one machine. for a real service, you need multiple instances and shared state. Redis is the bridge.

### architecture

```
client -> websocket -> axum server
                          |
                    Redis pub/sub
                          |
                   other axum servers
```

when a user sends a message, the server publishes it to Redis. all other servers subscribe and forward to their connected clients.

### websocket handler

```rust
pub async fn chat_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket_connection(socket, state, room_id))
}

async fn handle_socket_connection(socket: WebSocket, state: AppState, room_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let mut pubsub = state.redis.client.get_async_connection().await
        .unwrap()
        .into_pubsub();
    
    let channel = format!("chat:{}", room_id);
    pubsub.subscribe(&channel).await.unwrap();
    
    // forward Redis messages to WebSocket
    let mut msg_stream = pubsub.on_message();
    while let Some(msg) = msg_stream.next().await {
        let payload: String = msg.get_payload().unwrap_or_default();
        sender.send(Message::Text(payload)).await.ok();
    }
}
```

`socket.split()` gives you separate send and receive halves. the Redis pubsub runs in its own async task.

### no unwrap policy

at the top of main.rs:

```rust
#![deny(clippy::unwrap_used)]
#![deny(clippy::expect_used)]
#![deny(clippy::panic)]
```

every possible failure is explicit. if the Redis connection fails, log the error and close the socket. no panics in production.

### connection cleanup

```rust
async fn broadcast_active_users(state: &AppState, delta: i64) {
    let mut count = state.active_users.write().await;
    *count += delta;
    
    let update = json!({
        "type": "active_users",
        "count": *count
    });
    
    // publish to all rooms
    let mut conn = state.redis.client.get_async_connection().await?;
    conn.publish::<_, _, ()>("chat:broadcast", update.to_string()).await?;
    Ok(())
}
```

increment on connect, decrement on disconnect. `active_users` is an `Arc<RwLock<i64>>` shared across all connections on this instance.

### what worked

- Redis pub/sub for cross-instance broadcast. no custom message broker needed.
- splitting the websocket into `sender`/`receiver` lets you handle both directions independently
- `RwLock` for connection counts. many readers, one writer.

### what didn't

- `unwrap` in the Redis connection path. the `#![deny(clippy::unwrap_used)]` caught it. refactored to proper error handling.
- not handling websocket reconnections. clients drop and reconnect. need message history on rejoin via REST API.

### one thing I'd do differently

start with Redis streams instead of pub/sub. pub/sub doesn't persist messages. if a server restarts, it misses messages between restart and client reconnect. streams give you replay.
