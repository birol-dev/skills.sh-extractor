/**
 * skills.sh Extractor - Landing Page Interactive Controller
 * A/B Testing Harness, Playbook Simulator, Token Calculator, Referral Engine, Analytics
 * Strictly Shadcn Dark Zinc Aesthetic + Copy-Paste to Any AI Support
 */

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initABTesting();
  initPlaybookSimulator();
  initTokenCalculator();
  initFAQAccordion();
  initReferralEngine();
});

/* ================= 1. ANALYTICS & TELEMETRY DISPATCHER ================= */
function initAnalytics() {
  window.trackEvent = function(eventName, properties = {}) {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      ...properties
    };

    console.log(`[Analytics] 📡 ${eventName}:`, payload);

    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, properties);
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || 'direct';
  const utmCampaign = urlParams.get('utm_campaign') || 'landing_organic';
  window.trackEvent('page_view', { utm_source: utmSource, utm_campaign: utmCampaign });

  document.querySelectorAll('[data-track]').forEach(el => {
    el.addEventListener('click', () => {
      const eventName = el.getAttribute('data-track');
      const eventLabel = el.getAttribute('data-track-label') || el.innerText.trim();
      window.trackEvent(eventName, { label: eventLabel });
    });
  });
}

/* ================= 2. A/B TESTING ENGINE ================= */
function initABTesting() {
  const AB_STORAGE_KEY = 'skills_extractor_ab_hero_v2';
  let activeVariant = localStorage.getItem(AB_STORAGE_KEY);

  if (!activeVariant || (activeVariant !== 'A' && activeVariant !== 'B')) {
    activeVariant = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(AB_STORAGE_KEY, activeVariant);
  }

  applyVariant(activeVariant);

  const badgeBtn = document.getElementById('ab-switch-btn');
  const badgeLabel = document.getElementById('ab-current-label');

  if (badgeBtn && badgeLabel) {
    badgeLabel.innerText = `Variant ${activeVariant}`;
    badgeBtn.addEventListener('click', () => {
      activeVariant = activeVariant === 'A' ? 'B' : 'A';
      localStorage.setItem(AB_STORAGE_KEY, activeVariant);
      badgeLabel.innerText = `Variant ${activeVariant}`;
      applyVariant(activeVariant);
      window.trackEvent('ab_variant_manually_switched', { new_variant: activeVariant });
    });
  }
}

function applyVariant(variant) {
  const heroPill = document.getElementById('hero-ab-pill');
  const heroTitle = document.getElementById('hero-ab-title');
  const heroSubtitle = document.getElementById('hero-ab-subtitle');
  const heroPrimaryBtn = document.getElementById('hero-ab-primary-btn');
  const heroSecondaryBtn = document.getElementById('hero-ab-secondary-btn');

  if (!heroTitle) return;

  if (variant === 'A') {
    // Value Prop A: Extract Skills for Any AI (ChatGPT, Claude, IDEs)
    if (heroPill) heroPill.innerHTML = `<div class="badge-dot"></div><span>Extract Any Skill • Paste into Any AI</span>`;
    heroTitle.innerHTML = `Use AI Agent Skills <span class="highlight-text">Anywhere, Not Just in IDEs</span>`;
    if (heroSubtitle) heroSubtitle.innerText = `Extract skills.sh & GitHub repositories into self-contained, 1-click prompt playbooks. Copy-paste directly into ChatGPT, Claude.ai, Gemini, DeepSeek, Cursor, Windsurf, or Antigravity. Pure client-side WebAssembly, zero servers.`;
    if (heroPrimaryBtn) heroPrimaryBtn.innerText = `Launch WASM Studio Free`;
    if (heroSecondaryBtn) heroSecondaryBtn.innerText = `Test Interactive Simulator`;
  } else {
    // Value Prop B: Token Reduction & Playbook Compiler Focus
    if (heroPill) heroPill.innerHTML = `<div class="badge-dot"></div><span>⚡ Pure WebAssembly AI Playbook Compiler</span>`;
    heroTitle.innerHTML = `Turn Bloated Repos into <span class="highlight-text">1-Click AI Superpowers</span>`;
    if (heroSubtitle) heroSubtitle.innerText = `Stop burning 10,000+ context tokens on fragmented helper scripts and fragile CLI commands. Ingest any skill URL or ZIP and compile deterministic, self-contained playbooks in sub-milliseconds.`;
    if (heroPrimaryBtn) heroPrimaryBtn.innerText = `Compile Your First Skill Free`;
    if (heroSecondaryBtn) heroSecondaryBtn.innerText = `Calculate Token Savings`;
  }

  window.trackEvent('ab_variant_viewed', { experiment_id: 'EXP-001', variant: variant });
}

