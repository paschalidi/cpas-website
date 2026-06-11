---
title: "Concepts in FastAPI and TypeScript/Node.js"
author: Christos Paschalidis
date: 2026-02-20
excerpt: "A living reference of 20+ concepts that separate senior engineers from staff engineers. Asyncio internals, event loop phases, type system depth, dependency injection lifecycle, and the subtle architectural decisions that break systems at scale."
---

A living reference of 20+ concepts that separate senior engineers from staff engineers. Asyncio internals, event loop phases, type system depth, dependency injection lifecycle, and the subtle architectural decisions that break systems at scale.

## Python / FastAPI

### 1. Async/await, event loop, and async def vs sync route handlers
- `asyncio.run()` creates the event loop, runs the coroutine, and cleans up
- `asyncio.create_task()` schedules a coroutine for concurrent execution
- `asyncio.gather()` runs multiple awaitables concurrently and waits for all
- `asyncio.TaskGroup` (Python 3.11+) provides structural concurrency — all tasks finish or all are cancelled
- **Key difference:** `await coro()` blocks here; `create_task(coro())` runs concurrently
- In FastAPI: `async def` routes run directly on the event loop; `def` routes run in a thread pool via `run_in_executor`
- **Trap for TS devs:** Python coroutines are lazy — they do nothing until awaited or task-wrapped. TS promises start immediately on function call.

### 2. Pydantic models — validation, BaseModel, v1 vs v2 differences
- `BaseModel` provides automatic validation, serialization, and JSON schema generation
- Pydantic v2 (2023) is a complete rewrite — `pydantic-core` is Rust under the hood, 5-50x faster
- `model_validate()` vs `model_construct()` — construct skips validation, 2x faster on trusted data
- Custom validators: `@field_validator`, `@model_validator`, `@computed_field`
- FastAPI uses Pydantic models for request/response types, OpenAPI schema generation, and type-safe dependency injection

### 3. Dependency injection via Depends
- `Depends()` is a callable that FastAPI resolves before the route handler runs
- `yield` dependencies provide resource cleanup (DB sessions, transactions, temp files)
- **Lifecycle:** `scope` (app vs request), `use_cache` (singleton vs per-request), `yield` (setup/teardown)
- **Critical:** What happens when a `yield` dependency raises after the handler already returned? The response is already sent — the error is logged but not propagated.
- Nested dependencies: `Depends()` can itself depend on other `Depends()` — resolution is a DAG
- `async def` vs `def` dependencies: same rules as routes — `async` runs on loop, `def` runs in thread pool

### 4. Middleware, request/response lifecycle, and background tasks
- `@app.middleware("http")` vs `@app.middleware("ws")` — different protocols, different middleware chains
- Middleware ordering: first added runs first on request, last on response (like an onion)
- `BackgroundTasks`: tasks that run after the response is sent. **Not reliable** — if the process crashes, the task is lost. Use Celery/ARQ for guaranteed delivery.
- **BackgroundTasks failure handling:** Since the response is already sent, errors cannot be propagated. You must log and monitor. Staff engineers know when to use `BackgroundTasks` (fire-and-forget) vs a task queue (guaranteed execution).
- `Request` and `Response` objects: `Request` body can only be read once; `Response` can be modified by middleware after the handler returns
- Custom `JSONResponse`, `StreamingResponse`, `FileResponse` — each has different memory and latency implications

### 5. ASGI vs WSGI, and the server stack
- **WSGI** (Web Server Gateway Interface): synchronous, blocking, one request per thread. Flask, Django (sync mode).
- **ASGI** (Asynchronous Server Gateway Interface): async, non-blocking, one thread handles thousands of concurrent connections via the event loop. FastAPI, Django Channels.
- **Uvicorn**: ASGI server built on `uvloop` (libuv-based, 2-4x faster than default asyncio) and `httptools`. The event loop lives in the Uvicorn process.
- **Gunicorn with Uvicorn workers**: Gunicorn manages multiple worker processes; each worker is a Uvicorn instance with its own event loop. This is the production pattern for CPU-bound endpoints (multi-process) + async I/O (per-process event loop).
- **Hypercorn**: Alternative ASGI server, supports HTTP/2 and WebSockets natively.
- **ASGI lifespan protocol:** `startup` and `shutdown` events. Modern FastAPI uses the `lifespan` context manager instead of `@app.on_event`.

