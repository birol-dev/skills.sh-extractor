import { CURATED_SKILLS } from '../../src/services/curatedSkills.js';
import { showToast } from './toast.js';
import { loadPrompts } from './prompts.js';

export function initHeroWidget() {
  const input = document.getElementById('widgetSkillInput');
  const extractBtn = document.getElementById('widgetExtractBtn');
  const outputPanel = document.getElementById('widgetOutputPanel');
  const outputBadge = document.getElementById('outputBadge');
  const outputSkillName = document.getElementById('outputSkillName');
  const outputTokens = document.getElementById('outputTokens');
  const outputCode = document.getElementById('outputCodeSnippet');
  const copyPromptBtn = document.getElementById('widgetCopyPromptBtn');
  const tabsRoot = document.querySelector('.widget-tabs');
  const tablist = document.getElementById('presetTabs');
  const presetTabs = tablist ? tablist.querySelectorAll('[role="tab"]') : [];

  if (!input || !extractBtn) return;

  let activeSlug = 'copywriting';
  let isPresetValue = true;
  let copyResetTimer = null;

  async function renderHeroSkill(slug, animate = true) {
    const item = CURATED_SKILLS.find(s => s.slug === slug) || CURATED_SKILLS[0];
    activeSlug = slug;

    if (animate) {
      extractBtn.classList.add('loading');
      outputPanel.style.opacity = '0.5';
    }

    const prompts = await loadPrompts();
    const prompt = prompts[slug] || `# ${item.name}\n\n${item.description}`;

    const paint = () => {
      input.value = item.command;
      isPresetValue = true;
      outputBadge.textContent = item.badge.toUpperCase();
      outputSkillName.textContent = item.name;
      const tok = item.tokenEstimate || Math.round(prompt.length / 4);
      outputTokens.textContent = `~${tok.toLocaleString()} tokens`;
      outputCode.textContent = prompt;

      extractBtn.classList.remove('loading');
      outputPanel.style.opacity = '1';
      outputPanel.hidden = false;
    };

    if (animate) setTimeout(paint, 200);
    else paint();
  }

  renderHeroSkill('copywriting', false);
  if (tabsRoot) window.basecoat?.refresh(tabsRoot);

  if (tablist) {
    tablist.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab?.dataset.skill) renderHeroSkill(tab.dataset.skill, true);
    });
    tablist.addEventListener('keydown', () => {
      requestAnimationFrame(() => {
        const selected = tablist.querySelector('[role="tab"][aria-selected="true"]');
        if (selected?.dataset.skill && selected.dataset.skill !== activeSlug) {
          renderHeroSkill(selected.dataset.skill, true);
        }
      });
    });
  }

  function clearPresetInput() {
    if (isPresetValue || CURATED_SKILLS.some(s => s.command === input.value.trim())) {
      input.value = '';
      isPresetValue = false;
    }
  }

  input.addEventListener('click', clearPresetInput);
  input.addEventListener('focus', clearPresetInput);
  input.addEventListener('input', () => {
    isPresetValue = false;
  });

  function redirectToEngine(val) {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      showToast('Please enter a GitHub repository or skills command', 'info');
      return;
    }
    const targetUrl = new URL('/app/', window.location.origin);
    targetUrl.searchParams.set('extract', trimmed);
    window.location.href = targetUrl.toString();
  }

  extractBtn.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToEngine(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      redirectToEngine(input.value);
    }
  });

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', async () => {
      const prompts = await loadPrompts();
      const promptText = prompts[activeSlug] || outputCode.textContent;
      navigator.clipboard.writeText(promptText).then(() => {
        copyPromptBtn.classList.add('is-copied');
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => copyPromptBtn.classList.remove('is-copied'), 1600);
        showToast('Copied prompt! Ready to paste into Claude, ChatGPT, or Cursor.', 'success');
      }).catch(() => {
        showToast('Copy failed, please select and copy manually.', 'error');
      });
    });
  }
}
