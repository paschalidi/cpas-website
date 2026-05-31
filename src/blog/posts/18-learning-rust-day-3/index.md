---
title: learning rust - day 3
author: Christos Paschalidis
date: 2023-06-24
excerpt: Async/await with tokio, building a websocket echo server
---

# learning rust - day 3

today websockets. i need them for the chat service i'm building. rust async is different from javascript async.

### tokio basics

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let task1 = async_task("task 1");
    let task2 = async_task("task 2");
    
    // run concurrently
    tokio::join!(task1, task2);
}

async fn async_task(name: &str) {
    sleep(Duration::from_secs(1)).await;
    println!("{} done", name);
}
```

`tokio::join!` runs multiple futures concurrently. `tokio::spawn` runs them on separate tasks (threads under the hood).

### websocket echo server

```rust
use axum::{
    extract::ws::{WebSocketUpgrade, Message},
    response::Response,
    routing::get,
    Router,
};

async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: axum::extract::ws::WebSocket) {
    while let Some(msg) = socket.recv().await {
        if let Ok(text) = msg {
            if let Message::Text(t) = text {
                println!("received: {}", t);
                socket.send(Message::Text(t)).await.ok();
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/ws", get(ws_handler));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

this is the foundation of the chat service. upgrade HTTP to websocket, keep the connection open, broadcast messages.

### broadcasting with channels

```rust
use tokio::sync::broadcast;

let (tx, _rx) = broadcast::channel::<String>(100);

// in the handler
let mut rx = tx.subscribe();

// send to all subscribers
tx.send("hello everyone".to_string()).ok();

// receive in another task
while let Ok(msg) = rx.recv().await {
    println!("got: {}", msg);
}
```

tokio broadcast channels are how i'll send messages to all connected clients. one sender, many receivers.

### what i learned today

- `async fn` returns a `Future`, not the result. you must `.await` it.
- `tokio::spawn` for fire-and-forget tasks
- `tokio::sync::mpsc` for one-to-one channels, `broadcast` for one-to-many
- websockets in axum are clean. upgrade, handle, done.

### what frustrated me

lifetime errors when passing the broadcast sender between handlers. the fix was wrapping it in `std::sync::Arc`:

```rust
use std::sync::Arc;
use tokio::sync::broadcast::Sender;

let tx: Arc<Sender<String>> = Arc::new(tx);
```

`Arc` is reference counting for shared ownership across async tasks. needed because every websocket handler needs access to the broadcaster.

### resources

- [tokio docs](https://docs.rs/tokio/latest/tokio/) — read the spawn and channel sections
- [axum websocket example](https://github.com/tokio-rs/axum/blob/main/examples/websockets/src/main.rs) — official example
