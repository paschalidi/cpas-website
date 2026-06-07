import postsData from './posts.json';

export interface BlogPost {
  slug: string;
  title: string;
  author: string;
  date: string;
  hero?: string;
  excerpt: string;
  html: string;
  htmlPage?: boolean;
}

export const allPosts: BlogPost[] = postsData as BlogPost[];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return allPosts.find((p) => p.slug === slug);
}
