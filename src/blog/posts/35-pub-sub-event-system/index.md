---
title: "How We Route Events Between Services — A Pub/Sub Architecture"
author: Christos Paschalidis
date: 2026-06-08
excerpt: "A field guide to event-driven architecture: how we publish, route, and consume events across a Django app using Google Pub/Sub, and why the routing registry lives outside the code."
---

## Introduction

Something happens — an appointment is created, a customer is updated. The code that triggered it does not call the next service. It publishes a fact to a **topic**, and any service with a **subscription** receives a copy — independently, asynchronously, without the publisher knowing who they are.

This gives you three kinds of decoupling. **Temporal**: the consumer does not need to be running when the event is published — the broker holds it. **Spatial**: the publisher does not know the consumer's address or even its existence. **Flow**: the HTTP request is not blocked by downstream processing — the event ships in the background and the user gets a response immediately.

This article shows one production implementation. It is not the only way to build an event system, but the tradeoffs are instructive.

## The Shape of the System

The flow is three stages. Each stage has a single responsibility, and a single reason to change.

```
Publish  →  Route  →  Receive
```

### Stage 1: Publish

The app emits events. An event is a dataclass: `data` and `topic`. The app does not call Pub/Sub directly. It defers to a background job.

Here is the entry point in `core/services/event_publisher/operations.py`:

```python
@dataclass(frozen=True, slots=True)
class Event(Generic[T]):
    data: T
    topic: str

class EventPublisher:
    @classmethod
    def publish(cls, event: Event[Any]) -> None:
        event_data = json.loads(json.dumps(event.data, cls=EventEncoder))
        event_publish_task.defer(event_data=event_data, topic=event.topic)
```

`EventEncoder` handles the boring serialization: UUIDs, dates, enums, nested dataclasses. The `publish` method does not touch the network. It writes to a task queue — Procrastinate, in our case (alternatives include Celery, RQ, or Django Q).

Why defer? Because the HTTP request that triggered this event should not block on a network round-trip to Google Cloud. The caller gets a 200ms response. The event ships in the background.

### Stage 2: The Background Job

`event_publish_task` lives in `app/task_queue/event_publish.py`. It has the retry logic:

```python
@app.task(
    retry=RetryStrategy(max_attempts=12, exponential_wait=3),
    pass_context=True,
)
def event_publish_task(
    job_context: JobContext, topic: str, event_data: dict[str, Any]
) -> None:
    try:
        publish(topic_id=topic, event_data=event_data)
    except Exception as e:
        log_error_if_exhausted_retries(topic, str(event_data.get("id")), job_context, e)
        raise
```

Twelve retries. Exponential backoff. The last failure is logged with `exhausted_event_publish_task_retries` so we know when the queue has given up. The task then calls `events_system.django_publisher.publish()`, which is the private PyPI package that wraps the actual Pub/Sub client.

### Stage 3: Route

Here is where it gets interesting. The app does not know where the event goes. It does not have a list of subscribers. It does not know if the orchestrator is listening, or both.

The routing registry lives in a separate repository: `infra/events/events.yml`. It looks like this:

```yaml
- event: customer-created
  description: "A new customer was registered"
  publishers: [auth, billing]
  subscribers:
    - name: orchestrator
      max_attempts: 15
      endpoint: /events/customer-created/
    - name: auth
      max_attempts: 10
      endpoint: /events/customer-created/
```

The deployment pipeline reads this file and configures Google Pub/Sub: one topic per event, one **push subscription** per subscriber. Push means the broker delivers the event by POSTing to an endpoint — the receiver never polls or holds a long-lived connection. The tradeoff is the endpoint must be reachable and reply within 10 seconds.

When the app publishes to `customer-created`, Pub/Sub POSTs the message to every endpoint simultaneously. The app is decoupled from the routing graph. A subscriber can be added without touching the publisher's code.

### Stage 4: Receive

The app exposes Ninja endpoints for receiving events. Here is the core receiver:

```python
@router.post("/<str:topic>/", auth=None)
@event_handler(
    audience=CORE_AUDIENCE,
    schema=EventData,
)
def event_receiver(
    _request: HttpRequest,
    _data: EventData,
    event: EventIn,
    path_parameters: dict[str, Any],
) -> tuple[int, None]:
    core_user = get_user_by_token(settings.CORE_SERVICE_USER_TOKEN)
    topic = str(path_parameters.get("topic"))
    
    EventProcessor.process(
        context=CoreCallContext(user=core_user, origin=f"event:{topic}"),
        topic=topic,
        data=event.message.data,
        meta=EventMeta(event_timestamp=event.message.publish_time),
    )
    return 200, None
```

The `@event_handler` decorator is from the `events-system` package. It does two things:

1. Verifies the JWT (the request comes from Google Pub/Sub, authenticated with a service account)
2. Deserializes the Pub/Sub push payload into `EventIn` and validates it against `EventData`

Then `EventProcessor` routes by topic name:

