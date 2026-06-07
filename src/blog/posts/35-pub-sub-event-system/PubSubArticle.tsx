import React from 'react';
import {
  AnimatedPipeline,
  ArticleCard,
  StepList,
  YAMLBlock,
  MiniAnimation,
  CodeBlock,
} from '../../../components/blog';
import type { Step } from '../../../components/blog/StepList';

export default function PubSubArticle() {
  return (
    <div className="blog-content max-w-none">
      {/* ════════════════════════════════════
          PIPELINE ANIMATION
      ════════════════════════════════════ */}
      <AnimatedPipeline />

      {/* ════════════════════════════════════
          WHY — Three decouplings
      ════════════════════════════════════ */}
      <section id="publish" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          The idea
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Announce a fact. Walk away.
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          Something happens — an appointment is created, a customer is updated. The code that
          triggered it does <strong className="text-blog-text font-medium">not</strong> call the
          next service. It does not wait for a response. It publishes a fact to a{' '}
          <strong className="text-blog-text font-medium">topic</strong>, and any service with a{' '}
          <strong className="text-blog-text font-medium">subscription</strong> receives a copy —
          independently, asynchronously, without the publisher knowing who they are.
        </p>
        <p className="text-blog-muted/60 text-base leading-[1.8]">
          This gives you three kinds of decoupling.{' '}
          <strong className="text-blog-text font-medium">Temporal</strong>: the consumer does not
          need to be running when the event is published — Pub/Sub holds it until they are ready.{' '}
          <strong className="text-blog-text font-medium">Spatial</strong>: the publisher does not
          know the consumer's address or even its existence — the broker handles that.{' '}
          <strong className="text-blog-text font-medium">Flow</strong>: the HTTP request is not
          blocked by downstream processing —{' '}
          <code className="text-peach-200">EventPublisher.publish()</code> writes to a queue and
          returns immediately, so the user gets a response in milliseconds, not seconds. The rest
          of this article shows how we built each piece.
        </p>
      </section>

      {/* ════════════════════════════════════
          PUBLISH — Stage 1-2
      ════════════════════════════════════ */}
      <section className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Stage 1
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Publish
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          The app emits events. An event is a dataclass: data and topic. The app does not call
          Pub/Sub directly. It defers to a background job.
        </p>

        <hr className="border-blog-border/10 my-10" />

        <ArticleCard
          title="EventPublisher"
          subtitle="// core/services/event_publisher/operations.py"
          tag="Stage 1"
        >
          <p>
            The app wraps an event in a dataclass and passes it to the publisher. The publisher
            does not touch the network. It serializes the payload and writes to a task queue —
            Procrastinate, in our case (alternatives include Celery, RQ, or Django Q).
          </p>
          <CodeBlock language="python">{`# An event is just data + topic
@dataclass(frozen=True, slots=True)
class Event(Generic[T]):
    data: T
    topic: str

class EventPublisher:
    @classmethod
    def publish(cls, event: Event[Any]) -> None:
        event_data = json.loads(json.dumps(event.data, cls=EventEncoder))
        event_publish_task.defer(event_data=event_data, topic=event.topic)`}</CodeBlock>
          <p className="mt-4">
            The EventEncoder handles UUIDs, dates, enums, nested dataclasses. The{' '}
            <code>defer</code> call is the key: the HTTP request that triggered this event returns
            immediately. The event ships in the background.
          </p>
        </ArticleCard>

        <ArticleCard
          title="event_publish_task"
          subtitle="// app/task_queue/event_publish.py"
          tag="Stage 2"
        >
          <p>
            The background task has aggressive retry logic. Twelve attempts. Exponential backoff.
            It retries for over three days before giving up.
          </p>
          <CodeBlock language="python">{`@app.task(
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
        raise`}</CodeBlock>
          <p className="mt-4">
            The task calls <code>events_system.django_publisher.publish()</code> — the private
            PyPI package that wraps the actual Pub/Sub client. The retry policy means a transient
            outage does not lose the event. The cost is queue pressure.
          </p>
        </ArticleCard>
      </section>

      {/* ════════════════════════════════════
          TWO REPOS
      ════════════════════════════════════ */}
      <section id="route" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          The split
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Two repositories, one contract
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-8">
          The most important structural fact: the code that publishes an event and the
          configuration that routes it live in different repositories. This is deliberate — it's
          also your fastest debugging heuristic.
        </p>

        {/* Split cards — two-column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div
            className={`rounded-xl border border-blog-border/10 bg-blog-surface p-6`}
          >
            <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blog-accent/60 mb-2">
              Application
            </div>
            <h3 className="text-xl font-[350] tracking-tight text-blog-text mb-3">
              application
            </h3>
            <p className="text-blog-muted/60 text-sm leading-relaxed mb-4">
              The main application. Where events are born and where they land.
            </p>
            <ul className="space-y-2 text-sm text-blog-muted/60">
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>Emits events from app code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>Receives them on Ninja endpoints</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>
                  Does <b>not</b> decide where events go
                </span>
              </li>
            </ul>
          </div>
          <div
            className={`rounded-xl border border-blog-accent/20 bg-blog-surface p-6`}
          >
            <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blog-accent/60 mb-2">
              Infrastructure-as-code
            </div>
            <h3 className="text-xl font-[350] tracking-tight text-blog-text mb-3">infra</h3>
            <p className="text-blog-muted/60 text-sm leading-relaxed mb-4">
              Owns the routing contract for the whole system.
            </p>
            <ul className="space-y-2 text-sm text-blog-muted/60">
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>Holds <code>events/events.yml</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>Declares event names, publishers, subscribers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blog-accent mt-1">•</span>
                <span>Sets endpoints &amp; retry policies</span>
              </li>
            </ul>
          </div>
        </div>

        <ArticleCard
          title="events.yml"
          subtitle="// infra/events/events.yml"
          tag="The Contract"
          tagColor="surface"
        >
          <p>
            This is the canonical routing registry. It declares the event name, who may publish
            it, and who must receive it. The platform team owns this file.
          </p>
          <YAMLBlock>{`- event: customer-created
  description: "A new customer was registered"
  publishers: [auth, billing]
  subscribers:
    - name: orchestrator
      max_attempts: 15
      endpoint: /events/customer-created/
    - name: auth
      max_attempts: 10
      endpoint: /events/customer-created/`}</YAMLBlock>
          <p className="mt-4">
            The deployment pipeline reads this file and configures Google Pub/Sub: one topic per
            event, one push subscription per subscriber, each with its own endpoint and retry
            policy. When the app publishes, Pub/Sub POSTs the message to every endpoint
            simultaneously. The app is decoupled from the routing graph.
          </p>
        </ArticleCard>
      </section>

      {/* ════════════════════════════════════
          THREE ACTS
      ════════════════════════════════════ */}
      <section id="receive" className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          The mechanism
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Three acts
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-8">
          Every event lives the same three-act life. Each card animates its own slice of the
          journey.
        </p>

        <div className="flex flex-col gap-5">
          {/* Act 01 */}
          <div
            className={`rounded-xl border border-blog-border/10 bg-blog-surface p-6`}
          >
            <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blog-accent/60 mb-3">
              Act 01 — Publish
            </div>
            <h3 className="text-lg font-[350] tracking-tight text-blog-text mb-3">
              Deferred, not blocking
            </h3>
            <p className="text-blog-muted/60 text-sm leading-relaxed">
              App code hands the event to a{' '}
              <b className="text-blog-text font-medium">task queue</b> (Procrastinate in our case;
              Celery, RQ, and Django Q are alternatives) instead of publishing inline, so the
              HTTP request returns fast. The task then publishes through{' '}
              <code>events-system</code>, the shared wrapper over Pub/Sub. A few call sites
              publish directly — the exception, not the rule.
            </p>
            <MiniAnimation kind="publish" />
          </div>

          {/* Act 02 */}
          <div
            className={`rounded-xl border border-blog-border/10 bg-blog-surface p-6`}
          >
            <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blog-accent/60 mb-3">
              Act 02 — Route
            </div>
            <h3 className="text-lg font-[350] tracking-tight text-blog-text mb-3">
              Config decides destiny
            </h3>
            <p className="text-blog-muted/60 text-sm leading-relaxed">
              Once in Pub/Sub, the app is out of the picture.{' '}
              <code>events.yml</code> declares who subscribes to what. The deployment tooling
              reads that file and creates a{' '}
              <b className="text-blog-text font-medium">push subscription</b> for each
              subscriber. Push means the broker delivers the event by POSTing to an endpoint —
              the receiver never polls or holds a long-lived connection. The tradeoff: the
              endpoint must be reachable and reply within 10 seconds, or Pub/Sub retries.
            </p>
            <MiniAnimation kind="route" />
          </div>

          {/* Act 03 */}
          <div
            className={`rounded-xl border border-blog-border/10 bg-blog-surface p-6`}
          >
            <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blog-accent/60 mb-3">
              Act 03 — Receive
            </div>
            <h3 className="text-lg font-[350] tracking-tight text-blog-text mb-3">
              Verify, then act
            </h3>
            <p className="text-blog-muted/60 text-sm leading-relaxed">
              Delivery lands on a Ninja endpoint at <code>/events/&lt;topic&gt;/</code>. The{' '}
              <code>@event_handler</code> decorator verifies the Google JWT and deserializes the
              payload <i className="text-blog-text/80">before</i> any logic runs. Then{' '}
              <code>EventProcessor</code> routes by topic to the right domain handler.
            </p>
            <MiniAnimation kind="receive" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          RECEIVE — Stage 4
      ════════════════════════════════════ */}
      <section className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Stage 4
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Receive
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          The app exposes Ninja endpoints. The <code>@event_handler</code> decorator verifies the
          JWT and deserializes the payload. Then <code>EventProcessor</code> routes by topic.
        </p>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          Pub/Sub delivers <strong className="text-blog-text font-medium">at least once</strong>.
          If the broker does not receive an acknowledgement in time, it sends the event again.
          That means the same event can arrive twice. Every handler in this system is designed to
          be <strong className="text-blog-text font-medium">idempotent</strong> — processing the
          same event twice produces the same result. This is not a bug; it is the contract of
          at-least-once delivery.
        </p>

        <hr className="border-blog-border/10 my-10" />

        <ArticleCard
          title="Ninja endpoint"
          subtitle="// app/http_api/events/views.py"
          tag="Stage 4"
        >
          <p>
            The endpoint is a thin POST handler. It extracts the raw body and passes it to{' '}
            <code>@event_handler</code>. Nothing more — no business logic, no routing, no
            decision-making.
          </p>
          <CodeBlock language="python">{`from ninja import Router

router = Router()

@router.post("/events/{topic}/", auth=google_jwt_auth)
def receive_event(request, topic: str, payload: PushPayload):
    handler = event_handler(topic, payload)
    handler.handle()
    return {"status": "ack"}`}</CodeBlock>
        </ArticleCard>

        <ArticleCard
          title="@event_handler"
          subtitle="// app/integrations/pubsub/decorators.py"
          tag="Stage 4"
        >
          <p>
            The decorator is the gatekeeper. It verifies the Google service-account JWT before
            any domain code runs. If the JWT is invalid, the handler is never called.
          </p>
          <CodeBlock language="python">{`class event_handler:
    def __init__(self, topic: str, payload: PushPayload):
        self.topic = topic
        self.payload = payload

    def handle(self) -> None:
        if not verify_jwt(self.payload):
            raise PermissionDenied("invalid JWT")
        event = deserialize(self.payload)
        EventProcessor.process(topic=self.topic, event=event)`}</CodeBlock>
          <p className="mt-4">
            The JWT proves the request came from Google Pub/Sub using a known service account. If
            verification fails, the decorator returns 403 before the event touches any domain
            code.
          </p>
        </ArticleCard>

        <ArticleCard
          title="EventProcessor"
          subtitle="// core/services/event_processor/processor.py"
          tag="Stage 4"
        >
          <p>
            The processor is a simple router. It maps topic names to domain handlers and
            dispatches. This is where the event finally does something — update a record, trigger
            a workflow, send a notification.
          </p>
          <CodeBlock language="python">{`# Still a TODO — content pending`}</CodeBlock>
        </ArticleCard>
      </section>

      {/* ════════════════════════════════════
          TRACE ONE EVENT THROUGH
      ════════════════════════════════════ */}
      <section className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Walkthrough
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Trace one event through
        </h2>
        <p className="text-blog-muted/60 text-base leading-[1.8] mb-6">
          Here is the entire path an event takes, start to finish.
        </p>

        <StepList
          steps={traceSteps}
          className="rounded-xl border border-blog-border/10 bg-blog-surface p-6"
        />
      </section>

      {/* ════════════════════════════════════
          SUMMARY
      ════════════════════════════════════ */}
      <section className="mt-20">
        <div className="eyebrow font-mono text-[0.7rem] tracking-[0.22em] uppercase text-blog-accent mb-5">
          Summary
        </div>
        <h2 className="text-2xl md:text-3xl font-light tracking-tight text-blog-text mb-6">
          Key ideas
        </h2>

        <StepList
          steps={summarySteps}
          className="rounded-xl border border-blog-border/10 bg-blog-surface p-6"
        />
      </section>

      {/* ════════════════════════════════════
          FOOTER
      ════════════════════════════════════ */}
      <footer className="mt-20">
        <hr className="border-blog-border/10 mb-10" />
        <p className="text-blog-muted/60 text-sm leading-relaxed">
          <b className="text-blog-text font-medium">The throughline.</b> Weak coupling is popular
          because it is fast to iterate — but it quietly moves the burden of knowing the system
          onto the developer. An external routing registry moves that burden back into the
          platform. The whole architecture is an argument about where that burden should live.
        </p>
        <p className="text-blog-muted/40 text-xs mt-6">
          Built in production. The code is real, the patterns are reusable, the tradeoffs are
          yours to evaluate.
        </p>
      </footer>
    </div>
  );
}

