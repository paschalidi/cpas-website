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

// Article 36 — Caching
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CachingArticle = React.lazy(() => import('../posts/36-caching/CachingArticle') as any);
COMPONENT_REGISTRY['36-caching'] = CachingArticle;

// Article 38 — DDIA Chapter 6: Partitioning
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PartitioningArticle = React.lazy(() => import('../posts/38-ddia-ch06-partitioning/PartitioningArticle') as any);
COMPONENT_REGISTRY['38-ddia-ch06-partitioning'] = PartitioningArticle;

// Article 39 — DDIA Chapter 7: Transactions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DDIATransactionsArticle = React.lazy(() => import('../posts/39-ddia-ch07-transactions/TransactionsArticle') as any);
COMPONENT_REGISTRY['39-ddia-ch07-transactions'] = DDIATransactionsArticle;

// Article 40 — DDIA Chapter 8: Distributed Systems
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DistributedTroubleArticle = React.lazy(() => import('../posts/40-ddia-ch08-distributed-trouble/DistributedTroubleArticle') as any);
COMPONENT_REGISTRY['40-ddia-ch08-distributed-trouble'] = DistributedTroubleArticle;

// Article 41 — DDIA Chapter 9: Consistency & Consensus
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConsistencyConsensusArticle = React.lazy(() => import('../posts/41-ddia-ch09-consistency-consensus/ConsistencyConsensusArticle') as any);
COMPONENT_REGISTRY['41-ddia-ch09-consistency-consensus'] = ConsistencyConsensusArticle;

// Article 42 — DDIA Chapter 10: Batch Processing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BatchProcessingArticle = React.lazy(() => import('../posts/42-ddia-ch10-batch-processing/BatchProcessingArticle') as any);
COMPONENT_REGISTRY['42-ddia-ch10-batch-processing'] = BatchProcessingArticle;

export function getArticleComponent(
  slug: string,
): React.LazyExoticComponent<React.ComponentType> | null {
  return COMPONENT_REGISTRY[slug] ?? null;
}
