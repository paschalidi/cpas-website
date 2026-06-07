import React from 'react';

/**
 * Maps blog post slugs to React components.
 * When a slug has an entry here, BlogPost.tsx renders the component
 * instead of parsing the HTML file via dangerouslySetInnerHTML.
 *
 * Lazy-load each component so they can be large animation-heavy modules.
 */
const COMPONENT_REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {};

// Article 34 — Transactions & isolation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TransactionsArticle = React.lazy(() => import('../posts/34-transactions-isolation/TransactionsArticle') as any);
COMPONENT_REGISTRY['34-transactions-isolation'] = TransactionsArticle;

// Article 35 — Pub/Sub event system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PubSubArticle = React.lazy(() => import('../posts/35-pub-sub-event-system/PubSubArticle') as any);
COMPONENT_REGISTRY['35-pub-sub-event-system'] = PubSubArticle;

export function getArticleComponent(
  slug: string,
): React.LazyExoticComponent<React.ComponentType> | null {
  return COMPONENT_REGISTRY[slug] ?? null;
}
