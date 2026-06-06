---
title: "Migrating from Algolia to OpenSearch: why we ditched the $1,000/mo search that leaked our keys"
author: Christos Paschalidis
date: 2024-12-01
excerpt: "Algolia was $1,000/month, leaked our public search key, and had no Go SDK. We moved to AWS OpenSearch, cut costs to the minimum, and built a faster search UI. The catch: we now had to maintain data in two places."
---

# Migrating from Algolia to OpenSearch: why we ditched the $1,000/mo search that leaked our keys

We started with Algolia. It took a day to integrate. The search was fast. The UI was responsive. The bill was $1,000 per month.

Then someone found our public search API key in the frontend JavaScript. They used it to run searches outside our application. We had to rotate the key, update all clients, and accept that a public key in the browser is always a liability.

We decided to move. Not to another SaaS search provider. To AWS OpenSearch, self-hosted in our own account.

## The cost math

Algolia: ~$1,000/month at our volume. Scales with query count and record count. The pricing is predictable until it is not — one traffic spike and the bill jumps.

OpenSearch on AWS: a small managed cluster costs a fraction of that. At our scale — a few hundred thousand vehicle records, a few thousand searches per day — we paid for the instance, not per query. The monthly cost dropped by an order of magnitude.

But cost was not the only reason. We wanted control. We wanted our search index in the same AWS account as our database, our API, our everything. No third-party network calls. No third-party rate limits. No third-party keys in the frontend.

## The migration

We had a PostgreSQL database with vehicle listings. Make, model, year, mileage, price, location, features, images. Algolia indexed this automatically via their API. We wrote the record, Algolia picked it up.

OpenSearch does not pick up anything. You have to write the indexing code yourself.

We built a sync layer. Every create, update, or delete on a vehicle record triggered an async job to update the OpenSearch index. This sounds simple. It was not.

## The filter problem

EV buyers do not search like e-commerce shoppers. They do not type "Tesla Model 3." They apply filters: price under $40,000, range over 300 miles, fast charging, white exterior, delivery within 100 miles, and — the hard one — available for reservation right now.

The "available for reservation" filter depends on the reservation state. Which is not in the vehicle table. It is in the reservation table. Which joins to the vehicle table. Which means our search query needs a join.

Algolia handles this with their "query rules" and "filtering" API. You send them parameters, they return results. The complexity is hidden.

OpenSearch requires you to write the query. And Go — our backend language — has no official OpenSearch SDK.

## Writing Go queries for OpenSearch

We had to construct OpenSearch DSL queries by hand. JSON nested five levels deep. Bool queries with must, should, must_not, filter clauses. Range queries for price. Term queries for make and model. Geo-distance queries for location.

The dependency between filters made this harder. If a user filters by price and range and availability, the query has to handle all three in a single bool query. If they add a fourth filter, the structure changes. We ended up building a query builder in Go — a small DSL that translated our filter parameters into OpenSearch JSON.

This was the most complex code in our backend. Not the checkout. Not the reservation logic. The search query builder.

But it worked. The search was faster than Algolia. The filters were instant. The UI felt snappy because the round-trip was within our own AWS network, not to Algolia's servers across the internet.

## The dual-write problem

Every time a vehicle record changed in PostgreSQL, we had to update the OpenSearch index. This created two sources of truth.

The specific bug that made this real: a user updated their listing price. The database updated. The async indexing job failed — a network timeout, a transient error, a deploy that restarted the worker before it finished. The OpenSearch index now had the old price. A buyer searched, saw the old price, reserved the vehicle, and called an agent to confirm. The agent saw the new price in the admin dashboard. Confusion. Anger. A support ticket.

We fixed this by adding retry logic, idempotency keys, and a nightly reconciliation job that compared the DB to the index and fixed discrepancies. But the fundamental problem remained: two data stores means two failure modes. You cannot avoid it. You can only monitor it.

## What I would do differently

OpenSearch was the right call for cost and control. But if I were doing it again, I would consider using OpenSearch's Zero-ETL integration with PostgreSQL from the start, rather than writing our own sync layer. AWS has since made this easier. In 2024, we did it the hard way.

I would also have spent more time on the query builder design. Our first version was a mess of nested if-statements. The second version used a builder pattern. The third version was readable. It took three iterations to get clean.

## The real lesson

Algolia is worth the money if you do not have time to build search infrastructure. It is not worth the money if you have a Go backend, a DevOps team, and a tolerance for writing your own query DSL.

The migration saved us thousands per month. It also gave us a search system we fully controlled. But it added operational complexity that we underestimated. Every schema change in PostgreSQL required a corresponding mapping update in OpenSearch. Every new filter required a new query builder method. Every deployment risked index lag.

The trade-off is real. There is no free search. There is only expensive SaaS search or cheap self-hosted search that costs engineering time instead of dollars.

We chose engineering time. For a startup with more engineers than revenue, it was the right choice.