### 6. Concurrency vs parallelism — asyncio.gather, avoiding blocking calls, run_in_executor, the GIL
- **Concurrency** (asyncio): multiple tasks making progress on a single thread. The event loop switches between tasks when they `await`.
- **Parallelism** (multiprocessing): multiple processes on multiple CPU cores. Python's GIL prevents true parallelism in threads.
- **The GIL (Global Interpreter Lock):** One thread can execute Python bytecode at a time. This means:
  - **I/O-bound:** GIL is released during I/O (network, DB). Asyncio shines here.
  - **CPU-bound:** GIL blocks. Use `ProcessPoolExecutor` (spawns separate Python processes) or `multiprocessing`.
- **asyncio.gather()** vs **TaskGroup**: `gather` returns results in order; `TaskGroup` cancels all tasks if one fails.
- **Avoiding blocking calls:** Calling `time.sleep(5)` in an async route blocks the entire event loop for 5 seconds. Use `await asyncio.sleep(5)` or `await asyncio.to_thread(time.sleep, 5)`.
- **run_in_executor:** Run sync code (e.g., `requests.get`, `PIL.Image.open`) in a thread pool so it doesn't block the loop.

### 7. Type hints, generics, TypeVar, Protocol, and how FastAPI uses them for OpenAPI
- `TypeVar`, `Generic`, `Protocol` — building type-safe abstractions
- `Protocol` (structural subtyping): "anything with a `.read()` method" — no inheritance needed
- `ParamSpec`, `Concatenate` — type-safe decorators that preserve function signatures
- FastAPI uses these to auto-generate OpenAPI schemas from your type hints
- `@overload` — multiple function signatures for different input types
- **Type annotation at scale:** `TypeAlias`, `NewType`, `Annotated` (metadata + validation), `Self` (Python 3.11+)
- `asyncio` is fully typed; `mypy` or `pyright` can catch missing `await`, wrong return types, etc.

### 8. Auth patterns — OAuth2, JWT, OAuth2PasswordBearer, scopes, security dependencies
- `OAuth2PasswordBearer` — FastAPI's built-in OAuth2 flow with password token endpoint
- `Security` dependencies — `Depends()` with `Security` class for scopes and role-based access
- JWT (JSON Web Tokens) — `python-jose` or `PyJWT` for encoding/decoding, `fastapi.security` for integration
- **Scopes:** `security_scopes=["admin", "read"]` — the dependency system checks if the token has the required scope
- **Password hashing:** `bcrypt` or `argon2` — never store plaintext, always use a slow hash function
- **API key auth:** `APIKeyHeader` or `APIKeyQuery` — for service-to-service auth, simpler than OAuth2
- **Session-based auth:** `SessionMiddleware` with signed cookies — `itsdangerous` for signing, `httpx` for async requests

### 9. Database integration — async ORMs, connection pooling, session lifecycle
- **SQLAlchemy 2.0 async:** `create_async_engine`, `AsyncSession`, `async_sessionmaker`
- **asyncpg:** Native PostgreSQL driver for asyncio. Non-blocking, 2-3x faster than psycopg2. Uses `epoll`/`kqueue` directly.
- **Connection pooling:** `asyncpg.create_pool()` — holds open connections, reuses them. **Critical:** Set `pool_size` + `max_overflow` + `pool_timeout` to match your DB's `max_connections`.
- **Session lifecycle:** `session.begin()` (transaction), `session.commit()` (flush + commit), `session.rollback()` (on error). `yield` in FastAPI dependency ensures cleanup.
- **N+1 problem:** `selectinload` (async) or `joinedload` (eager loading) to prevent multiple round-trips.
- **SQLModel:** Combines Pydantic models with SQLAlchemy tables — single source of truth for data validation and persistence.

