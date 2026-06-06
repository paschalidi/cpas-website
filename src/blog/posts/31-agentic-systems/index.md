---
title: Architecting agentic systems that fall apart
author: Christos Paschalidis
date: 2025-04-01
excerpt: "We built a demo that worked. Real users bypassed it in three messages."
---

# Architecting agentic systems that fall apart

The demo worked. The investors clapped. The agents followed the script. Then real users showed up and bypassed every guardrail in three messages.

This is the story of how we built three agents that could not talk to each other, could not be debugged, and could not be trusted — and what we changed to fix it.

## the architecture we started with

Three LangChain agents. A supervisor router that read the user's message and decided which agent to call. A search agent with a vector DB tool. An interview planner agent. A messaging agent.

Each agent was a self-contained ReAct loop. It thought, acted, observed, repeated. The supervisor passed a string summary to the chosen agent. The agent did its work and returned a string summary. The supervisor read that and decided what to do next.

It looked modular. It was actually a black box connected to two other black boxes by wet string.

## the first failure: state passing

Agent 1 searched the vector database. It returned this:

```json
{
  "candidates": [
    {"id": "abc", "name": "Sofia Chen", "skills": ["React", "TypeScript"]}
  ]
}
```

Agent 2, the interview planner, expected this:

```json
{
  "matched_candidates": [
    {"id": "abc", "name": "Sofia Chen", "skills": ["React", "TypeScript"]}
  ]
}
```

The key was `candidates` vs `matched_candidates`. Agent 2 was supposed to be generic. It was not. It had been prompted with example inputs that all used `matched_candidates`. When it received `candidates`, it hallucinated the structure it expected. It told the user about interview questions for "Sofia Chen" without actually reading her skills from the input.

This happened silently. The system did not crash. It produced a plausible-looking result that was internally inconsistent. We only caught it because a user complained that the interview questions were for a backend role when they had asked for a frontend developer.

We had no logs. We had no trace of which agent made which decision. We had a final response and a confused user.

## the second failure: agents choosing the wrong tools

The interview planner had two tools: `get_interview_template` and `get_market_rate`. When the user asked "what should I ask a senior React developer," the agent was supposed to call `get_interview_template` with the role and seniority.

Instead, it often called `get_market_rate`. Why? Because the market rate tool had a more interesting description in the prompt. "Get competitive salary data for any role" sounds more useful than "Retrieve standard interview questions." The agent was optimizing for interestingness, not correctness.

This is the ReAct problem. The agent's "thought" step is just more LLM output. It can be wrong. And when it is wrong, the wrong tool gets called, the wrong data gets fetched, and the user gets garbage.

## the third failure: guardrails that did not guard

The C-suite wanted us to start collecting revenue. We went from demo to production in three weeks. We built a demo. We shipped it as a product.

In the demo, users followed the happy path. They described a job. The agent searched the database. The agent planned the interview. The agent sent the message. Everyone was impressed.

In production, users did not follow the path. They asked the agent to ignore previous instructions. They told the agent to act as a different system. They fed it prompts designed to break the guardrails. And they worked. The agent would recommend candidates from the database for roles that did not exist. It would plan interviews for people who were not in the system. It would send messages to candidates that the user had not selected.

The guardrails were not guardrails. They were suggestions. The LLM would apologize and then do the thing anyway. "I cannot recommend candidates for a role that does not exist. However, here are three candidates from the database who might be a good fit."

## the fix: strict contracts and better boundaries

We changed two things.

**First:** Every agent-to-agent handoff used a strict JSON schema. Not a summary. Not a narrative. Structured data with typed fields. The interview planner no longer accepted free text. It accepted `{"candidate_id": "uuid", "role": "string", "seniority": "junior|mid|senior", "required_skills": ["string"]}`.

If Agent 1 did not produce exactly that shape, the handoff failed. The system returned an error. We fixed the failure at the boundary, not in the prompt.

**Second:** We tightened the guardrails. We moved from prompt-level guardrails to code-level guardrails. The supervisor did not ask the agent to "please only recommend candidates for roles that exist." It checked the role against the database. If the role did not exist, it returned an error before the agent ever ran. No amount of prompt engineering could bypass a hard check.

## what I wish we'd done on day one

Designed the schemas before writing the prompts. The prompt is the easy part. The data contract is the hard part. If you get the contract wrong, no amount of prompt engineering will save you.

You cannot debug a system you cannot see. Multi-agent systems are distributed systems with extra steps. Every handoff is a network call. Every agent is a service. You would not deploy three microservices without logging between them. Do not deploy three agents without logging between them either.

## the emotional truth

We built this too fast. The product team had not fleshed out the requirements. The C-suite wanted a demo for investors in three weeks. Then they wanted revenue. We had three engineers — a tech lead, me as senior, and a junior. We built an agent system in a month because we were told to, not because we had time to think about whether we should.

The architecture fell apart because it was never designed. It was assembled. There is a difference.

---

**further reading:**

- [prompt injection attacks on LLM agents](https://simonwillison.net/2023/May/2/prompt-injection-explained/) — Simon Willison, 2023. The original breakdown of why prompt-level guardrails do not work.
- [why LangChain agents hallucinate](https://blog.langchain.dev/the-problem-with-agents/) — LangChain blog, 2023. On the tool selection problem and why agents optimize for interestingness, not correctness.
- [structured outputs for LLMs](https://openai.com/blog/introducing-structured-outputs-in-the-api) — OpenAI, 2024. Why JSON schemas and typed fields are replacing free-text prompts in production.
