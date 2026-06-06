---
title: We shipped fast, skipped PRs, and built a product nobody wanted
author: Christos Paschalidis
date: 2025-05-01
excerpt: "No code review. No design docs. Just constant pressure to deliver. We built an AI agent system in three months and discovered nobody on the demand side wanted it."
---

# We shipped fast, skipped PRs, and built a product nobody wanted

This is not a story about bad code. The code was fine. The agents worked. The vector search was fast. The Stripe integration did not lose money.

This is a story about building the wrong thing very efficiently.

## The setup

We had three engineers. The company had maybe fifteen to twenty people total. The c-suite wanted a demo in three weeks, a beta in six, a public launch in twelve. The timeline was not discussed. It was announced.

The rule was simple: ship every day. Push to main. No pull requests. No code review. If it worked on your machine, it worked in production.

I know what you are thinking. This is reckless. It is. But it is also seductive. When you are moving fast, code review feels like bureaucracy. A PR that sits for four hours is four hours of velocity lost. In a three-person team, reviewing your own code is a formality. So we skipped it.

## What we built

An AI agent system for a hiring marketplace. You described the role. The system found candidates in a vector database. It planned interviews. It sent messages. It was technically impressive.

We built it in three months. We shipped features weekly. Voice search with Speech-to-Text. AI pipelines with LangChain and n8n. Multi-tenant architecture with a headless CMS. Every week something new.

The c-suite loved it. The investors loved the demo.

## The moment it broke

Not the code. The assumption.

We launched the beta and waited for signups. The marketing team had run ads. The landing page had a waitlist. The product was live.

Nobody came.

Well, not nobody. Freelancers came. The supply side showed up. People who wanted to get hired. They made profiles. They uploaded resumes. They waited.

What never came was the demand side. The people who would actually hire them. The employers. The clients. The ones with money. They did not sign up. They did not post jobs. They did not trust an AI agent to plan their interviews.

We had built a marketplace with half a market. The side that needed money was there. The side that had money was not.

## Why we did not see it

Because we were not allowed to see it. The product team — one person, part-time — had done no user research. The founders had "validated the idea" by talking to a few friends who said they might use it. They said yes. They did not use it.

We did not run a single user interview before writing code. We did not test the value proposition. We did not ask whether recruiters wanted AI to plan interviews — most of them did not trust AI to order lunch, let alone screen candidates.

The constant delivery pressure made this impossible. There was no time for research because there was always a feature to ship. The roadmap was a list of things the founders thought would look good in a pitch deck.

## The no-PR problem

Skipping code review did not make us faster. It made us *feel* faster.

We shipped daily. But half of those ships were fixing bugs from yesterday's ships. An agent that looped infinitely. A vector search that returned the same candidate three times. A messaging agent that drafted emails to the wrong person.

These were not hard bugs. They were bugs that a second pair of eyes would have caught. A PR with a five-minute review would have saved an hour of debugging. But we measured output in commits, not in working software.

The real cost of no PRs was not the bugs. It was the culture. When nobody reviews your code, nobody questions your assumptions. When nobody questions your assumptions, you build what you think is right. When what you think is right is based on zero user input, you build the wrong thing.

## The death spiral

Month one: build the core agent system.
Month two: add voice search, AI pipelines, CMS integration.
Month three: fix bugs, polish UI, prepare for launch.
Month four: launch. Silence.
Month five: the c-suite asks why nobody is using it. The answer is obvious. Nobody wanted it.
Month six: sunset the project. Fire the team.

The speed did not save us. It killed us faster. We ran at full velocity in the wrong direction.

## What I would do differently

Not "add PRs." That is the easy answer. The hard answer is: stop shipping until you know someone wants it.

We should have spent week one talking to ten recruiters. Not pitching. Listening. What is your actual workflow? Where does it break? Would you trust an AI to plan an interview? The answer would have been no, and we would have saved three months.

We should have built a fake door test before building the agents. A landing page. A manual process behind the scenes. See if anyone bites. If nobody bites, you have not failed. You have learned.

We should have said no to the roadmap. The founders wanted features for the pitch deck. We wanted features for the users. Those were not the same features. We should have had the argument. We did not.

## What I think now

You can write perfect code for a product nobody wants. You can have zero bugs, 100% test coverage, and a CI/CD pipeline that deploys in thirty seconds. It does not matter.

The best code in the world cannot fix a missing market.

We built an AI agent system that technically worked. It searched vectors. It planned interviews. It sent messages. It was a beautiful solution to a problem that did not exist.

The next time someone tells you to ship faster, ask them: faster toward what? If the destination is wrong, velocity is just how quickly you get lost.

And if you are building a marketplace, make sure both sides want to be there. The freelancers will always show up. The employers will not. The hard part is not the technology. The hard part is the trust.