/* ─── Walkthrough steps ─── */
const traceSteps: Step[] = [
  {
    label: 'Something happens',
    description:
      'An appointment is created, a customer updates their profile, a subscription renews. The app produces a domain event describing what occurred.',
  },
  {
    label: 'EventPublisher.publish()',
    description:
      'The domain code wraps the event in a dataclass and hands it to a background task queue. The HTTP request returns to the user in milliseconds.',
  },
  {
    label: 'event_publish_task runs',
    description:
      'The background task retries up to 12 times with exponential backoff. It calls events-system, the shared PyPI package that wraps Google Cloud Pub/Sub.',
  },
  {
    label: 'Pub/Sub receives the message',
    description:
      'The event lives on a topic. Push subscriptions immediately deliver it to every configured endpoint by POSTing the payload. The app does not poll.',
  },
  {
    label: 'Ninja endpoint receives the POST',
    description:
      'The endpoint is a thin receiver. It extracts the raw body and passes control to @event_handler. No business logic lives here.',
  },
  {
    label: '@event_handler verifies and routes',
    description:
      'The JWT is verified. The payload is deserialized. EventProcessor inspects the topic and dispatches to the matching domain handler — the code that finally does the work.',
  },
];

/* ─── Summary steps ─── */
const summarySteps: Step[] = [
  {
    label: 'The app should not know about the graph.',
    description:
      "An app that publishes customer-created should not know that the orchestrator and the analytics pipeline consume it. That knowledge is operational, not domain. It changes when we add a new subscriber. If the graph lived in the app, every new subscriber would require a code change and a deploy.",
  },
  {
    label: 'The routing registry is external config.',
    description:
      "events.yml in the infra repo is the single source of truth for the event graph. The deployment tooling reads it and configures Google Cloud infrastructure. Changing the routing never requires an app deploy.",
  },
  {
    label: 'Idempotency is not optional.',
    description:
      "Pub/Sub delivers at-least-once. The same event can arrive twice. Every handler must be designed to produce the same result when called with the same event — regardless of how many times it runs. This constraint shapes every handler.",
  },
  {
    label: 'Retries are owned by the publisher, not the subscriber.',
    description:
      "The task queue retries the publish call — not the consumer. If the publish fails (network blip, Pub/Sub timeout), the task retries. If the consumer fails, Pub/Sub retries the push. These are separate concerns with separate policies, both declared declaratively.",
  },
  {
    label: 'The three-act structure constrains complexity.',
    description:
      "Publish, route, receive. Each stage has a single responsibility, a single code location, and a single reason to change. When something breaks, you know exactly which stage to investigate.",
  },
];
