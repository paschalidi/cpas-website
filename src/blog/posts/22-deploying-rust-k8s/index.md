---
title: Deploying Rust to Kubernetes on DigitalOcean
author: Christos Paschalidis
date: 2023-10-05
excerpt: Distroless images, Helm charts, and fast startup times
---

# Deploying Rust to Kubernetes on DigitalOcean

I chose DigitalOcean for simplicity. Managed Postgres, managed Redis (Valkey), and a container registry. Here's the setup.

### Dockerfile

Multi-stage build for minimal image size:

```dockerfile
# Build stage
FROM rust:1.75 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

# Production stage - distroless
FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=builder /app/target/release/chat-api ./
EXPOSE 3001
CMD ["./chat-api"]
```

Distroless images contain only the binary and libc. No shell, no package manager, no attack surface. Image size: 35MB vs 1.2GB with a full OS.

### Docker Compose for Local Development

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: chat
      POSTGRES_USER: chat
      POSTGRES_PASSWORD: chat
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgres://chat:chat@postgres:5432/chat
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
```

`docker-compose up -d` starts everything. No manual setup.

### Helm Chart

```yaml
# helm/chat-service/values.yaml
replicaCount: 3

image:
  repository: registry.digitalocean.com/rechat/chat-api
  tag: latest
  pullPolicy: Always

service:
  type: ClusterIP
  port: 3001

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt
  hosts:
    - host: api.rechat.cloud
      paths:
        - path: /
          pathType: Prefix
```

Deploy with:

```bash
helm upgrade --install chat-service ./helm/chat-service
```

### Why DigitalOcean

- Managed PostgreSQL: backups, point-in-time recovery, no ops burden
- Managed Redis (Valkey): clustering, failover, monitoring
- Container Registry: integrated with Kubernetes, no Docker Hub rate limits
- Load Balancer: SSL termination, health checks, automatic failover

### Fast Startup

Rust binaries start in milliseconds. No JVM warmup, no Python import time. Kubernetes health checks pass immediately. Rolling deployments are fast because the new pod is ready before the old one is terminated.

### What I Learned

- Distroless images are worth it. Smaller, safer, faster.
- Helm is overkill for one service but necessary when you have 3+ microservices.
- Managed databases save more time than they cost. Backups, failover, monitoring — all handled.
- Environment variables for configuration, not config files. Easier to manage in Kubernetes.