### 10. Testing, caching, pagination, streaming responses, rate limiting
- **TestClient:** `from fastapi.testclient import TestClient` — sync client for testing async endpoints. Runs endpoints in a thread pool but uses the same ASGI app.
- **httpx.AsyncClient:** For true async testing — e.g., testing streaming endpoints.
- **Caching:** `aiocache` (Redis/Memcached), `cachetools` (in-memory), `fastapi-cache` (decorator-based). Key: cache invalidation strategy (TTL vs event-based).
- **Pagination:** `limit` + `offset` (simple, slow on large tables) vs `cursor` (keyset pagination, scalable). Use `sqlalchemy` window functions for cursor-based.
- **Streaming responses:** `StreamingResponse` with a generator — yields chunks as they're ready. Perfect for large datasets or real-time data. `yield` from an async generator.
- **Rate limiting:** `slowapi` (Redis-backed, `Limiter` decorator), `fastapi-limiter` (token bucket). Use Redis for distributed rate limiting across multiple server instances.

### 11. Missing from the above — Staff Engineer additions
- **ASGI lifespan protocol:** The `lifespan` context manager (`@asynccontextmanager`) is the modern way to handle startup/shutdown. Replaces `@app.on_event`.
- **Event loop blocking detection:** `loop.slow_callback_duration` (warn if a callback takes > 100ms), `aiomonitor` (attach to a running loop), `asyncio.run(..., debug=True)`.
- **Pydantic V2 internals:** `model_config` (strict mode, str_max_length, etc.), `__get_pydantic_core_schema__` for custom types, `pydantic-core` Rust validators.
- **APIRouter and versioning:** `APIRouter` for modular routes, `prefix`, `tags`, `dependencies`. Versioning via `prefix="/v1"` or `version=` parameter.
- **Exception handlers:** `@app.exception_handler(HTTPException)` vs `@app.exception_handler(RequestValidationError)`. Override FastAPI's default 422 response format.
- **OpenTelemetry instrumentation:** Tracing across async boundaries — `opentelemetry-instrumentation-fastapi`, `asyncpg` spans. Where traces break in asyncio (context propagation across `create_task`).
- **Graceful shutdown:** `SIGTERM` handler, draining connections, closing DB pools. `http.Server.close()` callback, `await engine.dispose()`.
- **File uploads:** `UploadFile` (spooled to disk for large files), `File` (in-memory for small). Multipart form handling, `StreamingResponse` for serving large files.
- **CORS and security headers:** `CORSMiddleware` (origins, credentials, methods), `SecurityHeadersMiddleware` (HSTS, CSP, X-Frame-Options).
- **Configuration management:** `pydantic-settings` (env vars, `.env` files, secrets managers), `BaseSettings` with validation.

---

## TypeScript / Node.js

### 1. The event loop, microtasks vs macrotasks, process.nextTick, and phases
- **libuv event loop phases:** timers → pending callbacks → idle/prepare → poll (I/O) → check (setImmediate) → close callbacks
- **Microtasks** (Promise `.then()`, `queueMicrotask`): run between every phase, before the next phase starts. Not between individual callbacks in the same phase.
- **Macrotasks** (timers, I/O, `setImmediate`): run one phase at a time, FIFO within each phase.
- **process.nextTick:** Not technically part of the event loop. Runs immediately after the current C++ operation, before any microtasks or event loop phases. Can starve the loop if called recursively.
- **setImmediate vs setTimeout(fn, 0):** `setImmediate` fires after the poll phase (I/O). `setTimeout` fires after the timer phase. If both are called from the main module, the order is unpredictable (CPU-bound). If called from an I/O callback, `setImmediate` always fires first.
- **The key rule:** `process.nextTick` > microtasks (Promise) > macrotasks (timers, I/O). This is why `await Promise.resolve()` before a `setTimeout` runs first.

### 2. Advanced types — generics, conditional types, mapped types, utility types, discriminated unions, infer
- **Generics:** `function identity<T>(arg: T): T` — type-safe reusable functions/classes
- **Conditional types:** `type IsString<T> = T extends string ? true : false` — "if type, then type"
- **Mapped types:** `type Readonly<T> = { readonly [K in keyof T]: T[K] }` — transform every property
- **Utility types:** `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `ReturnType`, `Parameters` — built-in type transformations
- **Discriminated unions:** `{ type: 'success', data: T } | { type: 'error', error: E }` — exhaustiveness checking with `switch` on `type`
- **infer:** `type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never` — extract the return type from a function type
- **Template literal types:** `type EventName<T> = `on${Capitalize<T>}` — type-safe string literals
- **Keyof / typeof:** `type UserKeys = keyof typeof user` — derive types from runtime values

