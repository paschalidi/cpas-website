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

ReChat is a chat-as-a-service. Organizations get an API key. They create channels. They send messages. We count the messages and bill them at the end of the month. Simple on the surface, complicated underneath.

The backend is Rust with Axum, SeaORM, PostgreSQL, and Redis. The frontend SDK is React with a WebSocket connection. Deployed on DigitalOcean Kubernetes.

This is not a production-grade system. It is a learning project that grew too big. I documented the journey because I will forget the details.

The notes that follow are rough. They are for me, not for you. But if you are learning Rust or building API billing, some of this might save you time.
