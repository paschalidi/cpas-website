---
title: Architecting agentic systems that don't fall apart
author: Christos Paschalidis
date: 2025-04-01
excerpt: "We built too fast, with no observability, and agents that passed loose JSON between each other. Then we changed one thing that made the system debuggable."
---

# Architecting agentic systems that don't fall apart

The system worked in the demo. It failed in the wild. This is the story of how we built three agents that could not talk to each other, could not be debugged, and could not be trusted — and what we changed to fix it.

## The architecture we started with

Three LangChain agents. A supervisor router that read the user's message and decided which agent to call. A search agent with a vector DB tool. An interview planner agent. A messaging agent.

Each agent was a self-contained ReAct loop. It thought, acted, observed, repeated. The supervisor passed a string summary to the chosen agent. The agent did its work and returned a string summary. The supervisor read that and decided what to do next.

It looked modular. It was actually a black box connected to two other black boxes by wet string.

## The first failure: state passing

Agent 1 searched the vector database. It returned this:

```json
{
  "candidates": [
    {"id": "abc", "name": "Maria Garcia", "skills": ["React", "TypeScript"]}
  ]
}
```

Agent 2, the interview planner, expected this:

```json
{
  "matched_candidates": [
    {"id": "abc", "name": "Maria Garcia", "skills": ["React", "TypeScript"]}
  ]
}
```

The key was `candidates` vs `matched_candidates`. Agent 2 was supposed to be generic. It was not. It had been prompted with example inputs that all used `matched_candidates`. When it received `candidates`, it hallucinated the structure it expected. It would tell the user about interview questions for "Maria Garcia" without actually reading her skills from the input.

This happened silently. The system did not crash. It produced a plausible-looking result that was internally inconsistent. We only caught it because a user complained that the interview questions were for a backend role when they had asked for a frontend developer.

We had no logs. We had no trace of which agent made which decision. We had a final response and a confused user.

## The second failure: agents choosing the wrong tools

The interview planner had two tools: `get_interview_template` and `get_market_rate`. When the user asked "what should I ask a senior React developer," the agent was supposed to call `get_interview_template` with the role and seniority.

Instead, it often called `get_market_rate`. Why? Because the market rate tool had a more interesting description in the prompt. "Get competitive salary data for any role" sounds more useful than "Retrieve standard interview questions." The agent was optimizing for interestingness, not correctness.

This is the ReAct problem. The agent's "thought" step is just more LLM output. It can be wrong. And when it is wrong, the wrong tool gets called, the wrong data gets fetched, and the user gets garbage.

## The fix: strict contracts and a decision log

We changed two things.

**First:** Every agent-to-agent handoff used a strict JSON schema. Not a summary. Not a narrative. Structured data with typed fields. The interview planner no longer accepted free text. It accepted `{"candidate_id": "uuid", "role": "string", "seniority": "junior|mid|senior", "required_skills": ["string"]}`.

If Agent 1 did not produce exactly that shape, the handoff failed. The system returned an error. We fixed the failure at the boundary, not in the prompt.

**Second:** We built a decision log. Not LangChain's built-in tracing — that was too noisy, too slow, and too expensive to run in production. We wrote a simple middleware that logged every tool call, every agent transition, and every input/output pair to a structured log.

When a user reported a bad result, we could replay the entire chain. We could see that Agent 1 returned `candidates` at 14:23:07, that Agent 2 hallucinated `matched_candidates` at 14:23:08, and that the final response was generated at 14:23:09 using the hallucinated data.

This changed how we debugged. Before, debugging meant guessing. After, debugging meant reading a timeline.

## What I wish we'd done on day one

Built the decision log first. Not after the third user complaint. Not after the all-hands where someone asked "why is the agent recommending backend questions for frontend roles?"

You cannot debug a system you cannot see. Multi-agent systems are distributed systems with extra steps. Every handoff is a network call. Every agent is a service. You would not deploy three microservices without logging between them. Do not deploy three agents without logging between them either.

The second thing I wish we'd done: designed the schemas before writing the prompts. The prompt is the easy part. The data contract is the hard part. If you get the contract wrong, no amount of prompt engineering will save you.

## The emotional truth

We built this too fast. The product team had not fleshed out the requirements. The C-suite wanted a demo for investors in three weeks. We had two engineers. We built an agent system in a month because we were told to, not because we had time to think about whether we should.

The architecture fell apart because it was never designed. It was assembled. There is a difference.
