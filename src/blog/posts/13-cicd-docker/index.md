---
title: cutting CI/CD times by 40% with docker
author: Christos Paschalidis
date: 2022-03-10
excerpt: Layer caching, parallel jobs, and using the right base image
---

# cutting CI/CD times by 40% with docker

Our pipeline was taking 18 minutes. No one cared until we started shipping daily. Then it became the thing everyone complained about in standup.

### what was slow

- building docker images from scratch every run
- running tests sequentially after build
- using `ubuntu:latest` for everything
- no layer caching between builds

### what we changed

**1. multi-stage builds**

```dockerfile
# build stage
FROM node:16-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# production stage
FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

production image went from 1.2GB to 180MB. build time dropped because we stopped copying dev dependencies around.

**2. layer caching in CI**

```yaml
- uses: actions/cache@v3
  with:
    path: /tmp/.buildx-cache
    key: buildx-${{ github.sha }}
    restore-keys: buildx-
```

if `package.json` didn't change, we skipped `npm ci` entirely. that's 2-3 minutes saved on most builds.

**3. parallel jobs**

reordered the pipeline so lint, test, and security scan run in parallel instead of sequentially:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
  security:
    runs-on: ubuntu-latest
    steps: [...]
  build:
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    steps: [...]
```

build only happens if all three pass. but they run at the same time.

**4. right-sized base images**

switched from `node:16` to `node:16-alpine` for services. from `ubuntu` to `distroless` for go binaries. smaller images, faster pulls, faster builds.

### the result

18 minutes → 11 minutes. the big win was multi-stage builds + layer caching. parallel jobs helped but only after we fixed the build itself.

### one thing I'd do differently

start with `docker buildx --cache-from` instead of manual cache actions. native and more reliable.
