import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { icons as lucideIcons } from 'lucide';
import * as simpleIcons from 'simple-icons';
import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { escapeHtml, getCategoryKey, getCategoryIcon } from '../src/services/skillCategories.js';
import { brandSvg, kebabToPascal, lucideSvg } from '../src/ui/svg.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INCLUDE_RE = /<!--\s*include:([^>]+?)\s*-->/g;
const ICON_TAG_RE = /<i\s([^>]*?\bdata-(?:lucide|brand)="[^"]+"[^>]*)><\/i>/g;
const ATTR_RE = /([^\s="]+)="([^"]*)"/g;
const SKILLS_COUNT_RE = /<!--\s*skills-count:([a-z]+)\s*-->/g;

function countSkills(categoryKey) {
  if (categoryKey === 'all') return CURATED_SKILLS.length;
  return CURATED_SKILLS.filter((s) => getCategoryKey(s.category) === categoryKey).length;
}

function resolveIncludes(html, seen = new Set()) {
  return html.replace(INCLUDE_RE, (_, spec) => {
    const rel = spec.trim();
    if (seen.has(rel)) {
      throw new Error(`Circular HTML include: ${rel}`);
    }
    const next = new Set(seen);
    next.add(rel);
    const filePath = resolve(ROOT, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`HTML include not found: ${rel} (${filePath})`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return resolveIncludes(content, next);
  });
}

export function renderLucide(name, options) {
  const node = lucideIcons[kebabToPascal(name)];
  if (!node) throw new Error(`Unknown Lucide icon: "${name}"`);
  return lucideSvg(node, name, options);
}

export function renderBrand(slug, options) {
  const icon = simpleIcons[`si${kebabToPascal(slug)}`];
  if (!icon) throw new Error(`Unknown Simple Icons brand: "${slug}"`);
  return brandSvg(icon, options);
}

/**
 * Replaces `<i data-lucide="name"></i>` and `<i data-brand="slug"></i>` placeholders with inline SVG.
 * `data-size` / `data-stroke` set dimensions; `class`, `aria-label` and other attributes carry over.
 */
export function inlineIcons(html) {
  return html.replace(ICON_TAG_RE, (_, attrSource) => {
    const {
      'data-lucide': lucideName,
      'data-brand': brandSlug,
      'data-size': size,
      'data-stroke': strokeWidth,
      class: className,
      'aria-label': label,
      ...attrs
    } = Object.fromEntries([...attrSource.matchAll(ATTR_RE)].map(([, key, value]) => [key, value]));
    const options = { size: size ? Number(size) : undefined, className, label, attrs };
    return lucideName
      ? renderLucide(lucideName, { ...options, strokeWidth: strokeWidth ? Number(strokeWidth) : undefined })
      : renderBrand(brandSlug, options);
  });
}

function generateSkillsGrid() {
  return CURATED_SKILLS.map((s) => {
    const promptFallback = `# ${s.name}\n\n${s.description}`;
    const tok = s.tokenEstimate || Math.round(promptFallback.length / 4);
    const catKey = getCategoryKey(s.category);
    const slug = escapeHtml(s.slug);
    return `<article class="skill-card" data-category="${escapeHtml(catKey)}" data-skill-id="${slug}">
        <div class="card-ambient-overlay"></div>
        <div class="skill-card-header">
          <div class="skill-icon-box">${renderLucide(getCategoryIcon(s.category), { size: 18 })}</div>
          <div class="skill-meta-right">
            <span class="badge skill-category-badge" data-variant="outline">${escapeHtml(s.badge)}</span>
            <span class="skill-token-count">~${Number(tok).toLocaleString('en-US')} tok</span>
          </div>
        </div>
        <h3 class="skill-card-title">${escapeHtml(s.name)}</h3>
        <p class="skill-card-desc">${escapeHtml(s.description)}</p>
        <div class="skill-card-actions">
          <button type="button" class="btn skill-btn-preview" data-variant="outline" data-size="sm" data-preview-id="${slug}">
            ${renderLucide('eye', { attrs: { 'data-icon': 'inline-start' } })}
            <span>View Prompt</span>
          </button>
          <button type="button" class="btn skill-btn-copy" data-size="sm" data-copy-id="${slug}">
            ${renderLucide('copy', { attrs: { 'data-icon': 'inline-start' } })}
            <span>Copy</span>
          </button>
        </div>
      </article>`;
  }).join('\n      ');
}

function generateSkillsItemListJson() {
  const itemList = {
    '@type': 'ItemList',
    '@id': 'https://skillextract.birol.tech/skills/#itemlist',
    name: 'Curated AI skills library',
    description: '55+ pre-compiled prompt playbooks for copywriting, marketing, design, SEO, sales, pricing, and engineering.',
    numberOfItems: CURATED_SKILLS.length,
    itemListElement: CURATED_SKILLS.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: 'https://skillextract.birol.tech/skills/'
    }))
  };
  return JSON.stringify(itemList);
}

export function htmlIncludesPlugin() {
  return {
    name: 'html-includes',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let out = resolveIncludes(html);
        if (out.includes('<!-- skills-grid -->')) {
          out = out.replaceAll('<!-- skills-grid -->', generateSkillsGrid());
        }
        if (out.includes('SKILLS_ITEMLIST_JSON')) {
          out = out.replaceAll('SKILLS_ITEMLIST_JSON', generateSkillsItemListJson());
        }
        out = out.replace(SKILLS_COUNT_RE, (_, key) => String(countSkills(key)));
        return inlineIcons(out);
      }
    }
  };
}
