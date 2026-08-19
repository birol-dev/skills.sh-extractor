import { CURATED_SKILLS } from '../../src/services/curatedSkills.js';
import { showToast } from './toast.js';
import { loadPrompts } from './prompts.js';

export function initSkillsCatalog() {
  const tabs = document.querySelectorAll('.catalog-tab');
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

  let currentModalSkill = null;

  async function promptFor(slug, fallback) {
    const prompts = await loadPrompts();
    return prompts[slug] || fallback;
  }

  function filterGrid(filterCat = 'all') {
    const cards = grid.querySelectorAll('.skill-card');
    cards.forEach((card) => {
      const match = filterCat === 'all' || card.dataset.category === filterCat;
      card.hidden = !match;
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterGrid(tab.dataset.category || 'all');
    });
  });

  async function openModal(slug) {
    const s = CURATED_SKILLS.find(item => item.slug === slug);
    if (!s || !modal) return;

    const prompt = await promptFor(slug, `# ${s.name}\n\n${s.description}`);
    const tok = s.tokenEstimate || Math.round(prompt.length / 4);

    currentModalSkill = { ...s, prompt, tok };
    modalTitle.textContent = s.name;
    modalCategoryBadge.textContent = s.badge.toUpperCase();
    modalDescription.textContent = s.description;
    modalTokens.textContent = `~${tok.toLocaleString()} tokens`;
    modalPromptCode.textContent = prompt;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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
      const s = CURATED_SKILLS.find(item => item.slug === slug);
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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
}