```python
class EventProcessor:
    @classmethod
    def process(cls, context: CoreCallContext, topic: str, data: EventData, meta: EventMeta | None = None):
        handler = event_handlers.get(topic)
        if not handler:
            raise errors.EventHandlerNotFound(topic=topic)
        handler.process(context=context, data=data, meta=meta)
```

The handler map is a simple dict:

```python
event_handlers = {
    "customer-created": CustomerUpsertHandler,
    "customer-updated": CustomerUpsertHandler,
}
```

Pub/Sub delivers **at least once**. If the broker does not receive an acknowledgement in time, it sends the event again. The same event can arrive twice. Every handler in this system is designed to be **idempotent** — processing the same event twice produces the same result.

## Trace one event through

Here is what happens, step by step, when a customer signs up and the auth service publishes `customer-created`.

1. **App code** creates an `Event` dataclass with topic `"customer-created"` and calls `EventPublisher.publish()`. No network — just serialization and a queue write.
2. The **task queue worker** wakes, calls the `events-system` package, which POSTs the message to the Pub/Sub topic.
3. **Pub/Sub** receives the message and checks the push subscriptions configured from `events.yml`. Three subscribers need this event.
4. **Push delivery** POSTs the event to each subscriber's endpoint simultaneously. The orchestrator, auth, and analytics each get their own HTTP request — one event, three deliveries.
5. **Ninja endpoint** receives the POST. The `@event_handler` decorator verifies the JWT — if the request is not from Google Pub/Sub, it is rejected before any code runs.
6. **EventProcessor** looks up `"customer-created"` in its handler map, finds `CustomerUpsertHandler`, and delegates to domain code. The customer record is created.

Six steps. Six responsibilities. No step knows what the next step does — only what data to pass along. That is the pattern.

## Why the Routing Registry is External

This is the decision worth explaining. We could have declared subscribers in the app. We could have had a `pubsub.py` in each app that lists who listens. We did not.

The routing registry is external for three reasons:

**1. The app should not know about the graph.**

An app that publishes `customer-created` should not know that the orchestrator, and the analytics pipeline all consume it. That knowledge is operational, not domain. It changes when we add a new subscriber. If the graph lived in the app, every new subscriber would require a code change and a deploy.

**2. The platform team owns the topics.**

The `events.yml` file is the contract. The infra repository is the natural place for that contract. It declares what topics exist, who may publish, and who must receive. This is the same pattern as a Terraform module or a Kubernetes manifest: the platform owns the wiring, not the application.

**3. The app is not the only publisher.**

Some services outside the app publish events. They also need to comply with the same routing registry. A central file in the infra repo is the single source of truth for all publishers.

## The Tradeoffs

**Pro: True decoupling.**

A team can add a new subscriber without touching the publisher's code. They add a line to `events.yml`. The infra repo deploys. The subscriber receives messages. No app deploy required.

**Pro: Centralized observability.**

The retry policies, endpoint health, and subscription metrics are all visible in one place. The platform team can see the full graph without grepping through Python code.

**Con: Two repositories to touch for a new event.**

To add a new event type, you must:

1. Add the publisher code in the app
2. Add the entry in `events.yml` in the infra repo
3. Add the handler in the receiving app

This is more work than a single PR. It requires coordination. But the benefit is that the publisher does not need to know about the receiver, and the platform team can review the routing graph independently.

**Con: The app cannot validate subscribers at test time.**

Because the subscriber list is not in the app, you cannot write a unit test that asserts "when I publish `customer-created`, the orchestrator receives it." That assertion belongs to the infra tests, not the application tests.

## What I Would Change

The `EventPublisher` and `EventEncoder` classes are duplicated across apps. `auth` has one. `billing` has one. They are identical. This should be a shared utility in `app/common/` or provided by the `events-system` package itself.

The `event_handlers` dict is manual. You must remember to add the mapping when you add a handler. A decorator-based auto-discovery system (`@register_handler("customer-created")`) would be safer. The risk of a missing mapping is an `EventHandlerNotFound` at runtime, which is worse than a test failure.

The retry policy of `event_publish_task` is aggressive: 12 attempts, exponential backoff. This means a failing publish will retry for over three days. The thinking is that Pub/Sub outages are transient and we should not lose events. But the cost is queue pressure. If a topic is misconfigured, the task will retry for days before giving up. A shorter retry with a dead-letter queue might be more honest.

## The Throughline

The architecture is a bet on decoupling. The app publishes events without knowing who consumes them. The routing graph lives in infra, not in application code. The background queue handles the network. The decorator handles the auth.

The result is that a developer can add a new event type by writing three files:

1. A publisher call in their app
2. An entry in `events.yml`
3. A handler in the receiving app

They do not need to know about the other subscribers. They do not need to redeploy the publisher when a new subscriber is added. The graph is external, the contracts are explicit, and the system is boring in the way that good infrastructure is boring.

---

*Built in production. The code is real, the patterns are reusable, the tradeoffs are yours to evaluate.*
