---
title: Building a react SDK for my backend
author: Christos Paschalidis
date: 2023-11-20
excerpt: "Packaging components, WebSocket reconnection, and TypeScript types"
---

# Building a react SDK for my backend

A chat backend is useless without a client. I built a React SDK so developers can add chat to their app in minutes.

### Architecture

The SDK follows the React context pattern:

```
ChatProvider (manages connection + state)
├── ChannelList (displays available channels)
├── Messages (displays messages + handles new ones)
└── MessageInput (sends messages)
```

### The provider

```tsx
import { ChatProvider } from "@rechat-sdk/react";

function App() {
  return (
    <ChatProvider 
      apiKey="your_api_key"
      appId="your_app_id"
      channelName="support"
      userId="user_1"
      userName="Alice"
    >
      <div className="flex h-screen">
        <ChannelList />
        <Messages />
        <MessageInput />
      </div>
    </ChatProvider>
  );
}
```

The provider handles:
- WebSocket connection lifecycle
- API key authentication headers
- Channel discovery via REST API
- Message history via REST + real-time via WebSocket

### WebSocket hook

```tsx
export function useWebSocket(channelName: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(
        `${config.rust_ws_url}/chat/${channelName}`
      );

      ws.current.onopen = () => setIsConnected(true);
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
      };
      ws.current.onclose = () => setIsConnected(false);
    };

    connect();

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [channelName]);

  return { isConnected, messages, ws: ws.current };
}
```

One WebSocket per channel. Cleanup on unmount to avoid memory leaks.

### Combining REST and WebSocket

Messages are loaded from two sources:

```tsx
const value = useMemo(() => ({
  messages: {
    data: [
      ...(channelMessages || []),  // From REST API (history)
      ...(wsMessages || [])          // From WebSocket (real-time)
    ],
    isLoading: areMessagesLoading,
    error: messagesError,
    refetch: refetchMessages
  }
}), [channelMessages, wsMessages, areMessagesLoading]);
```

REST provides the history. WebSocket provides the real-time updates. Both feed into the same array.

### Where things went wrong: the dual-send problem

The `MessageInput` component sends every message twice:

```tsx
// First: WebSocket for instant delivery
ws.send(JSON.stringify(data));

// Second: REST API for persistent storage
await postMessage({ apiKey, organizationId, message: data });
```

This is the problem. Two network requests for one message. If the REST API fails, the message is live in the chat but lost from history. The user sees it, but it disappears on refresh.

**Why I did it:** The WebSocket handler (`sockets.rs`) only publishes to Redis. It does not save to the database. I split the responsibility: WebSocket for real-time, REST for persistence. It seemed clean. It was not.

**What I should have done:** Send the message via WebSocket only. Have the server-side WebSocket handler save to the database before broadcasting to Redis. One path. One source of truth.

```rust
// In sockets.rs, when a message arrives:
async fn handle_socket_message(msg: ClientMessage, state: AppState) {
    // 1. Save to PostgreSQL
    let saved = db.insert_message(&msg).await;
    
    // 2. Broadcast to Redis
    if saved.is_ok() {
        redis.publish(&channel, &msg).await;
    }
}
```

This is simpler. The client sends once. The server guarantees persistence before broadcast. If the save fails, the message does not appear in the chat.

The trade-off: the WebSocket handler now needs database access. But it already has the `state` object with `db`, `redis`, and `stripe`. The connection is there. I just did not use it.

**The real mistake:** I built the WebSocket as a "dumb pipe" and made the frontend handle complexity. The frontend should be simple. The backend should be smart.

### Publishing to npm

I published `@rechat-sdk/react` to npm. Built with `tsup` for fast bundling. Dual CJS/ESM output. Type declarations included.

Peer dependencies for React. I knew this from the start — don't bundle React into the SDK. I had read enough SDK documentation to know this is standard practice.

### What I learned

- Context is the right pattern for shared state that rarely changes (connection, user info).
- Hooks are the right pattern for data that changes often (messages, channels).
- `useRef` for the WebSocket instance. `useState` for reactive values (messages, connection status).
- Cleanup functions in `useEffect` are critical. Leaked WebSocket connections pile up fast.
- Peer dependencies for React. Don't bundle React into the SDK.

### What I'd add next

- **Reconnection with exponential backoff** — currently, if the WebSocket drops, the user must refresh.
- **Optimistic UI for message sending** — show the message immediately, roll back if the server fails.
- **Server-side persistence** — the most important fix. The WebSocket handler should save to the database before broadcasting. This eliminates the dual-send problem entirely.
- **Infinite scroll for message history** — pagination for large channels.
- **Typing indicators via WebSocket** — show when other users are typing.
