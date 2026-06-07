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
const publicHtmlDir = path.join(rootDir, 'public/blog/html');

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

function copyPostHtml(slug) {
  const sourceHtml = path.join(postsDir, slug, 'index.html');
  if (!fs.existsSync(sourceHtml)) {
    return false;
  }

  const targetDir = path.join(publicHtmlDir, slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceHtml, path.join(targetDir, 'index.html'));
  return true;
}

function buildPost(filePath) {
  const slug = path.basename(path.dirname(filePath));
  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);

  if (!data.title || !data.date) {
    throw new Error(`${filePath} must include title and date frontmatter`);
  }

  copyPostImages(slug);
  const hasHtml = copyPostHtml(slug);

  return {
    slug,
    title: String(data.title),
    author: String(data.author ?? 'Christos Paschalidis'),
    date: normalizeDate(data.date),
    ...(data.hero ? { hero: String(data.hero) } : {}),
    excerpt: String(data.excerpt ?? ''),
    ...(hasHtml ? { htmlPage: true } : {}),
    html: marked.parse(content),
  };
}

function sortByNewest(posts) {
  return posts.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

const posts = sortByNewest(findPostFiles().map(buildPost));

fs.writeFileSync(outputPath, `${JSON.stringify(posts, null, 2)}\n`);

console.log(`Built ${posts.length} blog posts → ${path.relative(rootDir, outputPath)}`);