/* ================= 3. INTERACTIVE PLAYBOOK SIMULATOR ================= */
const SAMPLE_SKILLS = {
  'svg-logo': {
    name: 'SVG Logo Designer',
    author: 'rknall',
    repo: 'rknall/claude-skills',
    description: 'Generates professional vector SVG marks and responsive logo layouts for web applications.',
    uncompiledTokens: 9420,
    compiledTokens: 2180,
    formats: {
      'chatgpt': `# System / Prompt Directive: SVG Logo Designer
# (Self-contained prompt playbook compiled with skills.sh Extractor)

You are an expert SVG Logo and Brand Mark Designer.

## Directives & Execution Rules
1. Generate valid, scalable SVG XML code directly within \`\`\`xml ... \`\`\` code blocks.
2. Enforce standard <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg"> attributes.
3. Utilize harmonious HSL color palettes and avoid external web fonts.

## Inlined Helper Script (Validation & Color Math)
\`\`\`javascript
function calculateHarmonicPalette(baseHex) {
  // Linear memory color harmony calculation
  return [baseHex, adjustHue(baseHex, 30), adjustHue(baseHex, -30)];
}
\`\`\`

## Quick Reference Guidelines
- Always convert typography to path outlines when precision rendering is needed.
- Optimize viewBox coordinates for responsive scaling.`,
      'claude': `---
name: SVG Logo Designer
description: Create professional SVG logos, brand marks, and scalable vector graphics.
metadata:
  compiled_by: skills.sh WASM Extractor
  source: rknall/claude-skills
---

# SVG Logo Designer Directive (CLAUDE.md)
When generating SVG logos, enforce semantic <svg viewBox="0 0 500 500"> coordinates, responsive viewport scaling, and harmonious HSL color palettes.

## Consolidated Helper Scripts
\`\`\`javascript
export function validateSvgXml(rawSvg) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, "image/svg+xml");
  return !doc.querySelector("parsererror");
}
\`\`\``,
      'cursor': `# .cursorrules / .mdc Playbook - SVG Logo Designer
# Source: rknall/claude-skills | Compiled with skills.sh WASM

You are an expert SVG Logo Designer.
- Generate valid, pure XML SVG graphics with viewBox and xmlns attributes.
- Use embedded scripts when calculating color palettes.

### Helper Scripts (Consolidated)
\`\`\`javascript
function calculateHarmonicPalette(baseHex) {
  return [baseHex, adjustHue(baseHex, 30), adjustHue(baseHex, -30)];
}
\`\`\``,
      'windsurf': `<!-- .windsurfrules Directive: SVG Logo Designer -->
<rule>
  <trigger>When user requests logo, branding, or SVG generation</trigger>
  <action>Generate self-contained SVG with inline CSS variables and semantic geometric tags.</action>
</rule>`,
      'antigravity': `---
name: svg-logo-designer
description: Create professional SVG logos from descriptions and specifications.
---

# Antigravity Custom Skill: SVG Logo Designer
Location: .agents/skills/svg-logo-designer/SKILL.md

## Embedded Validation Helpers
\`\`\`javascript
const isValidSvg = (str) => str.includes('<svg') && str.includes('</svg>');
\`\`\``
    }
  },
  'ai-seo': {
    name: 'AI SEO & AEO Engine',
    author: 'birol-dev',
    repo: 'birol-dev/agent-skills',
    description: 'Optimizes web content for Perplexity, ChatGPT Search, Gemini, and Google AI Overviews.',
    uncompiledTokens: 12800,
    compiledTokens: 3100,
    formats: {
      'chatgpt': `# System Directive: AI Search Engine Optimization (AEO / GEO)
# (Self-contained prompt playbook compiled with skills.sh Extractor)

You are an expert in Generative Engine Optimization (GEO) and AI Search (Perplexity, ChatGPT Search, Gemini).

## Core Directives
1. Structure definitions into 40-60 word extractable passage blocks at the beginning of each key topic.
2. Provide JSON-LD structured data (@graph with SoftwareApplication, Organization, FAQPage).
3. Generate machine-readable /llms.txt and /pricing.md files for autonomous agents.

## Embedded Verification Script
\`\`\`javascript
export function auditExtractability(text) {
  const words = text.trim().split(/\\s+/).length;
  return words >= 40 && words <= 60;
}
\`\`\``,
      'claude': `---
name: ai-seo
description: Optimize content for AI answer engines (Perplexity, ChatGPT, AI Overviews).
---
# AI SEO Playbook (CLAUDE.md)
Structure key answers in 40-60 word extractable definition blocks. Add JSON-LD @graph.

## Consolidated Helper Scripts
\`\`\`javascript
export function checkRichSnippets(jsonLd) {
  return jsonLd["@context"] === "https://schema.org" && jsonLd["@graph"];
}
\`\`\``,
      'cursor': `# .cursorrules - AI SEO & Answer Engine Optimization
Ensure every public guide contains extractable definition boxes, schema markup, and machine-readable /llms.txt definitions.`,
      'windsurf': `<!-- .windsurfrules: AI Search Engine Optimization -->
<rule>Format answers for direct LLM extraction and Perplexity citation with verified stats.</rule>`,
      'antigravity': `---
name: ai-seo
description: AI search optimization for Antigravity agents.
---
# Antigravity Skill: AI SEO
Target queries with 40-60 word direct answers and authoritative entity signals.`
    }
  },
  'ab-testing': {
    name: 'A/B Testing Framework',
    author: 'growth-lab',
    repo: 'growth-lab/experimentation-skills',
    description: 'Designs statistically sound split tests with ICE prioritization and sample size math.',
    uncompiledTokens: 8600,
    compiledTokens: 1950,
    formats: {
      'chatgpt': `# System / Prompt Directive: A/B Testing & Growth Experiments
# (Self-contained prompt playbook compiled with skills.sh Extractor)

You are an expert Growth Experimentation Strategist and Statistician.

## Hypothesis Framework
Always formulate hypotheses as:
"Because [Data/Observation], we believe [Change] will cause [Expected Lift] for [Audience]. Measured by [Primary Metric]."

## Inlined Sample Size Calculator
\`\`\`javascript
function calculateSampleSize(baselineRate, mde, alpha = 0.05, power = 0.8) {
  return Math.ceil(16 * (baselineRate * (1 - baselineRate)) / Math.pow(baselineRate * mde, 2));
}
\`\`\``,
      'claude': `---
name: ab-testing
description: Plan, design, and analyze statistically rigorous A/B experiments.
---
# A/B Testing Framework
Formulate hypotheses using: "Because [Data], we believe [Change] will cause [Lift]."`,
      'cursor': `# .cursorrules - Experimentation & Split Testing
Always define primary metric, secondary metrics, and guardrail metrics prior to test start.`,
      'windsurf': `<!-- .windsurfrules: A/B Testing -->
<rule>Pre-commit to sample size; forbid early stopping or peeking bias.</rule>`,
      'antigravity': `---
name: ab-testing
description: Antigravity experiment playbook with ICE scoring.
---
Score all backlog hypotheses on Impact, Confidence, and Ease.`
    }
  }
};

