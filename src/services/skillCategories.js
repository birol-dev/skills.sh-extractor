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

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
