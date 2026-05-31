---
title: setting up prometheus and grafana from scratch
author: Christos Paschalidis
date: 2022-08-20
excerpt: greenfield monitoring with loki, istio sidecars, and dashboards that actually get looked at
---

# setting up prometheus and grafana from scratch

We had nothing. Cloudwatch logs were where queries went to be forgotten. I wanted dashboards people would actually use.

### what we set up

- **prometheus** — scraped metrics from the istio sidecars
- **loki** — for log aggregation without the elk headache
- **grafana** — one dashboard per service, no 100-widget monsters
- **alertmanager** — pagerduty for the important stuff, slack for the noise

### the dashboard i actually used

built a single dashboard for our core services. showed:

- request rate by endpoint
- latency percentiles (p50, p95, p99)
- error rate by response code
- outbound dependency health
- exception logs filtered by service
- audit log activity

sample query for request rate by endpoint:

```promql
sum by (endpoint_response) (
  count_over_time(
    {namespace="the-monolith", container="istio-proxy"}
    | json
    | upstream_cluster =~ `inbound.*`
    | method != `OPTIONS`
    | label_format endpoint = `{{ .method }} {{ .path }}`
    | label_format endpoint_response = `{{.endpoint}} {{.response_code}}`
  [1m])
)
```

loki query for audit logs:

```logql
{namespace="the-monolith"}
| logfmt
| name="AuditLogFiltered"
| component=~"action_requests|patient_comms"
| line_format "[{{alignRight 15 .component}}] {{.timestamp}} {{.resource_id}} {{alignRight 8 .item_code}} by {{.actor_id}}"
```

### why it worked

- **one dashboard per service** — not one dashboard with 40 rows that nobody scrolls through
- **logfmt labels** — structured logs meant we could query by field, not grep
- **istio sidecars** — got metrics without touching application code

### what i'd do differently

- start with loki from day one.
- set up recording rules early. 
- add annotations for deployments. seeing a latency spike and not knowing if someone just shipped is annoying.

### one thing that surprised me

People used the logs dashboard more than the metrics dashboard. Engineers want to see the actual error, not a red line going up.