let currentSkillId = 'svg-logo';
let currentFormat = 'chatgpt';

function initPlaybookSimulator() {
  const skillChips = document.querySelectorAll('.sim-skill-chip');
  const formatTabs = document.querySelectorAll('.sim-format-tab');
  const codePreview = document.getElementById('sim-code-preview');
  const copyBtn = document.getElementById('sim-copy-btn');

  function renderSimulator() {
    const skill = SAMPLE_SKILLS[currentSkillId];
    if (!skill) return;

    const rawCode = skill.formats[currentFormat] || skill.formats['chatgpt'];
    if (codePreview) {
      codePreview.textContent = rawCode;
    }

    const uncompiledEl = document.getElementById('sim-uncompiled-tokens');
    const compiledEl = document.getElementById('sim-compiled-tokens');
    const savingsEl = document.getElementById('sim-token-savings');

    if (uncompiledEl) uncompiledEl.textContent = skill.uncompiledTokens.toLocaleString();
    if (compiledEl) compiledEl.textContent = skill.compiledTokens.toLocaleString();
    if (savingsEl) {
      const pct = Math.round((1 - skill.compiledTokens / skill.uncompiledTokens) * 100);
      savingsEl.textContent = `-${pct}%`;
    }
  }

  skillChips.forEach(chip => {
    chip.addEventListener('click', () => {
      skillChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentSkillId = chip.getAttribute('data-skill');
      renderSimulator();
      window.trackEvent('simulator_skill_changed', { skill: currentSkillId });
    });
  });

  formatTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      formatTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFormat = tab.getAttribute('data-format');
      renderSimulator();
      window.trackEvent('simulator_format_changed', { format: currentFormat });
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = codePreview ? codePreview.textContent : '';
      navigator.clipboard.writeText(code).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `✓ Copied to Clipboard!`;
        setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
        window.trackEvent('simulator_code_copied', { skill: currentSkillId, format: currentFormat });
      });
    });
  }

  renderSimulator();
}

