import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<pre class="mermaid">${text}</pre>\n`;
      }
      return false;
    },
  },
});

const rootDir = process.cwd();
const postsDir = path.join(rootDir, 'src/blog/posts');
const outputPath = path.join(rootDir, 'src/blog/posts.json');
const publicImagesDir = path.join(rootDir, 'public/blog/images');

function findPostFiles() {
  return fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(postsDir, entry.name);
      return ['index.md', 'index.mdx']
        .map((fileName) => path.join(dir, fileName))
        .filter((filePath) => fs.existsSync(filePath));
    });
}

function normalizeDate(date) {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date ?? '');
}

function copyPostImages(slug) {
  const sourceImagesDir = path.join(postsDir, slug, 'images');
  if (!fs.existsSync(sourceImagesDir)) {
    return;
  }
  const targetImagesDir = path.join(publicImagesDir, slug);
  fs.mkdirSync(targetImagesDir, { recursive: true });
  fs.cpSync(sourceImagesDir, targetImagesDir, { recursive: true });
}

/**
 * Parse a standalone HTML post: extract inline styles and body content,
 * stripping the page shell (<nav class="toc">, <header>) so only the
 * interactive sections remain.
 */
function parseHtmlPost(slug) {
  const htmlPath = path.join(postsDir, slug, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    return null;
  }

  const raw = fs.readFileSync(htmlPath, 'utf8');

  // Extract all <style> blocks from <head>
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let styleMatch;
  const styleBlocks = [];
  while ((styleMatch = styleRegex.exec(raw)) !== null) {
    styleBlocks.push(styleMatch[1]);
  }
  const rawStyles = styleBlocks.join('\n');

  // Filter out selectors that target the page shell (body, html, universal)
  const filteredStyles = rawStyles
    .replace(/\*\{[^}]*\}/g, '')
    .replace(/html\{[^}]*\}/g, '')
    .replace(/body(::?[a-z-]*)?\{[^}]*\}/g, '');

  // Extract everything inside <body> … </body>
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) {
    return null;
  }

  let bodyHtml = bodyMatch[1];

  // Remove the TOC nav (floating sidebar — not needed inline)
  bodyHtml = bodyHtml.replace(/<nav[^>]*class="toc"[^>]*>[\s\S]*?<\/nav>/i, '');

  // Remove the <header> (title/kicker — BlogPost.tsx handles that)
  bodyHtml = bodyHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/i, '');

  return {
    html: bodyHtml.trim(),
    styles: filteredStyles.trim(),
  };
}

function buildPost(filePath) {
  const slug = path.basename(path.dirname(filePath));
  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);

  if (!data.title || !data.date) {
    throw new Error(`${filePath} must include title and date frontmatter`);
  }

  copyPostImages(slug);
  const htmlPost = parseHtmlPost(slug);

  const post = {
    slug,
    title: String(data.title),
    author: String(data.author ?? 'Christos Paschalidis'),
    date: normalizeDate(data.date),
    ...(data.hero ? { hero: String(data.hero) } : {}),
    excerpt: String(data.excerpt ?? ''),
    html: htmlPost ? htmlPost.html : marked.parse(content),
  };

  if (htmlPost && htmlPost.styles) {
    post.styles = htmlPost.styles;
  }

  return post;
}

function sortByNewest(posts) {
  return posts.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

const posts = sortByNewest(findPostFiles().map(buildPost));

fs.writeFileSync(outputPath, `${JSON.stringify(posts, null, 2)}\n`);

console.log(`Built ${posts.length} blog posts → ${path.relative(rootDir, outputPath)}`);
