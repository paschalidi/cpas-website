---
title: Learning rust — day 1
author: Christos Paschalidis
date: 2023-06-10
excerpt: "Ownership, borrowing, and fighting the compiler"
---

# Learning rust — day 1

I have written JavaScript, TypeScript. Rust is different. The compiler is your pair programmer and it is very opinionated.

I started this because I wanted to build a chat API. Everyone said Rust was the right choice for real-time systems. I did not know why yet.

## Hello world

First thing I did: set up a simple API server. Not a hello world binary. I wanted to see if I could build something that responds to HTTP requests.

`cargo new chat-api` — scaffolding. `cargo run` — build and run. It worked.

## The ownership model

In Rust, every value has an owner. When the owner goes out of scope, the value is dropped. Simple in theory, annoying in practice.

I passed a `String` to a function and tried to use it afterward. The compiler said no. In JavaScript I pass strings around without thinking. In Rust, I have to think about who owns what.

This is the thing that took the longest to internalize. The compiler is not being difficult. It is preventing bugs I would not catch until production. I know this because I have spent hours debugging swallowed errors in JavaScript try/catch blocks. In Rust, the type system makes you handle it.

## Borrowing

Instead of giving ownership, you can borrow. One mutable borrow OR any number of immutable borrows. Not both. The compiler enforces this at compile time, which means no data races. Ever.

This sounds academic until you realize your entire chat server will have thousands of concurrent connections reading and writing shared state. The borrow checker is the reason you can sleep at night.

## What frustrated me

Fighting the borrow checker for 20 minutes on a simple function that returns a string. The answer was always `.clone()` or restructuring to return ownership. I cloned too much at first. Learned later that is a smell.

## What I learned today

- `cargo new project_name` — scaffolding
- `cargo run` — build and run
- `cargo check` — faster than build, just type checks
- The Rust compiler errors are actually helpful. Read them carefully.
- `rustc` errors are like a strict teacher who actually wants you to learn

## Resources

- [The Rust Programming Language](https://doc.rust-lang.org/book/) — the official book, read chapters 1-4
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/) — when you want to see code instead of prose
