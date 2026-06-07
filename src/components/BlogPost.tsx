import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPostBySlug } from '../blog/loader';
import { ArrowLeft, ArrowUp, Clock } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';

function estimateReadingTime(html: string): number {
  const wordsPerMinute = 200;
  // Strip HTML tags to count words
  const text = html.replace(/<[^>]*>/g, ' ');
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!post) {
      navigate('/blog', { replace: true });
    }
  }, [post, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadingProgress(progress);
      setShowBackToTop(scrollTop > 600);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (post && post.html.includes('mermaid')) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#1a1a2e',
          primaryTextColor: '#e0e0e0',
          primaryBorderColor: '#4a4a6a',
          lineColor: '#6a6a8a',
          secondaryColor: '#16213e',
          tertiaryColor: '#0f3460',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          useMaxWidth: true,
        },
      });
      mermaid.run({
        querySelector: '.mermaid',
      });
    }
  }, [post]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!post) return null;

  const readingTime = estimateReadingTime(post.html);

  return (
    <div className="min-h-screen bg-blog-background text-blog-text">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-blog-border/10 z-50">
        <div
          className="h-full bg-gradient-to-r from-blog-accent to-blog-accent-muted transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Hero image */}
      {post.hero && (
        <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
          <img
            src={post.hero}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blog-background/30 via-transparent to-blog-background" />
        </div>
      )}

      <article ref={articleRef} className={`relative max-w-3xl mx-auto px-6 md:px-12 pb-32 ${post.hero ? '-mt-16 md:-mt-20' : 'pt-28 md:pt-32'}`}>
        {/* Navigation */}
        <nav className="mb-12">
          <Link
            to="/blog"
            className="inline-flex cursor-none items-center gap-2 text-sm text-blog-muted/60 hover:text-blog-accent transition-colors duration-300 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="tracking-wide">All notes</span>
          </Link>
        </nav>

        {/* Title block */}
        <header className="mb-16">
          <div className="flex items-center gap-4 text-sm text-blog-muted/40 mb-6">
            <time className="font-mono tracking-wide">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="w-1 h-1 rounded-full bg-blog-border/20" />
            <span className="flex items-center gap-1.5 font-mono tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              {readingTime} min read
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight text-blog-text leading-[1.15] mb-4">
            {post.title}
          </h1>

          <div className="flex items-center gap-3 mt-6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blog-accent to-blog-accent-muted flex items-center justify-center text-blog-background text-xs font-semibold">
              CP
            </div>
            <span className="text-sm text-blog-muted/50">{post.author}</span>
          </div>
        </header>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-blog-border/10 via-blog-border/5 to-transparent mb-12" />

        {/* Content */}
        {post.htmlPage ? (
          <div className="-mx-6 md:-mx-12 -mb-32">
            <iframe
              src={`/blog/html/${post.slug}/index.html`}
              className="w-full h-screen border-0"
              title={post.title}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div
            className="blog-content prose prose-invert max-w-none
              prose-headings:font-normal prose-headings:tracking-tight prose-headings:text-blog-text
              prose-h1:text-3xl prose-h1:mb-8 prose-h1:mt-12 prose-h1:leading-tight
              prose-h2:text-2xl prose-h2:mb-6 prose-h2:mt-14 prose-h2:leading-tight prose-h2:border-b prose-h2:border-blog-border/10 prose-h2:pb-3
              prose-h3:text-xl prose-h3:mb-4 prose-h3:mt-10 prose-h3:leading-snug
              prose-p:text-blog-muted/60 prose-p:leading-[1.8] prose-p:mb-6 prose-p:text-base
              prose-a:text-blog-accent prose-a:no-underline prose-a:border-b prose-a:border-blog-accent/30 hover:prose-a:border-blog-accent/80 prose-a:transition-colors prose-a:pb-0.5
              prose-strong:text-blog-text prose-strong:font-medium
              prose-code:text-peach-200 prose-code:bg-blog-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-blog-surface prose-pre:border prose-pre:border-blog-border/10 prose-pre:rounded-xl prose-pre:p-6 prose-pre:my-8 prose-pre:shadow-inner
              prose-pre:shadow-black/20
              prose-blockquote:border-l-2 prose-blockquote:border-blog-accent/40 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-blog-muted/60 prose-blockquote:bg-blog-surface/50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:my-8
              prose-img:rounded-xl prose-img:my-10 prose-img:shadow-lg prose-img:shadow-black/30
              prose-ul:my-6 prose-ul:pl-5 prose-ul:list-none
              prose-ol:my-6 prose-ol:pl-5
              prose-li:text-blog-muted/60 prose-li:mb-3 prose-li:leading-relaxed
              prose-li:marker:text-blog-accent/60
              prose-hr:border-blog-border/10 prose-hr:my-12
            "
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        )}


      </article>

      {/* Back to top */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 w-12 h-12 rounded-full bg-blog-surface border border-blog-border/10
          flex cursor-none items-center justify-center text-blog-muted/50 hover:text-blog-accent hover:border-blog-accent/30
          transition-all duration-500 z-40 shadow-lg shadow-black/30
          ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
