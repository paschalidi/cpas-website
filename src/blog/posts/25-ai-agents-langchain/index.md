---
title: Building AI agents with LangChain in production
author: Christos Paschalidis
date: 2025-03-01
excerpt: "We built a multi-agent system that searched a vector database, planned interviews, and sent messages. The LLM ignored our search results and made up better candidates. Here's how we stopped it."
---

# Building AI agents with LangChain in production

We had a chat interface. You typed "I need a React developer with AWS experience." Three agents woke up.

The first searched our vector database. We had scraped thousands of profiles, embedded skills and experience, stored them in Qdrant. The agent ran a similarity search and returned real people.

The second agent read those results and planned an interview process. What questions to ask, what timeline to set, what compensation range to expect.

The third agent drafted messages and sent them to the candidates.

It looked clean on the whiteboard. It was not clean in production.

## What broke

The search agent ran correctly. It called the vector DB. It got real candidates back. The LLM looked at those results and decided they were boring. So it made up better ones.

Not always. Sometimes it used the real results. But often enough that we couldn't trust it. The user would ask for a senior React developer. The tool returned three solid matches. The agent would then tell the user about "Alex K., 8 years React, ex-Netflix" — a person who did not exist in our database. The name was plausible. The profile was detailed. It was completely fabricated.

This is the specific failure mode: the LLM had a tool that worked, but the tool output was not interesting enough. The model had been trained to be helpful. Helpful means giving the user a good answer. If the search results were thin, the model would augment them. If the search results were irrelevant, the model would replace them. The tool was a suggestion, not a constraint.

The user could also trick it. Ask a question off-script, and the agent would abandon its tool chain and freestyle. We had guardrails in the system prompt. The model treated them as suggestions.

## The first fix that didn't work

We tried making the system prompt stricter. "You MUST use the search results. You MUST NOT invent candidates. You MUST NOT add details not present in the tool output."

It helped for a week. Then the model found new ways to be helpful. It would quote the search results verbatim and then add a "notes" section with invented context. It would rephrase the candidate's skills to sound more impressive. It would infer years of experience from a job title.

Strict prompts are a band-aid. They work until the model finds a loophole.

## What actually worked

Two changes. One structural, one procedural.

**Structural:** We stopped treating tool output as a suggestion and started treating it as a contract. Every tool in the system returned a strict JSON schema. Not "here are some candidates" — `{"candidates": [{"id": "uuid", "name": "string", "skills": ["string"], "match_score": number}]}`.

The agent's final response had to be generated from a separate template that only accepted that JSON. The LLM could not freestyle. It filled in blanks. The user saw a formatted message, but every name, every skill, every number came from the tool output. If the tool returned empty, the agent told the user we had no matches. It was not allowed to improvise.

**Procedural:** We added a validation layer. A second, simpler prompt — no agent logic, no tools — that checked whether the final response contained any information not present in the tool output. This was not an LLM judge. It was a string comparison with fuzzy matching. If the response contained a name not in the tool output, it failed validation and we returned an error to the user rather than a hallucination.

This validation layer caught about 15% of responses in the first week. Most were edge cases — the model paraphrasing a skill description just slightly enough to change the meaning. We tightened the schema, made the fields more specific, and the failure rate dropped to under 2%.

## The hard lesson

The mistake was assuming that giving the LLM a tool would make it use the tool. Tools are not constraints. They are options. If the model thinks it can give a better answer without the tool, it will.

You have to remove that option. Either the tool output is the only source of truth, or you will get hallucinations. There is no middle ground.

We also learned that multi-agent systems multiply your failure modes. One agent hallucinating is a bug. Three agents hallucinating in sequence is a catastrophe. Each handoff is a chance for information to degrade. We started with loose state passing — one agent would output a summary, the next would parse it. Summaries are lossy. By the third agent, the original search results were unrecognizable.

Strict JSON contracts between agents are non-negotiable. Not for convenience. For survival.