### 3. type vs interface, structural typing, declaration merging, unknown vs any
- **type vs interface:** `interface` can be extended (`extends`), merged (declaration merging), and is more readable for object shapes. `type` can do unions, intersections, mapped types, conditional types. `interface` is generally preferred for object shapes; `type` for complex transformations.
- **Structural typing:** TypeScript matches shapes, not names. `{ name: string }` matches `interface Person { name: string }` even without explicit `implements`.
- **Declaration merging:** Multiple `interface` declarations with the same name merge into one. This is how `Window` and `Express.Request` can be extended by libraries.
- **unknown vs any:** `any` disables all type checking. `unknown` is the type-safe alternative — you must narrow it (e.g., `if (typeof x === 'string')`) before using it. Staff engineers use `unknown` for catch clauses and external API responses.
- **Type narrowing:** `typeof`, `instanceof`, `in` operator, `Array.isArray`, custom type guards (`is User`), discriminated unions.
- **Satisfies operator:** `const config = { ... } satisfies Config` — checks type without widening the inferred type. Better than `as Config` for literal types.

### 4. Async patterns — Promises, async/await, Promise.all/allSettled/race, error propagation
- **Promises:** `new Promise((resolve, reject) => { ... })` — represents a future value. `resolve`/`reject` settle the promise.
- **async/await:** Syntactic sugar over Promises. `async function` always returns a Promise. `await` unwraps the value.
- **Promise.all:** Runs all promises concurrently. Rejects immediately if any rejects. Use when all must succeed.
- **Promise.allSettled:** Runs all, waits for all, never rejects. Returns `{ status: 'fulfilled', value } | { status: 'rejected', reason }` for each.
- **Promise.race:** Resolves/rejects with the first promise to settle. Use for timeouts: `Promise.race([fetch(url), timeout(5000)])`.
- **Error propagation:** `try/catch` around `await`. For `Promise.all`, a single rejection rejects the whole batch. Use `allSettled` or individual `.catch()` per promise.
- **Async iteration:** `for await (const chunk of stream)` — async generators and async iterables.
- **Top-level await:** `await fetch(...)` at the module level (ES modules only). Node.js and modern browsers support this.
- **Callback hell:** Avoided with `async/await`, but callbacks still exist in Node.js core APIs (`fs.readFile`, `crypto.pbkdf2`). Use `util.promisify` or the native Promise-based APIs (`fs.promises`).

### 5. Module systems — ESM vs CommonJS, interop pitfalls, tsconfig settings
- **CommonJS (CJS):** `require()` / `module.exports` — synchronous, dynamic, default in Node.js historically. `require()` can be called anywhere in the file.
- **ES Modules (ESM):** `import` / `export` — static, tree-shakeable, modern standard. `import` is hoisted to the top of the file.
- **Interop:** `require()` an ESM module from CJS is impossible in Node.js (no `require()` for ESM). `import` a CJS module from ESM works (Node.js treats it as a default export).
- **tsconfig.json settings:** `module` (output format), `target` (JS version), `moduleResolution` (how imports are resolved), `esModuleInterop` (sane import behavior for CJS), `allowSyntheticDefaultImports`.
- **`__dirname` / `__filename` in ESM:** No direct equivalent. Use `import.meta.url` + `fileURLToPath` + `dirname` from `path`.
- **`package.json` exports field:** `exports` for subpath imports (e.g., `import { x } from 'pkg/subpath'`). Replaces `main` and `module` fields.
- **Named exports from CJS:** `import { named } from 'cjs-module'` may fail. Use `import cjs from 'cjs-module'; const { named } = cjs` or `esModuleInterop: true`.
- **Top-level await in CJS:** Not supported. Only in ESM (`"type": "module"` in `package.json` or `.mjs` files).

