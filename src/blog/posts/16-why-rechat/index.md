---
title: Why I started building rechat
author: Christos Paschalidis
date: 2023-06-01
excerpt: "Two things I wanted to learn: Rust, and how to put a price tag on an API endpoint"
---

# Why I started building rechat

I built a chat API to learn two things.

First, Rust. I had written JavaScript, TypeScript. Everyone talked about Rust's memory safety and zero-cost abstractions. I wanted to know if the hype was real.

Second, billing. I had never built usage-based billing. I wanted to understand how to count requests, enforce limits, and charge people without writing custom invoicing code. Stripe handles payments, but someone has to decide what to charge for.

ReChat is a chat-as-a-service. Organizations get an API key. They create channels. They send messages. I count the messages and bill them at the end of the month. Simple on the surface, complicated underneath.

I spent 150 hours on this over six months. The backend is Rust with Axum, SeaORM, PostgreSQL, and Redis. The frontend SDK is React with a WebSocket connection. Deployed on DigitalOcean Kubernetes.

This is not a production-grade system. It is a learning project that grew too big. I was obsessed with delivering the features I wanted to learn: multi-tenancy, API key auth, usage limiting, Stripe billing, React SDK, WebSocket real-time messaging, Redis Pub/Sub, and Kubernetes deployment. Every feature was a new thing to learn.

The problem: I got a $150 bill from DigitalOcean. For a side project with zero users. I could have run it cheaper — one VPS, Docker Compose, $20 budget. But I wanted to learn Kubernetes. I wanted to do it "the right way." The right way was expensive.

I shut it down. Cancelled the DO account. Let the domain expire. The GitHub repos are still there, public, frozen in time.

Would I do it again? Yes. But I would skip the Kubernetes part. I learned more from building the billing middleware than from writing Helm charts.

These notes are for me. I will forget the details. But if you are learning Rust or building API billing, some of this might save you time.
