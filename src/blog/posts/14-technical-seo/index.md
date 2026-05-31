---
title: technical SEO for user acquisition — a developer's playbook
author: Christos Paschalidis
date: 2022-08-15
excerpt: Keyword research, Next.js SSR, and watching Google Search Console like it's a production service
---

# technical SEO for user acquisition — a developer's playbook

We had hundreds of pages for finding doctors by state and booking online consultations. "Find a doctor in California", "Book online in Texas", etc. Most of them ranked on page 4. That's the graveyard.

### the diagnosis

- pages were client-side rendered — Google saw empty divs
- titles were generic: "Find a Doctor" — no state, no keyword, no intent
- page speed was 6s on mobile — Core Web Vitals failing
- duplicate content across states — same copy, different URL

### what we changed

**1. keyword research with ahrefs**

found what people actually searched:
- "find a doctor near me" — high volume, local intent
- "doctor in [state]" — lower volume, higher intent
- "book doctor appointment online [city]" — long tail, easy wins

we rewrote titles and h1s to match exact search terms. not clever. exact.

**2. next.js SSR for every state page**

```tsx
// pages/[state]/index.tsx
export async function getServerSideProps({ params }) {
  const state = params.state;
  const doctors = await fetchDoctors(state);
  
  return {
    props: {
      state,
      doctors,
      title: `Find a Doctor in ${state} - Book Online Consultation`,
      description: `Top-rated doctors in ${state}. ${doctors.length} available. Book online consultations today.`,
    },
  };
}
```

Google got HTML, not a blank page. indexing improved in 2 weeks.

**3. unique content per state**

hired medical writers to create 2-3 unique paragraphs per state page. not spun content — actual local context. "Texas requires X certification", "California has Y regulations". useful to readers, unique to Google.

**4. performance fixes**

- switched images to next/image with lazy loading
- inlined critical CSS
- deferred non-essential JS
- added resource hints: `<link rel="preconnect" href="...">`

mobile speed went from 6s to 2.1s. Core Web Vitals passed.

**5. monitored Google Search Console weekly**

treated it like a production dashboard:
- crawled errors — fixed same day
- index coverage — watched for drops
- core web vitals — tracked per page
- search queries — found new keywords to target

### the result

- organic traffic up 340% in 6 months
- state pages moved from page 4 to page 1 for 12 states
- online consultation bookings from organic search up 280%
- cost per acquisition dropped 60% because we weren't buying those clicks anymore

### what I'd do differently

start with Search Console data before doing keyword research. we wasted time on keywords we were already ranking for. the real gaps were in the "Queries" tab, not the tool.

### one thing that surprised me

page speed mattered more than content quality for ranking. we had thin pages that ranked because they loaded fast. content depth helped with conversions, but speed got us the click.
