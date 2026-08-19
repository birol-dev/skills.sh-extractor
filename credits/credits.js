import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { initNavActive } from '../landing/js/nav.js';

initNavActive();

// Display metadata for each upstream source repo. Keyed by sourceUrl.
const SOURCE_INFO = {
  'https://github.com/coreyhaines31/marketingskills': {
    author: 'Corey Haines',
    repo: 'marketingskills',
    blurb: 'The marketing, growth, copywriting, SEO, and sales skills in this catalog are written by Corey Haines and contributors to the marketingskills repo — an open-source library of expert marketing playbooks for AI agents.'
  },
  'https://github.com/rknall/claude-skills': {
    author: 'rknall',
    repo: 'claude-skills',
    blurb: 'Design-focused agent skills, including the SVG Logo & Vector Designer.'
  },
  'https://github.com/vercel/ai': {
    author: 'Vercel',
    repo: 'ai',
    blurb: 'Engineering conventions inspired by the Vercel AI SDK ecosystem.'
  },
  'https://github.com/shadcn-ui/ui': {
    author: 'shadcn/ui contributors',
    repo: 'ui',
    blurb: 'UI component conventions inspired by the shadcn/ui project.'
  },
  'https://github.com/goldbergyoni/nodebestpractices': {
    author: 'Yoni Goldberg',
    repo: 'nodebestpractices',
    blurb: 'Security and code-quality conventions inspired by the Node.js Best Practices project.'
  },
  'https://github.com/vercel/next.js': {
    author: 'Vercel',
    repo: 'next.js',
    blurb: 'App Router and Server Actions conventions inspired by the Next.js project.'
  },
  'https://github.com/microsoft/playwright': {
    author: 'Microsoft',
    repo: 'playwright',
    blurb: 'End-to-end testing conventions inspired by the Playwright project.'
  }
};

function groupBySource(skills) {
  const groups = new Map();
  for (const skill of skills) {
    const key = skill.sourceUrl || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(skill);
  }
  // Sort groups by skill count descending, so the biggest contributor leads.
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function renderCredits() {
  const container = document.getElementById('creditsList');
  if (!container) return;

  const groups = groupBySource(CURATED_SKILLS);
  const totalSkills = CURATED_SKILLS.length;
  const countEl = document.getElementById('creditsTotalCount');
  if (countEl) countEl.textContent = String(totalSkills);

  container.innerHTML = groups.map(([sourceUrl, skills]) => {
    const info = SOURCE_INFO[sourceUrl] || {
      author: 'Unknown author',
      repo: sourceUrl.replace('https://github.com/', ''),
      blurb: ''
    };
    const skillNames = skills.map((s) => s.name).join(', ');
    return `
      <article class="credit-card">
        <div class="credit-card-head">
          <div>
            <span class="credit-author">${info.author}</span>
            <a class="credit-repo" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${info.repo} ↗</a>
          </div>
          <span class="credit-count">${skills.length} skill${skills.length === 1 ? '' : 's'}</span>
        </div>
        ${info.blurb ? `<p class="credit-blurb">${info.blurb}</p>` : ''}
        <p class="credit-skill-names">${skillNames}</p>
      </article>
    `;
  }).join('');
}

renderCredits();
