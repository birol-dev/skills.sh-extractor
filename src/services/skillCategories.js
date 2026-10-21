/** Shared category mapping for the curated skills catalog. */

export function getCategoryKey(cat) {
  if (!cat) return 'other';
  const c = cat.toLowerCase();
  if (c.includes('copywriting')) return 'copywriting';
  if (c.includes('marketing') || c.includes('growth')) return 'marketing';
  if (c.includes('design') || c.includes('visual')) return 'design';
  if (c.includes('sales') || c.includes('outbound')) return 'sales';
  if (c.includes('seo') || c.includes('search')) return 'seo';
  if (c.includes('monetization') || c.includes('offer') || c.includes('pricing')) return 'monetization';
  if (c.includes('strategy') || c.includes('operations') || c.includes('revops') || c.includes('research')) return 'strategy';
  if (c.includes('engineering') || c.includes('code') || c.includes('dev')) return 'dev';
  return 'other';
}

/** Lucide icon name for each category key. */
export const CATEGORY_ICONS = {
  copywriting: 'pen-line',
  marketing: 'trending-up',
  design: 'palette',
  sales: 'send',
  seo: 'search',
  monetization: 'badge-dollar-sign',
  strategy: 'compass',
  dev: 'code-xml',
  other: 'sparkles'
};

/** Curated skills for the given category keys, alternating between them so each one shows up early. */
export function skillsForInterests(skills, interests) {
  const buckets = interests.map((key) => skills.filter((s) => getCategoryKey(s.category) === key));
  const mixed = [];
  for (let i = 0; buckets.some((b) => i < b.length); i++) {
    buckets.forEach((b) => { if (b[i]) mixed.push(b[i]); });
  }
  return mixed;
}

export function getCategoryIcon(cat) {
  return CATEGORY_ICONS[getCategoryKey(cat)];
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
