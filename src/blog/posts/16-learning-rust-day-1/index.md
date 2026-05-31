---
title: learning rust - day 1
author: Christos Paschalidis
date: 2023-06-10
excerpt: Ownership, borrowing, and fighting the compiler
---

# learning rust - day 1

i've written javascript, typescript, python, go. rust is different. the compiler is your pair programmer and it is very opinionated.

### hello world

```rust
fn main() {
    println!("hello, world!");
}
```

compiles. runs. so far so good.

### the ownership model

in rust, every value has an owner. when the owner goes out of scope, the value is dropped. simple in theory, annoying in practice.

```rust
fn main() {
    let s = String::from("hello");
    takes_ownership(s);
    // s is no longer valid here
    // println!("{}", s); // compile error!
}

fn takes_ownership(s: String) {
    println!("{}", s);
} // s is dropped here
```

this is the thing that took the longest to internalize. in javascript i pass strings around without thinking. in rust, i have to think about who owns what.

### borrowing

instead of giving ownership, you can borrow:

```rust
fn main() {
    let s = String::from("hello");
    borrow(&s);
    println!("{}", s); // works! we only borrowed
}

fn borrow(s: &String) {
    println!("{}", s);
}
```

one mutable borrow OR any number of immutable borrows. not both. the compiler enforces this at compile time, which means no data races. ever.

### what i learned today

- `cargo new project_name` — scaffolding
- `cargo run` — build and run
- `cargo check` — faster than build, just type checks
- the rust compiler errors are actually helpful. read them carefully.
- `rustc` errors are like a strict teacher who actually wants you to learn

### what frustrated me

fighting the borrow checker for 20 minutes on a simple function that returns a string. the answer was always `.clone()` or restructuring to return ownership. i cloned too much at first. learned later that is a smell.

### resources

- [the rust programming language](https://doc.rust-lang.org/book/) — the official book, read chapter 1-4
- [rust by example](https://doc.rust-lang.org/rust-by-example/) — when you want to see code instead of prose
