---
title: "Watch the replay. Read the data."
author: Christos Paschalidis
date: 2025-03-15
excerpt: "Every Friday I watched Sentry session replays for an hour. I caught more bugs from watching users click around than from any test suite."
---

# Watch the replay. Read the data.

Every Friday I blocked an hour. I opened Sentry. I watched session replays. Not the errors — the sessions. I picked five random users and I watched what they actually did.

I caught more bugs this way than from any test suite.

## What I saw

Users did not report bugs. They left. They clicked a button that did nothing, waited three seconds, and closed the tab. They filled out a form, hit submit, got no feedback, and assumed it worked. They rage-clicked a loading spinner that was never going to finish because the API call failed silently.

Sentry replays showed me this. Not the exception stack trace. The human in front of the screen. The pause. The confusion. The back-button.

Last week I watched a user try to reserve a vehicle. They clicked "Reserve," got a loading state, waited 12 seconds, and refreshed the page. The reservation went through twice. Two holds on the same car. Two agents calling the same buyer. We had no test for "user refreshes during API call." The replay found it in ten minutes.

## PostHog: the numbers that lied

Sentry showed me the individual. PostHog showed me the aggregate. I read the funnel every Monday. Where did users drop off?

The checkout flow I thought was a 5-step wizard? PostHog said 40% of users dropped between step 2 and step 3. I assumed step 3 was the problem — identity verification is friction.

I watched the replays. It was step 2. The address autocomplete was broken on mobile. Users typed their city, got no suggestions, and gave up. The data said "drop-off at step 3." The replay said "they never made it to step 3 because step 2 was broken."

You need both. PostHog tells you where. Sentry replays tell you why.

## The habit

Friday: five replays, no matter what. Pick any session. Not the errors. Not the crashes. Just a user using your product. Watch them get confused. Watch them succeed. Watch them do something you did not know was possible.

Monday: read the PostHog funnel. Compare it to what you saw Friday. The numbers made more sense.

This was the cheapest user research I did. No interviews. No surveys. Just watching.

## For founding engineers

If you are the founding engineer, you are also the product manager, the designer, and the QA team. You do not have a research department. You have Sentry and PostHog.

Use them. The replay is not a debugging tool. It is a reality tool. It shows you what your product actually is, not what you think it is.

Watch the replay. Read the data. Then go fix the thing that is obviously broken — the thing that is so obvious in the replay that you cannot believe you shipped it.