### 6. Streams and backpressure, buffers, and handling large I/O
- **Node.js streams:** `Readable`, `Writable`, `Duplex`, `Transform`. Pipe with `readable.pipe(writable)`.
- **Backpressure:** `writable.write(chunk)` returns `false` when the internal buffer exceeds `highWaterMark`. The writable emits `drain` when it's ready for more. **Not handling backpressure = unbounded memory growth = OOM.**
- **Stream types:** Memory (string/buffer), Object mode (JS objects), Flowing mode (auto-read), Paused mode (manual `.read()`).
- **Buffer:** `Buffer` is a fixed-size allocation of raw bytes. `Buffer.alloc()` vs `Buffer.allocUnsafe()` (faster, may contain old data). `Buffer.from()` from string/array.
- **TypedArray / ArrayBuffer:** `Uint8Array`, `Uint16Array`, `ArrayBuffer` (underlying memory), `SharedArrayBuffer` (shared across worker threads). `Buffer` is a subclass of `Uint8Array`.
- **Handling large I/O:** Stream large files instead of loading into memory. Use `stream.pipeline()` for automatic cleanup on error. `ReadableStream` / `WritableStream` (Web Streams API) is the modern standard, supported in Node.js 18+.
- **Stream backpressure across boundaries:** Piping a `Readable` into an HTTP response into a `Writable` — where does it stall if the client is slow? Use `pipeline()` for automatic backpressure management.
- **Buffer pool:** `Buffer` allocations > 4KB are not pooled. Small allocations are pooled for performance. `Buffer.poolSize` controls the pool size.

### 7. Worker threads, cluster module, child processes — scaling Node across cores
- **Worker threads:** `worker_threads` module — run JavaScript in separate threads with message passing. Share memory via `SharedArrayBuffer` and `Atomics`. One event loop per thread.
- **Cluster module:** `cluster` — fork the main process into multiple worker processes, all sharing the same port. The OS load-balances connections. Built-in master/worker model.
- **Child processes:** `child_process.spawn()` (streams), `child_process.exec()` (buffer, shell), `child_process.fork()` (IPC). Run separate binaries or scripts.
- **When to use which:**
  - **Worker threads:** CPU-intensive work (image processing, crypto) within the same process. Share memory, but no shared event loop.
  - **Cluster:** Scale HTTP servers across CPU cores. Each worker is a separate process with its own event loop.
  - **Child processes:** Run external commands (Python scripts, imageMagick, ffmpeg), or isolate untrusted code.
- **libuv thread pool:** `UV_THREADPOOL_SIZE` (default: 4). All file system ops, DNS lookups, and crypto operations go through it. **Critical:** If you have 50 concurrent file reads, they will queue up after the first 4. Increase this for file-heavy workloads.

### 8. Express / Fastify / NestJS — middleware, routing, dependency injection, request lifecycle
- **Express:** Minimal, callback-based. `app.use(middleware)` for global, `app.get('/path', handler)` for routes. `req`, `res`, `next` pattern.
- **Fastify:** Schema-based, 2x faster than Express. Built-in JSON schema validation, hooks (`onRequest`, `preHandler`, `onSend`, `onResponse`), and plugin system.
- **NestJS:** Angular-inspired, heavily uses decorators (`@Controller`, `@Get`, `@Injectable`). Built-in DI container, modules, guards, interceptors, pipes.
- **Middleware ordering:** First `use()` runs first on request, last on response. In Express, order matters for route matching and error handling.
- **Request lifecycle:** Request → Middleware → Route Handler → Response. In NestJS: Guards → Interceptors → Pipes → Handler → Interceptors → Exception Filters.
- **Dependency injection:** NestJS uses `reflect-metadata` and decorators for DI. Fastify uses `fastify-plugin` for encapsulation. Express has no built-in DI — use `awilix` or manual container.
- **Error handling:** Express: `app.use((err, req, res, next) => { ... })` — error-handling middleware. NestJS: `@Catch(HttpException)` exception filters.
- **Graceful shutdown:** `server.close()` stops accepting new connections. `process.on('SIGTERM', ...)` for cleanup. NestJS has `app.enableShutdownHooks()`.

### 9. Error handling — typed errors, unknown in catch, unhandled rejections, graceful shutdown
- **Typed errors:** `class CustomError extends Error { constructor(public code: string, public status: number) { super(...) } }` — add metadata to errors for structured logging and client responses.
- **unknown in catch:** `catch (e: unknown)` — TypeScript 4.4+ default. Must narrow before using `e.message` (e.g., `if (e instanceof Error)`). Never use `any` in catch.
- **Operational vs programmer errors:**
  - **Operational:** `ECONNRESET`, `ETIMEDOUT`, `ENOENT` — retryable, external failure. Log and retry or degrade gracefully.
  - **Programmer:** `TypeError`, `ReferenceError`, logic bugs — crash the process. Use `process.on('uncaughtException', ...)` only for logging, then exit.
