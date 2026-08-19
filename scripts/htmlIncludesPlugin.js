import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { escapeHtml, getCategoryKey } from '../src/services/skillCategories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INCLUDE_RE = /<!--\s*include:([^>]+?)\s*-->/g;

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

function generateSkillsGrid() {
  return CURATED_SKILLS.map((s) => {
    const promptFallback = `# ${s.name}\n\n${s.description}`;
    const tok = s.tokenEstimate || Math.round(promptFallback.length / 4);
    const catKey = getCategoryKey(s.category);
    return `<div class="skill-card" data-category="${escapeHtml(catKey)}" data-skill-id="${escapeHtml(s.slug)}">
        <div class="card-ambient-overlay"></div>
        <div class="skill-card-header">
          <div class="skill-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div class="skill-meta-right">
            <span class="skill-category-name">${escapeHtml(s.badge.toUpperCase())}</span>
            <span class="skill-token-count">~${Number(tok).toLocaleString('en-US')} tok</span>
          </div>
        </div>
        <h3 class="skill-card-title">${escapeHtml(s.name)}</h3>
        <p class="skill-card-desc">${escapeHtml(s.description)}</p>
        <div class="skill-card-actions">
          <button type="button" class="btn btn-card-preview skill-btn-preview" data-preview-id="${escapeHtml(s.slug)}">View Prompt</button>
          <button type="button" class="btn btn-primary btn-card-copy skill-btn-copy" data-copy-id="${escapeHtml(s.slug)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
      </div>`;
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
        return out;
      }
    }
  };
}
