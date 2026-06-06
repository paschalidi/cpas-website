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

- Reconnection with exponential backoff
- Optimistic UI for message sending
- Infinite scroll for message history
- Typing indicators via WebSocket
