---
title: "Designing a checkout flow: what we stole from Carvana, Tesla, and a Swedish EV startup"
author: Christos Paschalidis
date: 2024-08-01
excerpt: "We benchmarked Carvana, Tesla, and Carla. Then we built a checkout flow where users reserved an EV, verified their identity, picked insurance, and a human agent closed the sale. Here's what worked."
---

# Designing a checkout flow: what we stole from Carvana, Tesla, and a Swedish EV startup

We were rebranding an electrical vehicle platform. The old checkout was a contact form. Name, email, phone number, "we will get back to you." It converted at roughly zero.

I led the redesign end-to-end. I worked with our designer. We looked at every EV checkout flow we could find. Carvana in the US. Tesla's direct buy. And Carla, a Swedish startup that had figured out something interesting: they let you buy a used EV entirely online, with home delivery in 72 hours.

## What we stole

**From Carvana:** the vehicle reservation step. You browse, you find a car you like, you put down a small hold. The vehicle is taken off the market for 24 hours. No other buyer can reserve it. This creates urgency without pressure. The user is not committing to a purchase. They are committing to a conversation.

**From Tesla:** the minimalism. Tesla's checkout is famously sparse. No upsells, no add-ons, no "would you like fries with that." We copied the ruthlessness. Every step had to justify its existence. If a field did not change the agent's ability to close the sale, we removed it.

**From Carla:** the insurance integration. In Sweden, Carla bundles insurance into the purchase flow. You pick a tier, you see the price, you move on. We did the same. We built our own insurance product — three tiers, optional skip. It was great for revenue. Users who would have abandoned at "contact us" instead saw a complete package: car, delivery, insurance. The price was real. The offer was binding.

## The flow we built

Step 1: Browse. OpenSearch-backed search, fast filters, instant results.

Step 2: Reserve. User clicks "Reserve this vehicle." The backend marks the car as unavailable for 24 hours. Other users see it as "reserved." The user pays nothing at this step. The hold is free.

Step 3: Address and delivery. User enters their address. We calculate delivery cost based on distance from the nearest hub.

Step 4: Identity verification. We integrated Persona. Document + selfie check. The user completes it in under two minutes. We get a verified identity record. This was for compliance and fraud prevention — you cannot sell a $40,000 vehicle to an anonymous email address.

Step 5: Insurance. Three tiers: basic liability, comprehensive, premium with zero deductible. Prices calculated in real-time based on vehicle value, user age, and location. Users could skip this step.

Step 6: Submit. The user has reserved the vehicle, verified their identity, and optionally chosen insurance. Their information goes to a human agent.

Step 7: The agent calls. Within two hours, a human agent contacts the buyer. They answer questions. They handle financing if needed. They collect payment over the phone. They schedule delivery.

Humans closed the sale. Not a chatbot. Not a form. A person who could say "yes, the vehicle is exactly as described" and "yes, I can hold it while you arrange financing."

## The hard decision

We debated whether to collect payment online. Stripe was integrated. We could have charged the full amount or a deposit.

We chose not to.

The average transaction was $35,000. Nobody buys a $35,000 car without asking questions. Forcing online payment would have reduced conversions to the people who already knew they wanted the car — a tiny subset. Letting the agent handle payment meant we captured everyone who was interested but not yet certain.

The trade-off: we needed a call center. We needed trained agents. We needed phone infrastructure. But the conversion rate justified it. The online flow captured intent. The human closed the deal.

## What we got wrong

We initially included a trade-in estimator in the flow. Enter your VIN, get an instant estimate. It added complexity — vehicle condition, mileage, photos. It slowed down the checkout. Users who were not trading in had to skip it. Users who were trading in got a number that our agents often had to revise downward.

We removed it. Trade-in became a separate feature, not part of checkout. The checkout flow got faster. Conversions went up.

## What I learned

The best checkout flow is not the one with the most features. It is the one with the fewest steps between intent and human contact.

Carvana's 20-minute checkout is impressive engineering. But for a used EV marketplace where every vehicle is unique and every buyer has questions, the goal is not automation. It is qualification. You want to know the buyer is real, the vehicle is reserved, and the agent has everything they need for a 10-minute call that ends in a sale.

We benchmarked the best. Then we built less than the best. And it worked better.