/* ================= 4. CONTEXT TOKEN & COST SAVINGS CALCULATOR ================= */
function initTokenCalculator() {
  const skillsSlider = document.getElementById('calc-skills-count');
  const sizeSlider = document.getElementById('calc-repo-size');
  const teamSlider = document.getElementById('calc-team-size');

  const skillsVal = document.getElementById('val-skills-count');
  const sizeVal = document.getElementById('val-repo-size');
  const teamVal = document.getElementById('val-team-size');

  const tokensSavedEl = document.getElementById('calc-tokens-saved');
  const costSavedEl = document.getElementById('calc-cost-saved');
  const latencySavedEl = document.getElementById('calc-latency-saved');

  function calculateROI() {
    const numSkills = parseInt(skillsSlider ? skillsSlider.value : 5, 10);
    const avgRepoKb = parseInt(sizeSlider ? sizeSlider.value : 300, 10);
    const teamSize = parseInt(teamSlider ? teamSlider.value : 10, 10);

    if (skillsVal) skillsVal.textContent = `${numSkills} skills`;
    if (sizeVal) sizeVal.textContent = `${avgRepoKb} KB`;
    if (teamVal) teamVal.textContent = `${teamSize} devs`;

    const tokensPerSkillRaw = Math.round(avgRepoKb * 25);
    const tokensPerSkillCompiled = Math.round(tokensPerSkillRaw * 0.28);
    const savedPerSkill = tokensPerSkillRaw - tokensPerSkillCompiled;

    const totalTokensSavedPerSession = savedPerSkill * numSkills;
    const monthlySessions = teamSize * 40;
    const monthlyTokensSaved = totalTokensSavedPerSession * monthlySessions;

    const monthlyDollarsSaved = Math.round((monthlyTokensSaved / 1000000) * 3.0);
    const latencyReductionSeconds = ((totalTokensSavedPerSession / 50000) * 1.2).toFixed(1);

    if (tokensSavedEl) tokensSavedEl.textContent = `${(monthlyTokensSaved / 1000000).toFixed(1)}M`;
    if (costSavedEl) costSavedEl.textContent = `$${monthlyDollarsSaved.toLocaleString()}/mo`;
    if (latencySavedEl) latencySavedEl.textContent = `~${latencyReductionSeconds}s faster/prompt`;
  }

  [skillsSlider, sizeSlider, teamSlider].forEach(slider => {
    if (slider) {
      slider.addEventListener('input', () => {
        calculateROI();
        window.trackEvent('roi_calculator_adjusted', {
          skills: skillsSlider.value,
          size: sizeSlider.value,
          team: teamSlider.value
        });
      });
    }
  });

  calculateROI();
}

/* ================= 5. FAQ ACCORDION ================= */
function initFAQAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
          const qText = questionBtn.innerText.trim();
          window.trackEvent('faq_question_opened', { question: qText });
        }
      });
    }
  });
}

/* ================= 6. VIRAL REFERRAL & ADVOCATE ENGINE ================= */
function initReferralEngine() {
  const refInput = document.getElementById('referral-link-input');
  const copyRefBtn = document.getElementById('copy-referral-btn');
  const shareTwitter = document.getElementById('share-twitter-btn');
  const shareLinkedin = document.getElementById('share-linkedin-btn');
  const shareReddit = document.getElementById('share-reddit-btn');

  let userRef = localStorage.getItem('skills_extractor_ref_code');
  if (!userRef) {
    const randomId = Math.random().toString(36).substring(2, 7);
    userRef = `agent_dev_${randomId}`;
    localStorage.setItem('skills_extractor_ref_code', userRef);
  }

  const baseUrl = window.location.origin + window.location.pathname.replace('/landing/', '/');
  const referralUrl = `${baseUrl}?ref=${userRef}&utm_source=referral&utm_campaign=advocate_loop`;

  if (refInput) {
    refInput.value = referralUrl;
  }

  if (copyRefBtn && refInput) {
    copyRefBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(refInput.value).then(() => {
        const orig = copyRefBtn.innerText;
        copyRefBtn.innerText = 'Copied!';
        setTimeout(() => { copyRefBtn.innerText = orig; }, 2000);
        window.trackEvent('referral_link_copied', { code: userRef });
      });
    });
  }

  const shareText = encodeURIComponent(`Extract any skill from skills.sh or GitHub and copy-paste directly into ChatGPT, Claude.ai, Gemini or IDEs with skills.sh WASM Extractor! ⚡`);
  const encodedUrl = encodeURIComponent(referralUrl);

  if (shareTwitter) {
    shareTwitter.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`;
    shareTwitter.addEventListener('click', () => window.trackEvent('referral_shared', { platform: 'twitter' }));
  }

  if (shareLinkedin) {
    shareLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    shareLinkedin.addEventListener('click', () => window.trackEvent('referral_shared', { platform: 'linkedin' }));
  }

  if (shareReddit) {
    shareReddit.href = `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent('skills.sh Extractor - WebAssembly AI Agent Playbook Compiler')}`;
    shareReddit.addEventListener('click', () => window.trackEvent('referral_shared', { platform: 'reddit' }));
  }
}
