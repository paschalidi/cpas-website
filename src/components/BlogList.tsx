import { Link } from 'react-router-dom';
import { allPosts } from '../blog/loader';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

export function BlogList() {
  return (
    <div className="min-h-screen bg-blog-background text-blog-text">
      {/* Sunrise glow from the top center */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[20vh] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgb(var(--color-peach-300) / 0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header */}
        <header className="mb-20 md:mb-28">
          <Link
            to="/"
            className="inline-flex cursor-none items-center gap-2 text-sm text-blog-muted/60 hover:text-blog-accent transition-colors duration-300 mb-10 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="tracking-wide">Back to home</span>
          </Link>

          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-blog-text mb-6 leading-[1.1]">
            Notes
          </h1>
          <p className="text-lg md:text-xl text-blog-muted/60 max-w-xl leading-relaxed font-light">
            Writings on software engineering, devops, and things learned along the way.
          </p>
        </header>

        {/* Posts list — editorial, not cards */}
        <div className="space-y-0">
          {allPosts.map((post) => (
            <article key={post.slug} className="group">
              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-blog-border/10 via-blog-border/5 to-transparent mb-8" />

              <Link
                to={`/blog/${post.slug}`}
                className="flex cursor-none flex-col md:flex-row md:items-start gap-4 md:gap-8 pb-8 md:pb-12 transition-all duration-500"
              >
                {/* Left: Date + meta */}
                <div className="md:w-48 shrink-0 pt-1">
                  <time className="text-sm text-blog-muted/40 font-mono tracking-wide">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>

                {/* Right: Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl md:text-2xl font-normal text-blog-text group-hover:text-blog-accent transition-colors duration-300 leading-snug">
                      {post.title}
                    </h2>
                    <ArrowUpRight className="w-5 h-5 text-blog-muted/30 group-hover:text-blog-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 shrink-0 mt-1" />
                  </div>

                  {post.excerpt && (
                    <p className="mt-3 text-blog-muted/50 text-base leading-relaxed max-w-2xl font-light line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* Footer of list */}
        <div className="mt-16 pt-8 border-t border-blog-border/10">
          <p className="text-sm text-blog-muted/30 font-mono">
            {allPosts.length} notes
          </p>
        </div>
      </div>
    </div>
  );
}
