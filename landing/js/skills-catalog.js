import { CURATED_SKILLS } from '../../src/services/curatedSkills.js';
import { showToast } from './toast.js';
import { loadPrompts } from './prompts.js';

const SKILLS_BY_SLUG = new Map(CURATED_SKILLS.map(s => [s.slug, s]));

export function initSkillsCatalog() {
  const tabsRoot = document.querySelector('.catalog-tabs');
  const tablist = document.getElementById('catalogFilters');
  const grid = document.getElementById('skillsGrid');
  const modal = document.getElementById('skillPreviewModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalOpenInAppBtn = document.getElementById('modalOpenInAppBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalCategoryBadge = document.getElementById('modalCategoryBadge');
  const modalDescription = document.getElementById('modalDescription');
  const modalTokens = document.getElementById('modalTokens');
  const modalPromptCode = document.getElementById('modalPromptCode');

  if (!grid) return;

  const cachedCards = grid.querySelectorAll('.skill-card');
  let currentModalSkill = null;

  async function promptFor(slug, fallback) {
    const prompts = await loadPrompts();
    return prompts[slug] || fallback;
  }

  function filterGrid(filterCat = 'all') {
    cachedCards.forEach((card) => {
      const match = filterCat === 'all' || card.dataset.category === filterCat;
      card.hidden = !match;
    });
    grid.hidden = false;
  }

  function selectedCategory() {
    return tablist?.querySelector('[role="tab"][aria-selected="true"]')?.dataset.category || 'all';
  }

  if (tablist) {
    tablist.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      filterGrid(tab.dataset.category || 'all');
    });
    tablist.addEventListener('keydown', () => {
      requestAnimationFrame(() => filterGrid(selectedCategory()));
    });
  }

  if (tabsRoot) window.basecoat?.refresh(tabsRoot);
  filterGrid(selectedCategory());

  async function openModal(slug) {
    const s = SKILLS_BY_SLUG.get(slug);
    if (!s || !modal) return;

    const prompt = await promptFor(slug, `# ${s.name}\n\n${s.description}`);
    const tok = s.tokenEstimate || Math.round(prompt.length / 4);

    currentModalSkill = { ...s, prompt, tok };
    modalTitle.textContent = s.name;
    modalCategoryBadge.textContent = s.badge;
    modalDescription.textContent = s.description;
    modalTokens.textContent = `~${tok.toLocaleString()} tokens`;
    modalPromptCode.textContent = prompt;

    modal.showModal();
  }

  function closeModal() {
    if (!modal?.open) return;
    modal.close();
  }

  grid.addEventListener('click', async (e) => {
    const previewBtn = e.target.closest('[data-preview-id]');
    const copyBtn = e.target.closest('[data-copy-id]');

    if (previewBtn) {
      e.stopPropagation();
      await openModal(previewBtn.dataset.previewId);
      return;
    }

    if (copyBtn) {
      e.stopPropagation();
      const slug = copyBtn.dataset.copyId;
      const s = SKILLS_BY_SLUG.get(slug);
      const prompt = await promptFor(slug, s ? `# ${s.name}\n\n${s.description}` : '');
      navigator.clipboard.writeText(prompt).then(() => {
        showToast(`Copied "${s ? s.name : slug}" prompt!`, 'success');
      });
    }
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (modalOpenInAppBtn) {
    modalOpenInAppBtn.addEventListener('click', () => {
      if (currentModalSkill?.command) {
        const targetUrl = new URL('/app/', window.location.origin);
        targetUrl.searchParams.set('extract', currentModalSkill.command);
        window.location.href = targetUrl.toString();
      }
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      if (currentModalSkill) {
        navigator.clipboard.writeText(currentModalSkill.prompt).then(() => {
          showToast(`Copied "${currentModalSkill.name}" prompt!`, 'success');
          closeModal();
        });
      }
    });
  }
}
