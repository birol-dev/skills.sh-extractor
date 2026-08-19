import fs from 'fs';
import path from 'path';

const skillsDir = path.resolve('.agents/skills');
const dirs = fs.readdirSync(skillsDir);

const categoryMap = {
  'copywriting': { cat: 'Copywriting', badge: 'Copywriting', icon: 'pen' },
  'copy-editing': { cat: 'Copywriting', badge: 'Copywriting', icon: 'edit' },
  'cold-email': { cat: 'Sales & Outbound', badge: 'Sales', icon: 'mail' },
  'prospecting': { cat: 'Sales & Outbound', badge: 'Sales', icon: 'target' },
  'sales-enablement': { cat: 'Sales & Outbound', badge: 'Sales', icon: 'briefcase' },
  'ab-testing': { cat: 'Marketing & Growth', badge: 'Growth', icon: 'activity' },
  'ad-creative': { cat: 'Marketing & Growth', badge: 'Ads', icon: 'image' },
  'ads': { cat: 'Marketing & Growth', badge: 'Ads', icon: 'trending-up' },
  'analytics': { cat: 'Strategy & Operations', badge: 'Analytics', icon: 'bar-chart' },
  'attribution': { cat: 'Strategy & Operations', badge: 'Attribution', icon: 'pie-chart' },
  'churn-prevention': { cat: 'Marketing & Growth', badge: 'Retention', icon: 'shield' },
  'co-marketing': { cat: 'Marketing & Growth', badge: 'Partnership', icon: 'users' },
  'community-marketing': { cat: 'Marketing & Growth', badge: 'Community', icon: 'message-circle' },
  'competitor-profiling': { cat: 'Strategy & Operations', badge: 'Research', icon: 'search' },
  'competitors': { cat: 'Copywriting', badge: 'Positioning', icon: 'git-compare' },
  'content-strategy': { cat: 'Marketing & Growth', badge: 'Content', icon: 'file-text' },
  'cro': { cat: 'Marketing & Growth', badge: 'CRO', icon: 'sliders' },
  'customer-research': { cat: 'Strategy & Operations', badge: 'Research', icon: 'user-check' },
  'directory-submissions': { cat: 'AI Search & SEO', badge: 'SEO', icon: 'folder' },
  'emails': { cat: 'Copywriting', badge: 'Lifecycle', icon: 'inbox' },
  'free-tools': { cat: 'Marketing & Growth', badge: 'Lead Gen', icon: 'tool' },
  'image': { cat: 'Design & Visuals', badge: 'Graphics', icon: 'image' },
  'influencer-marketing': { cat: 'Marketing & Growth', badge: 'Influencers', icon: 'star' },
  'launch': { cat: 'Marketing & Growth', badge: 'GTM Launch', icon: 'rocket' },
  'lead-magnets': { cat: 'Marketing & Growth', badge: 'Lead Gen', icon: 'download' },
  'marketing-council': { cat: 'Strategy & Operations', badge: 'Advisory', icon: 'users' },
  'marketing-ideas': { cat: 'Marketing & Growth', badge: 'Ideation', icon: 'zap' },
  'marketing-loops': { cat: 'Strategy & Operations', badge: 'Automation', icon: 'refresh-cw' },
  'marketing-plan': { cat: 'Strategy & Operations', badge: 'Strategy', icon: 'map' },
  'marketing-psychology': { cat: 'Marketing & Growth', badge: 'Psychology', icon: 'brain' },
  'offers': { cat: 'Monetization & Offers', badge: 'Offers', icon: 'gift' },
  'onboarding': { cat: 'Marketing & Growth', badge: 'Onboarding', icon: 'smile' },
  'paywalls': { cat: 'Monetization & Offers', badge: 'Monetization', icon: 'lock' },
  'popups': { cat: 'Marketing & Growth', badge: 'CRO', icon: 'alert-circle' },
  'pricing': { cat: 'Monetization & Offers', badge: 'Pricing', icon: 'dollar-sign' },
  'product-marketing': { cat: 'Strategy & Operations', badge: 'Positioning', icon: 'compass' },
  'programmatic-seo': { cat: 'AI Search & SEO', badge: 'pSEO', icon: 'layers' },
  'public-relations': { cat: 'Marketing & Growth', badge: 'PR', icon: 'globe' },
  'referrals': { cat: 'Marketing & Growth', badge: 'Virality', icon: 'share-2' },
  'revops': { cat: 'Strategy & Operations', badge: 'RevOps', icon: 'settings' },
  'schema': { cat: 'AI Search & SEO', badge: 'Structured Data', icon: 'code' },
  'ai-seo': { cat: 'AI Search & SEO', badge: 'AI Search', icon: 'cpu' },
  'seo-audit': { cat: 'AI Search & SEO', badge: 'Technical SEO', icon: 'search' },
  'signup': { cat: 'Marketing & Growth', badge: 'Conversion', icon: 'user-plus' },
  'site-architecture': { cat: 'AI Search & SEO', badge: 'Architecture', icon: 'sitemap' },
  'sms': { cat: 'Marketing & Growth', badge: 'SMS', icon: 'phone' },
  'social': { cat: 'Marketing & Growth', badge: 'Social Media', icon: 'share' },
  'svg-logo-designer': { cat: 'Design & Visuals', badge: 'Vector Design', icon: 'palette' },
  'video': { cat: 'Design & Visuals', badge: 'Video Production', icon: 'video' },
  'aso': { cat: 'AI Search & SEO', badge: 'App Store', icon: 'smartphone' }
};

