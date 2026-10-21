// First-run onboarding: four short questions on the left, a live preview of the
// workbench on the right that fills in as they are answered.
import { CURATED_SKILLS } from '../services/curatedSkills.js';
import { getCategoryKey, escapeHtml, skillsForInterests } from '../services/skillCategories.js';
import { icon } from './icons.js';
import { getPrefs, savePrefs, TOOL_FORMATS, FORMAT_LABELS } from './prefs.js';

const PREVIEW_ROWS = 7;

export function createOnboarding({ onFinish } = {}) {
  const root = document.getElementById('onboarding');
  if (!root) return { open() {}, close() {} };

  const form = root.querySelector('#ob-form');
  const steps = [...root.querySelectorAll('.ob-step')];
  const backBtn = root.querySelector('#ob-back');
  const continueBtn = root.querySelector('#ob-continue');
  const skipBtn = root.querySelector('#ob-skip');
  const progress = root.querySelector('#ob-progress');
  const progressBar = root.querySelector('#ob-progress-bar');
  const stepCount = root.querySelector('#ob-step-count');
  const nameInput = root.querySelector('#ob-name');
  const previewName = root.querySelector('#ob-preview-name');
  const previewFormat = root.querySelector('#ob-preview-format');
  const previewBody = root.querySelector('#ob-preview-body');

  let step = 0;
  let draft = getPrefs();
  let lastFocus = null;

  function syncControls() {
    nameInput.value = draft.libraryName || '';
    root.querySelectorAll('[data-ob-field="tool"] [role="radio"]').forEach((tile) => {
      tile.setAttribute('aria-checked', String(tile.dataset.value === draft.tool));
    });
    root.querySelectorAll('[data-ob-field="layout"] [role="radio"]').forEach((tile) => {
      tile.setAttribute('aria-checked', String(tile.dataset.value === draft.galleryLayout));
    });
    root.querySelectorAll('[data-ob-field="interests"] [aria-pressed]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(draft.interests.includes(chip.dataset.value)));
    });
  }

  function renderPreviewHead() {
    previewName.textContent = draft.libraryName.trim() || 'My skill library';
    previewFormat.textContent = FORMAT_LABELS[TOOL_FORMATS[draft.tool]] || '.skill.md';
  }

  function renderPreviewRows() {
    const layout = step >= 3 ? draft.galleryLayout : 'list';
    previewBody.dataset.layout = layout;

    const picks = skillsForInterests(CURATED_SKILLS, draft.interests).slice(0, 4);
    const rows = picks.map((skill, i) => `
      <div class="ob-row" data-category="${getCategoryKey(skill.category)}" style="animation-delay: ${i * 70}ms">
        <span class="ob-row-check">${icon('check', { size: 13, strokeWidth: 3 })}</span>
        <span class="ob-row-name">${escapeHtml(skill.name)}</span>
        <span class="ob-row-meta">~${(skill.tokenEstimate || 0).toLocaleString()} tokens</span>
      </div>`);
    while (rows.length < PREVIEW_ROWS) rows.push('<div class="ob-row ob-row-ghost"></div>');

    if (layout === 'timeline') {
      rows.splice(0, 0, '<div class="ob-day">Today</div>');
      rows.splice(3, 0, '<div class="ob-day">Yesterday</div>');
    }
    previewBody.innerHTML = rows.join('');
  }

  function render() {
    steps.forEach((el, i) => { el.hidden = i !== step; });
    const total = steps.length;
    progressBar.style.width = `${((step + 1) / total) * 100}%`;
    progress.setAttribute('aria-valuenow', String(step + 1));
    stepCount.textContent = `${step + 1} of ${total}`;
    backBtn.disabled = step === 0;
    continueBtn.textContent = step === total - 1 ? 'Open my workbench' : 'Continue';
    renderPreviewHead();
    renderPreviewRows();
    steps[step].querySelector('input, [role="radio"], [aria-pressed]')?.focus({ preventScroll: true });
  }

  function open(startStep = 0) {
    draft = getPrefs();
    step = Math.min(Math.max(startStep, 0), steps.length - 1);
    lastFocus = document.activeElement;
    syncControls();
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
  }

  function close() {
    root.hidden = true;
    document.body.style.overflow = '';
    lastFocus?.focus?.({ preventScroll: true });
  }

  function finish(skipped) {
    const prefs = skipped
      ? savePrefs({ onboarded: true })
      : savePrefs({ ...draft, libraryName: draft.libraryName.trim(), onboarded: true, personalized: true });
    close();
    onFinish?.(prefs, { skipped });
  }

  // Single-choice tiles (AI tool, gallery layout).
  root.querySelectorAll('[role="radiogroup"][data-ob-field]').forEach((group) => {
    const field = group.dataset.obField === 'layout' ? 'galleryLayout' : group.dataset.obField;
    group.addEventListener('click', (e) => {
      const tile = e.target.closest('[role="radio"]');
      if (!tile) return;
      draft[field] = tile.dataset.value;
      group.querySelectorAll('[role="radio"]').forEach((t) => t.setAttribute('aria-checked', String(t === tile)));
      if (field === 'tool') renderPreviewHead();
      else renderPreviewRows();
    });
  });

  // Multi-choice interest chips.
  root.querySelector('[data-ob-field="interests"]')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[aria-pressed]');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(on));
    const value = chip.dataset.value;
    draft.interests = on ? [...draft.interests, value] : draft.interests.filter((v) => v !== value);
    renderPreviewRows();
  });

  nameInput.addEventListener('input', () => {
    draft.libraryName = nameInput.value;
    renderPreviewHead();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step < steps.length - 1) {
      step += 1;
      render();
    } else {
      finish(false);
    }
  });

  backBtn.addEventListener('click', () => {
    if (step === 0) return;
    step -= 1;
    render();
  });

  skipBtn.addEventListener('click', () => finish(true));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') finish(true);
  });

  return { open, close };
}