- **Unhandled rejections:** `process.on('unhandledRejection', ...)` — catch promises that reject without `.catch()`. In Node.js 15+, unhandled rejections throw by default (can crash the process). Fix the code, don't suppress.
- **Graceful shutdown:** `SIGTERM` handler (Kubernetes sends this), drain connections, close DB pools, flush logs. `server.close()` callback, then `process.exit(0)`. Use `process.on('SIGINT', ...)` for Ctrl+C.
- **AbortController / AbortSignal:** `const controller = new AbortController(); fetch(url, { signal: controller.signal })` — cancel in-flight requests. `controller.abort()` triggers `AbortError`. Essential for timeouts and cleanup.

### 10. Tooling and runtime — tsc vs esbuild/swc, bundling, source maps, memory/GC profiling, npm/pnpm
- **tsc:** TypeScript compiler. Slow (1000s of files). Use for type checking only (`tsc --noEmit`). Not for production bundling.
- **esbuild / swc:** Rust-based transpilers. 10-100x faster than tsc. `swc` is used by Next.js, Vite. `esbuild` is used by Vite.
- **Bundling:** Vite (esbuild + Rollup), Webpack (plugin ecosystem), esbuild (fast, minimal), Rollup (tree-shaking). Bundle for browser, not for Node.js (use `tsc` or `ts-node` for Node).
- **Source maps:** `sourcemap: true` in `tsconfig.json`. Maps compiled JS back to TS for debugging. `//# sourceMappingURL=...` comment. Use `inline-source-map` for development, `source-map` for production.
- **Memory/GC profiling:** `--inspect` flag (Chrome DevTools), `heapdump` (snapshot), `--trace-gc` (GC frequency), `clinic` (flamegraphs, doctor, bubbleprof), `0x` (CPU flamegraph).
- **npm / pnpm:** `npm` (flat, single lockfile), `pnpm` (content-addressable store, strict peer deps, faster). `pnpm` prevents phantom dependencies (packages that aren't in your `package.json` but work because a dep brought them). Staff engineers prefer `pnpm` for monorepos.
- **npm dependency graph:** `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm). `npm audit` for vulnerabilities. `overrides` (npm) / `resolutions` (yarn) for forcing transitive dep versions. `depcheck` for unused deps.
- **Monorepo tools:** `turborepo` (task runner, caching), `nx` (full monorepo framework). `pnpm workspaces` for simple monorepos.
- **Runtime flags:** `--max-old-space-size=4096` (heap size), `--expose-gc` (manual GC), `--enable-source-maps` (native source map support in Node.js 12+), `--heapsnapshot-near-heap-limit` (auto heapdump on OOM).
- **Environment configuration:** `zod` for env validation (`const env = z.object({ PORT: z.string().transform(Number) }).parse(process.env)`). `dotenv` for `.env` files. Never commit `.env` files.

### 11. Missing from the above — Staff Engineer additions
- **Memory leak patterns in async code:** Growing arrays in closures, `setInterval` without `clearInterval`, EventEmitter `maxListeners`, dangling promises that hold references. Use `async_hooks` for async context tracking, `heapdump` + Chrome DevTools for finding leaking objects.
- **npm dependency graph & supply chain:** `package-lock.json` structure, `overrides`/`resolutions`, `npm audit`, `depcheck`. Supply chain attacks (e.g., `event-stream`, `node-ipc`). `sigstore` / `provenance` for signed packages (npm 10+). Staff engineers lock and audit the full dependency tree.
- **Diagnostics depth:** `clinic` (flamegraphs, doctor, bubbleprof), `0x` (CPU), `--trace-gc` (GC pressure), `--prof` (V8 profiling), `perf_hooks` for in-code measurement. `AsyncLocalStorage` (Node.js 16.4+) for context propagation across async boundaries.
- **Error classification & recoverability:** Operational (retryable: `ECONNRESET`, `ETIMEDOUT`) vs programmer (crash). `throw` vs `EventEmitter 'error'` vs unhandled rejection — which one kills the process? Design error boundaries that retry one and crash for the other.
- **EventEmitter at scale:** `emitter.on('error')` is mandatory — uncaught `error` events crash the process. `maxListeners` warning (default 10). Memory leaks from anonymous listeners. Use `once()` for one-off events, `removeListener()` for cleanup.
- **Node runtime flags:** `NODE_OPTIONS` (env var for flags), `UV_THREADPOOL_SIZE` (libuv pool), `NODE_ENV` (development vs production). `node --version` and `process.version` for runtime checks.
- **Crypto and security:** `crypto` module for hashing (`pbkdf2`, `scrypt`), random bytes (`randomBytes`), timing-safe comparison (`timingSafeEqual`). `crypto.createHash` for non-password hashing (e.g., cache keys). `crypto.subtle` (Web Crypto API) for browser-compatible crypto.
- **Buffer and TypedArray:** `Buffer` (Node.js specific), `Uint8Array` (standard), `ArrayBuffer` (underlying memory), `SharedArrayBuffer` (shared across worker threads). `Buffer.poolSize` (default 8KB), `Buffer.allocUnsafe()` vs `Buffer.alloc()`. Pool allocation for small buffers.
- **Stream backpressure across boundaries:** Piping a `Readable` into an HTTP response into a `Writable` — where does it stall if the client is slow? `stream.pipeline()` for automatic cleanup and backpressure. `pipeline(source, transform, destination)`.
- **ESM/CommonJS interop:** Named exports from CJS (`import { named } from 'cjs'` fails). `__dirname` equivalent in ESM (`import.meta.url` + `fileURLToPath`). `package.json` `type: "module"` vs `.mjs` extension. `ts-node` and ESM (use `--esm` or `ts-node-esm`).
- **Graceful shutdown:** `SIGTERM` handler (Kubernetes), drain connections, close DB pools, flush logs. `server.close()` callback, `http.Server.close()`. `process.on('SIGINT', ...)` for Ctrl+C. `process.on('SIGTERM', ...)` for container shutdown. `process.on('exit', ...)` for synchronous cleanup only.
- **Test runners:** Node.js built-in `node:test` (Node 18+), `vitest` (fast, Vite-native), `jest` (slow but mature). `node:test` with `assert` is the modern minimal choice.
- **Performance hooks:** `perf_hooks` module (`performance.now()`, `PerformanceObserver`), `perf_hooks.performance.mark()` / `measure()` for custom timing. `perf_hooks.monitorEventLoopDelay()` for detecting event loop lag.
- **AbortController / AbortSignal:** `AbortController` for cancellation (fetch, streams, timers). `AbortSignal.timeout(ms)` (Node.js 18+). `AbortSignal` for `setTimeout` cancellation (Node.js 20+). `addEventListener('abort', ...)` for cleanup.
- **Real-time communication:** WebSockets (`ws` library), Server-Sent Events (SSE), `Socket.IO` (fallbacks). WebSocket backpressure (`ws.bufferedAmount`), heartbeat/ping-pong, reconnection logic. SSE for one-way server-to-client (simpler, auto-reconnect via HTTP). WebSockets for bidirectional (games, chat).
- **Microservices patterns:** API Gateway (Kong, Ambassador), service mesh (Istio, Linkerd), circuit breakers (`opossum` library), bulkheads, retries with exponential backoff (`p-retry`), idempotency keys.
- **Design patterns in TypeScript:** Repository pattern (data access abstraction), CQRS (Command Query Responsibility Segregation), Event Sourcing (append-only log of events), Domain-Driven Design (aggregates, entities, value objects). `tsyringe` or `inversify` for DI containers.
- **Observability:** OpenTelemetry (`@opentelemetry/api`, `@opentelemetry/sdk-node`), tracing (`@opentelemetry/instrumentation-http`), metrics (`@opentelemetry/exporter-prometheus`), logging (`pino` — structured, fast). `trace.getActiveSpan()` for context propagation. `Baggage` for cross-service metadata.
- **GraphQL:** `apollo-server` / `graphql-yoga`, resolvers, type generation (`graphql-codegen`), N+1 problem (`dataloader`), schema stitching, federation (`@apollo/federation`). GraphQL vs REST trade-offs (over-fetching, under-fetching, caching complexity).
- **Authentication & authorization:** JWT (stateless, short-lived), sessions (stateful, server-side), OAuth2 (authorization code flow, PKCE), OpenID Connect (identity layer on OAuth2), SAML (enterprise SSO). `passport.js` (Express), `fastify-passport` (Fastify), `@nestjs/passport` (NestJS). RBAC (Role-Based Access Control) vs ABAC (Attribute-Based Access Control).
- **Security best practices:** Helmet.js (security headers), CORS (whitelist origins, not `*`), rate limiting (`express-rate-limit`), input validation (`zod`, `joi`, `class-validator`), SQL injection prevention (parameterized queries), XSS prevention (output encoding), CSRF tokens. `npm audit` and `snyk` for vulnerability scanning.
- **Build tooling configuration:** `esbuild` (fast, minimal config), `swc` (Rust-based, Next.js default), `tsc` (type checking only). `tsup` (zero-config bundler for libraries). `rollup` (tree-shaking, library builds). `vite` (dev server + bundler). `webpack` (mature, complex config). `parcel` (zero-config, slower). `bun` (all-in-one, fast, experimental). `tsconfig.json` settings: `strict`, `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`.
- **Environment configuration:** `zod` for env validation (`z.object({ PORT: z.string().transform(Number) }).parse(process.env)`). `dotenv` for `.env` files. `dotenv-expand` for variable interpolation. `envalid` for built-in validation. Never commit `.env` files. Use `.env.example` for documentation.
- **CI/CD patterns:** GitHub Actions (workflows, matrix builds, caching), `actions/setup-node`, `actions/cache` for `node_modules`, semantic versioning (`semantic-release`), conventional commits (`commitlint`), pre-commit hooks (`husky`, `lint-staged`). Docker multi-stage builds for production. Health checks (`/health`, `/ready`) for Kubernetes probes.
- **Package manager deep comparison:** `npm` (v8+ workspaces, `package-lock.json`), `yarn` (v1 classic, v2+ berry, PnP, `.yarn/cache`), `pnpm` (content-addressable store, strict peer deps, `pnpm-lock.yaml`, `shamefully-hoist` for compatibility). `corepack` (built-in package manager manager, Node.js 16.10+). Staff engineers choose `pnpm` for monorepos and `npm` for simple projects.

---

## Go — For comparison

### Foundation
- **Concurrency model:** Goroutines (lightweight threads, ~4KB stack, preemptively scheduled) + channels (typed, first-class communication). No event loop. No `async`/`await`. M:N scheduler multiplexes goroutines onto OS threads.
- **I/O model:** All I/O appears blocking to goroutines. The runtime parks the goroutine and resumes it when the I/O is ready. Under the hood: `netpoller` (epoll/kqueue/IOCP). True non-blocking for network, thread pool for file I/O.
- **Goroutines vs Python tasks:** Python tasks are coroutines (cooperative, `await` points). Go goroutines are green threads (preemptive, can switch at any function call). Go has no `await` — just `go func()`.
- **Channels:** `chan T` — buffered or unbuffered. `select` for non-blocking communication over multiple channels. `close(ch)` for signaling completion. `range` over channel for reading until closed.
- **Error handling:** No exceptions. Functions return `(result, error)`. `if err != nil` everywhere. `panic`/`recover` for rare, unrecoverable errors (like `throw` but used sparingly).
- **Type system:** Structural typing (interfaces satisfied implicitly). No classes. No inheritance. Composition over inheritance. `interface{}` (empty interface, like `any` in TS) replaced by `any` in Go 1.18+.
- **Sync primitives:** `sync.Mutex`, `sync.RWMutex`, `sync.WaitGroup` (wait for N goroutines), `sync.Once` (run once), `sync.Cond` (condition variable), `sync.Pool` (object pool). `atomic` package for lock-free operations.
- **Context package:** `context.Context` for cancellation, deadlines, and request-scoped values. Passed as the first argument to every function. `context.WithTimeout`, `context.WithCancel`, `context.WithDeadline`. Critical for goroutine lifecycle management.
- **Testing:** `testing` package (built-in). `t.Parallel()` for parallel tests. `testify` for assertions. `httptest` for HTTP testing. `gomock` for mocking. No frameworks needed — Go's built-in testing is sufficient.
- **Tooling:** `go` command (build, test, run, mod, fmt, vet, doc). `go mod` for dependency management. `gofmt` for formatting. `go vet` for static analysis. `golangci-lint` for comprehensive linting. `pprof` for CPU and memory profiling. `trace` for execution tracing. `benchstat` for benchmark comparison.