const formatName = (dir, rawName) => {
  if (dir === 'svg-logo-designer') return 'SVG Logo & Vector Designer';
  if (dir === 'ai-seo') return 'AI Search & GEO Engine (Perplexity & Claude)';
  if (dir === 'seo-audit') return 'Technical SEO & On-Page Auditor';
  if (dir === 'cro') return 'Conversion Rate Optimization (CRO) Architect';
  if (dir === 'cold-email') return 'B2B Cold Outreach & Follow-Up Sequencer';
  if (dir === 'ab-testing') return 'Growth Experiment & A/B Testing Lead';
  if (dir === 'copywriting') return 'Direct-Response Landing Page Copywriter';
  if (dir === 'marketing-plan') return 'Comprehensive GTM Marketing Planner (AARRR)';
  if (dir === 'programmatic-seo') return 'Programmatic SEO & Template Scaler';
  if (dir === 'offers') return 'Grand Slam Offer & Risk Reversal Architect';
  if (dir === 'pricing') return 'SaaS Pricing & Packaging Monetizer';
  if (dir === 'paywalls') return 'In-App Paywall & Feature Gate Optimizer';
  if (dir === 'lead-magnets') return 'High-Converting Lead Magnet Creator';
  if (dir === 'revops') return 'RevOps & Marketing-to-Sales Pipeline Engine';
  if (dir === 'customer-research') return 'Voice of Customer & ICP Research Miner';
  if (dir === 'marketing-council') return 'Legendary Marketers Board of Advisors';
  return dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatCleanDesc = (desc, dir) => {
  let clean = desc.replace(/^"+|"+$/g, '').replace(/^When the user wants (to )?/i, '').replace(/^Also use when.*/i, '').trim();
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  if (!clean.endsWith('.')) clean += '.';
  if (clean.length > 150) clean = clean.substring(0, 147) + '...';
  return clean;
};

const curated = [];
for (const dir of dirs) {
  const skillFile = path.join(skillsDir, dir, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    const content = fs.readFileSync(skillFile, 'utf-8');
    const nameMatch = content.match(/name:\s*(.+)/);
    const descMatch = content.match(/description:\s*(.+)/);
    const rawName = nameMatch ? nameMatch[1].trim() : dir;
    const rawDesc = descMatch ? descMatch[1].trim() : '';
    const meta = categoryMap[dir] || { cat: 'Marketing & Growth', badge: 'Skill', icon: 'zap' };

    curated.push({
      id: 'curated_' + dir.replace(/-/g, '_'),
      slug: dir,
      name: formatName(dir, rawName),
      category: meta.cat,
      badge: meta.badge,
      description: formatCleanDesc(rawDesc, dir),
      command: `npx skills add https://github.com/rknall/claude-skills --skill '${dir}'`,
      sourceUrl: 'https://github.com/rknall/claude-skills',
      subdir: dir,
      tags: [dir, meta.badge.toLowerCase(), meta.cat.toLowerCase().split(' ')[0]],
      icon: meta.icon,
      tokenEstimate: Math.round(content.length / 4)
    });
  }
}

// Add top engineering curated skills as well
curated.push(
  {
    id: 'curated_ts_refactor',
    slug: 'typescript-strict',
    name: 'TypeScript Strict Refactorer & Zod Validator',
    category: 'Engineering & Code',
    badge: 'TypeScript',
    description: 'Refactor JavaScript and loose TypeScript to strict type-safe code with zod schemas and exhaustiveness checks.',
    command: 'npx skills add https://github.com/vercel/ai --skill typescript-strict',
    sourceUrl: 'https://github.com/vercel/ai',
    subdir: 'typescript-strict',
    tags: ['typescript', 'refactor', 'typesafe', 'zod', 'dev'],
    icon: 'code',
    tokenEstimate: 2300
  },
  {
    id: 'curated_shadcn_ui',
    slug: 'shadcn-ui',
    name: 'Shadcn & Tailwind UI Component Architect',
    category: 'Engineering & Code',
    badge: 'Frontend',
    description: 'Assemble modern interfaces using Radix primitives, Tailwind CSS utilities, and Framer Motion transitions.',
    command: 'npx skills add https://github.com/shadcn-ui/ui --skill react-components',
    sourceUrl: 'https://github.com/shadcn-ui/ui',
    subdir: 'react-components',
    tags: ['react', 'tailwind', 'shadcn', 'ui', 'css'],
    icon: 'layout',
    tokenEstimate: 2150
  },
  {
    id: 'curated_code_review',
    slug: 'code-review-security',
    name: 'Agentic Code Review & Security Audit',
    category: 'Engineering & Code',
    badge: 'Security',
    description: 'Thorough static analysis, vulnerability detection (OWASP Top 10), and clean code architecture compliance.',
    command: 'npx skills add https://github.com/goldbergyoni/nodebestpractices --skill security-audit',
    sourceUrl: 'https://github.com/goldbergyoni/nodebestpractices',
    subdir: 'security-audit',
    tags: ['security', 'audit', 'code-review', 'owasp'],
    icon: 'shield',
    tokenEstimate: 2400
  },
  {
    id: 'curated_nextjs_expert',
    slug: 'nextjs-app-router',
    name: 'Next.js App Router & Server Actions Master',
    category: 'Engineering & Code',
    badge: 'Fullstack',
    description: 'Architect scalable Server Components, Server Actions, parallel routes, and cache optimizations in Next.js.',
    command: 'npx skills add https://github.com/vercel/next.js --skill app-router-expert',
    sourceUrl: 'https://github.com/vercel/next.js',
    subdir: 'app-router-expert',
    tags: ['nextjs', 'react', 'rsc', 'server-actions'],
    icon: 'layers',
    tokenEstimate: 2200
  },
  {
    id: 'curated_playwright_vitest',
    slug: 'playwright-vitest-qa',
    name: 'E2E & Vitest QA Test Automation',
    category: 'Engineering & Code',
    badge: 'Testing',
    description: 'Generate rock-solid end-to-end browser test suites, unit test mocks, and GitHub Actions CI pipelines.',
    command: 'npx skills add https://github.com/microsoft/playwright --skill test-generator',
    sourceUrl: 'https://github.com/microsoft/playwright',
    subdir: 'test-generator',
    tags: ['testing', 'playwright', 'vitest', 'automation', 'qa'],
    icon: 'check-circle',
    tokenEstimate: 1950
  }
);

const outContent = '// Curated catalog of top AI agent prompt playbooks and skills (55+ items)\n' +
  'export const CURATED_SKILLS = ' + JSON.stringify(curated, null, 2) + ';\n';

fs.writeFileSync('src/services/curatedSkills.js', outContent, 'utf-8');
console.log('Successfully wrote', curated.length, 'curated skills to src/services/curatedSkills.js');
