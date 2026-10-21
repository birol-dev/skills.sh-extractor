// skills.sh Extractor - Client-Side WebAssembly Application (Performance Optimized)
import wasmEngine from './services/wasmEngine.js';
import storage from './services/storage.js';
import extractor, { SkillNotFoundError, parseSkillMarkdown, compileSkillContent, sanitizeSlug, parseFrontmatter, extractFallbackDescription } from './services/extractor.js';
import { CURATED_SKILLS } from './services/curatedSkills.js';
import {
  skillChoiceKey,
  filterAvailableSkills,
  toggleSelectionKey,
  selectAllFilteredKeys,
  findGalleryDuplicate,
  formatSelectedCount
} from './services/skillChoiceHelpers.js';
import './ui/basecoat.js';
import { showToast } from './ui/toast.js';
import { icon, hydrateIcons } from './ui/icons.js';
import { getCategoryIcon, getCategoryKey, skillsForInterests } from './services/skillCategories.js';
import { getPrefs, savePrefs, GALLERY_LAYOUTS, TOOL_FORMATS } from './ui/prefs.js';
import { createOnboarding } from './ui/onboarding.js';

// Pre-compute normalized search indices for curated skills (instantaneous O(1) searches)
const CURATED_SEARCH_INDEX = CURATED_SKILLS.map(s => ({
  skill: s,
  normName: s.name.toLowerCase(),
  normSlug: s.slug.toLowerCase(),
  normCat: s.category.toLowerCase(),
  normDesc: s.description.toLowerCase(),
  normTags: (s.tags || []).join(' ').toLowerCase()
}));

// Application State
let currentSkills = [];
let activeFilterTag = 'all';
let selectedSkill = null;
let currentModalFormat = 'skill.md';
let selectedFolderFiles = [];
let pendingSkillChoice = null; // { mode, input?, zipFile?, files?, available, owner, repo, requested }
let skillChoiceSelectedKeys = [];
let skillChoiceFocusIndex = 0;
let skillChoiceFilterQuery = '';
let skillChoiceBusy = false;
let multiPreviewContext = null; // { keys: string[], index: number, ctx: object }

// Lazy-loaded dependencies
let _marked = null;
async function parseMarkdown(text) {
  if (!_marked) {
    const mod = await import('marked');
    _marked = mod.marked;
  }
  return _marked.parse(text || '');
}

let _prism = null;
async function highlightCodeUnder(container) {
  if (!container) return;
  if (!_prism) {
    try {
      const prismMod = await import('prismjs');
      _prism = prismMod.default || prismMod;
    } catch (e) {
      // Ignore if prism not available
    }
  }
  if (_prism && _prism.highlightAllUnder) {
    _prism.highlightAllUnder(container);
  }
}

// DOM Elements Cache
const views = {
  extract: document.getElementById('view-extract'),
  gallery: document.getElementById('view-gallery'),
  curated: document.getElementById('view-curated'),
  wasm: document.getElementById('view-wasm'),
  settings: document.getElementById('view-settings')
};

const navButtons = {
  extract: document.getElementById('nav-extract'),
  gallery: document.getElementById('nav-gallery'),
  curated: document.getElementById('nav-curated'),
  wasm: document.getElementById('nav-wasm'),
  settings: document.getElementById('nav-settings')
};

const VIEW_TITLES = {
  extract: 'Home',
  gallery: 'Gallery',
  curated: 'Curated skills',
  wasm: 'Engine diagnostics',
  settings: 'Settings'
};

// UI Elements
const badgeSkillCount = document.getElementById('badge-skill-count');
const topbarTitle = document.getElementById('topbar-title');
const welcomeName = document.getElementById('welcome-name');
const sidebarLibraryName = document.getElementById('sidebar-library-name');
const recentsList = document.getElementById('recents-list');
const setupTray = document.getElementById('setup-tray');
const setupSteps = document.getElementById('setup-steps');
const setupProgress = document.getElementById('setup-progress');
const picksGrid = document.getElementById('picks-grid');
const galleryLayoutToggle = document.getElementById('gallery-layout-toggle');
const termLogs = document.getElementById('term-logs');
const btnClearTerm = document.getElementById('btn-clear-term');

// Extract View
const inputGithubCmd = document.getElementById('input-github-cmd');
const btnExtractGithub = document.getElementById('btn-extract-github');
const inputFolderDisplay = document.getElementById('input-folder-display');
const inputFolderFile = document.getElementById('input-folder-file');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnExtractFolder = document.getElementById('btn-extract-folder');
const zipDropzone = document.getElementById('zip-dropzone');
const inputZipFile = document.getElementById('input-zip-file');

// Gallery View
const gallerySearchInput = document.getElementById('gallery-search-input');
const galleryTagBar = document.getElementById('gallery-tag-bar');
const galleryCardsGrid = document.getElementById('gallery-cards-grid');
const galleryEmptyState = document.getElementById('gallery-empty-state');
const btnExportAllZip = document.getElementById('btn-export-all-zip');
const btnGalleryNewExtract = document.getElementById('btn-gallery-new-extract');
const btnEmptyExtract = document.getElementById('btn-empty-extract');

// Curated Hub View
const curatedCardsGrid = document.getElementById('curated-cards-grid');

// WASM Diagnostics View
const btnRunBenchmark = document.getElementById('btn-run-benchmark');
const statWasmSpeedup = document.getElementById('stat-wasm-speedup');
const statWasmMem = document.getElementById('stat-wasm-mem');
const statTotalTokens = document.getElementById('stat-total-tokens');
const benchBarWasm = document.getElementById('bench-bar-wasm');
const benchBarJs = document.getElementById('bench-bar-js');
const benchValWasm = document.getElementById('bench-val-wasm');
const benchValJs = document.getElementById('bench-val-js');
const wasmTestInput = document.getElementById('wasm-test-input');
const wasmTestTokens = document.getElementById('wasm-test-tokens');
const wasmTestHash = document.getElementById('wasm-test-hash');

// Settings View
const settingTags = document.getElementById('setting-tags');
const settingExportFormat = document.getElementById('setting-export-format');
const settingGhToken = document.getElementById('setting-gh-token');
const settingGalleryLayout = document.getElementById('setting-gallery-layout');
const settingLibraryName = document.getElementById('setting-library-name');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnExportBackup = document.getElementById('btn-export-backup');
const btnImportBackup = document.getElementById('btn-import-backup');
const inputImportBackup = document.getElementById('input-import-backup');
const btnClearDb = document.getElementById('btn-clear-db');

// Modal Elements
const previewModal = document.getElementById('preview-modal');
const modalSkillTitle = document.getElementById('modal-skill-title');
const modalSkillSubtitle = document.getElementById('modal-skill-subtitle');
const modalBtnClose = document.getElementById('modal-btn-close');
const modalBtnDone = document.getElementById('modal-btn-done');
const modalBtnCopy = document.getElementById('modal-btn-copy');
const modalBtnDownload = document.getElementById('modal-btn-download');
const modalFormatSelect = document.getElementById('modal-format-select');

const modalRenderedContent = document.getElementById('modal-rendered-content');
const modalMetaGrid = document.getElementById('modal-meta-grid');
const modalScriptSelector = document.getElementById('modal-script-selector');
const modalScriptCode = document.getElementById('modal-script-code');
const modalRefSelector = document.getElementById('modal-ref-selector');
const modalRefContent = document.getElementById('modal-ref-content');
const modalRawSource = document.getElementById('modal-raw-source');
const modalScriptsCount = document.getElementById('modal-scripts-count');
const modalRefsCount = document.getElementById('modal-refs-count');

const skillChoiceModal = document.getElementById('skill-choice-modal');
const skillChoiceList = document.getElementById('skill-choice-list');
const skillChoiceSubtitle = document.getElementById('skill-choice-subtitle');
const skillChoiceStatus = document.getElementById('skill-choice-status');
const skillChoiceHint = document.getElementById('skill-choice-hint');
const skillChoiceClose = document.getElementById('skill-choice-close');
const skillChoiceCancel = document.getElementById('skill-choice-cancel');
const skillChoiceSearch = document.getElementById('skill-choice-search');
const skillChoiceSelectAll = document.getElementById('skill-choice-select-all');
const skillChoiceClear = document.getElementById('skill-choice-clear');
const skillChoiceCount = document.getElementById('skill-choice-count');
const skillChoiceAddGallery = document.getElementById('skill-choice-add-gallery');
const skillChoicePreviewBtn = document.getElementById('skill-choice-preview');
const skillChoiceDownloadMd = document.getElementById('skill-choice-download-md');
const skillChoiceDownloadZip = document.getElementById('skill-choice-download-zip');
const skillChoiceExtractOne = document.getElementById('skill-choice-extract-one');
const previewMultiNav = document.getElementById('preview-multi-nav');
const previewMultiPrev = document.getElementById('preview-multi-prev');
const previewMultiNext = document.getElementById('preview-multi-next');
const previewMultiLabel = document.getElementById('preview-multi-label');

// Skill choice (multi-select + bulk QOL)
function closeSkillChoiceModal() {
  pendingSkillChoice = null;
  skillChoiceSelectedKeys = [];
  skillChoiceFocusIndex = 0;
  skillChoiceFilterQuery = '';
  skillChoiceBusy = false;
  if (skillChoiceSearch) skillChoiceSearch.value = '';
  if (!skillChoiceModal) return;
  if (skillChoiceModal.open) skillChoiceModal.close();
}

function truncateSkillDesc(text, max = 160) {
  if (!text) return '';
  const t = String(text).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function getFilteredAvailableSkills() {
  const available = pendingSkillChoice?.available || [];
  return filterAvailableSkills(available, skillChoiceFilterQuery);
}

function findAvailableByKey(key) {
  const available = pendingSkillChoice?.available || [];
  return available.find((s) => skillChoiceKey(s) === key) || null;
}

function updateSkillChoiceBulkEnabled() {
  const n = skillChoiceSelectedKeys.length;
  const enable = n >= 1 && !skillChoiceBusy;
  [skillChoiceAddGallery, skillChoicePreviewBtn, skillChoiceDownloadMd, skillChoiceDownloadZip].forEach((btn) => {
    if (btn) btn.disabled = !enable;
  });
  if (skillChoiceCount) skillChoiceCount.textContent = formatSelectedCount(n);
  if (skillChoiceExtractOne) {
    const single = (pendingSkillChoice?.available || []).length === 1;
    skillChoiceExtractOne.hidden = !single;
    skillChoiceExtractOne.disabled = skillChoiceBusy;
  }
}

function renderSkillChoiceList() {
  if (!skillChoiceList || !pendingSkillChoice) return;
  const filtered = getFilteredAvailableSkills();
  skillChoiceList.innerHTML = '';

  if (filtered.length === 0) {
    skillChoiceList.innerHTML = '<p class="skill-choice-hint">No skills match this filter.</p>';
    updateSkillChoiceBulkEnabled();
    return;
  }

  if (skillChoiceFocusIndex >= filtered.length) skillChoiceFocusIndex = filtered.length - 1;
  if (skillChoiceFocusIndex < 0) skillChoiceFocusIndex = 0;

  const checkSvg = icon('check', { size: 12, strokeWidth: 3 });

  filtered.forEach((skill, idx) => {
    const key = skillChoiceKey(skill);
    const row = document.createElement('div');
    row.className = 'skill-choice-item';
    row.setAttribute('role', 'option');
    row.setAttribute('data-skill-key', key);
    row.setAttribute('aria-selected', skillChoiceSelectedKeys.includes(key) ? 'true' : 'false');
    row.tabIndex = -1;
    if (skillChoiceSelectedKeys.includes(key)) row.classList.add('is-selected');
    if (idx === skillChoiceFocusIndex) row.classList.add('is-focused');

    const tag = skill.dir || skill.path || '';
    const desc = truncateSkillDesc(skill.description);
    row.innerHTML = `
      <span class="skill-choice-check" aria-hidden="true">${checkSvg}</span>
      <span class="skill-choice-item-body">
        <span class="skill-choice-item-header">
          <span class="skill-choice-item-name">${escapeHtml(skill.name || skill.dir || 'unnamed')}</span>
          ${tag ? `<span class="badge skill-choice-item-meta" data-variant="outline">${escapeHtml(tag)}</span>` : ''}
        </span>
        ${desc ? `<span class="skill-choice-item-desc">${escapeHtml(desc)}</span>` : ''}
      </span>
    `;

    row.addEventListener('click', (e) => {
      e.preventDefault();
      skillChoiceFocusIndex = idx;
      skillChoiceSelectedKeys = toggleSelectionKey(skillChoiceSelectedKeys, key);
      renderSkillChoiceList();
      skillChoiceList?.focus();
    });

    row.addEventListener('dblclick', (e) => {
      e.preventDefault();
      extractSingleFromChoice(key);
    });

    skillChoiceList.appendChild(row);
  });

  updateSkillChoiceBulkEnabled();
}

function openSkillChoiceModal(payload) {
  if (!skillChoiceModal || !skillChoiceList) {
    showToast(payload?.message || 'Multiple skills found — please specify --skill', 'error');
    return;
  }
  pendingSkillChoice = payload;
  skillChoiceSelectedKeys = [];
  skillChoiceFocusIndex = 0;
  skillChoiceFilterQuery = '';
  if (skillChoiceSearch) skillChoiceSearch.value = '';

  const requested = payload.requested;
  const where = payload.owner && payload.repo ? `${payload.owner}/${payload.repo}` : 'this source';
  if (skillChoiceSubtitle) {
    skillChoiceSubtitle.textContent = requested
      ? `"${requested}" isn't in ${where} (or the command didn't resolve).`
      : `${where} has multiple skills — choose which to extract.`;
  }
  if (skillChoiceStatus) {
    skillChoiceStatus.hidden = false;
    if (requested) {
      skillChoiceStatus.textContent = 'Not found';
      skillChoiceStatus.className = 'badge skill-choice-status is-miss';
      skillChoiceStatus.dataset.variant = 'destructive';
    } else {
      skillChoiceStatus.textContent = 'Multiple skills';
      skillChoiceStatus.className = 'badge skill-choice-status is-multi';
      skillChoiceStatus.dataset.variant = 'outline';
    }
  }
  if (skillChoiceHint) {
    skillChoiceHint.textContent = 'Multi-select skills to add, preview, or download. Click a row to toggle; double-click to extract one.';
  }

  const available = payload.available || [];
  if (available.length === 0) {
    skillChoiceList.innerHTML = '<p class="skill-choice-hint">No skills were listed by the extractor.</p>';
    updateSkillChoiceBulkEnabled();
  } else {
    if (available.length === 1) {
      skillChoiceSelectedKeys = [skillChoiceKey(available[0])].filter(Boolean);
    }
    renderSkillChoiceList();
  }

  if (!skillChoiceModal.open) skillChoiceModal.showModal();
  showToast(
    available.length === 1
      ? 'One skill found — use Extract, or multi-select actions.'
      : "Choose one or more skills. Click rows to select; use footer actions for bulk.",
    'info'
  );
  setTimeout(() => skillChoiceSearch?.focus() || skillChoiceList?.focus(), 30);
}

async function extractSkillQuiet(ctx, skillKey) {
  if (ctx.mode === 'github') {
    return extractor.extractFromGitHub({
      input: ctx.input,
      subdirOverride: skillKey,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });
  }
  if (ctx.mode === 'zip' && ctx.zipFile) {
    return extractor.extractFromZip(ctx.zipFile, {
      subdirOverride: skillKey,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });
  }
  if (ctx.mode === 'folder' && ctx.files) {
    return extractor.extractFromFolder(ctx.files, {
      subdirOverride: skillKey,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });
  }
  throw new Error('Unknown extract mode for skill choice');
}

async function ensureSkillExtracted(ctx, skillKey, availableSkill) {
  const existing = findGalleryDuplicate(currentSkills, availableSkill || { name: skillKey }, ctx);
  if (existing?.compiledMarkdown) {
    appendLog(`Using gallery copy for "${skillKey}"`, 'info');
    return existing;
  }
  appendLog(`Extracting skill: ${skillKey}`, 'info');
  const skill = await extractSkillQuiet(ctx, skillKey);
  await loadGallery();
  return skill;
}

async function extractSingleFromChoice(skillKey) {
  const ctx = pendingSkillChoice;
  if (!ctx || !skillKey || skillChoiceBusy) return;
  skillChoiceBusy = true;
  updateSkillChoiceBulkEnabled();
  closeSkillChoiceModal();
  clearMultiPreviewNav();
  try {
    const skill = await extractSkillQuiet(ctx, skillKey);
    showToast(`Successfully extracted "${skill.name}"!`, 'success');
    await loadGallery();
    openPreviewModal(skill);
  } catch (err) {
    appendLog(`Error: ${err.message}`, 'error');
    showToast(`Extraction failed: ${err.message}`, 'error');
  } finally {
    skillChoiceBusy = false;
  }
}

async function rerunExtractWithSkill(ctx, skillKey) {
  await extractSingleFromChoice(skillKey);
}

function handleSkillNotFoundError(err, ctx) {
  if (!(err instanceof SkillNotFoundError) && err?.code !== 'SKILL_NOT_FOUND') return false;
  openSkillChoiceModal({
    ...ctx,
    requested: err.requested ?? null,
    owner: err.owner || ctx.owner || '',
    repo: err.repo || ctx.repo || '',
    available: err.available || []
  });
  appendLog(`Skill choice required: ${err.message}`, 'info');
  return true;
}

async function runGithubExtract(input, subdirOverride = '') {
  btnExtractGithub.disabled = true;
  appendLog(`Starting extraction for: ${input}${subdirOverride ? ` (skill: ${subdirOverride})` : ''}`, 'info');
  try {
    const skill = await extractor.extractFromGitHub({
      input,
      subdirOverride,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });
    showToast(`Successfully extracted "${skill.name}"!`, 'success');
    await loadGallery();
    clearMultiPreviewNav();
    openPreviewModal(skill);
  } catch (err) {
    if (!handleSkillNotFoundError(err, { mode: 'github', input })) {
      appendLog(`Error: ${err.message}`, 'error');
      showToast(`Extraction failed: ${err.message}`, 'error');
    }
  } finally {
    btnExtractGithub.disabled = false;
  }
}

async function runFolderExtract(files, subdirOverride = '') {
  btnExtractFolder.disabled = true;
  appendLog(`Starting local folder extraction${subdirOverride ? ` (skill: ${subdirOverride})` : ''}...`, 'info');
  try {
    const skill = await extractor.extractFromFolder(files, {
      subdirOverride,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });
    showToast(`Successfully compiled "${skill.name}" from local folder!`, 'success');
    await loadGallery();
    clearMultiPreviewNav();
    openPreviewModal(skill);
  } catch (err) {
    if (!handleSkillNotFoundError(err, { mode: 'folder', files })) {
      appendLog(`Error: ${err.message}`, 'error');
      showToast(`Extraction failed: ${err.message}`, 'error');
    }
  } finally {
    btnExtractFolder.disabled = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bulkAddSelectedToGallery() {
  const ctx = pendingSkillChoice;
  if (!ctx || skillChoiceSelectedKeys.length === 0 || skillChoiceBusy) return;
  skillChoiceBusy = true;
  updateSkillChoiceBulkEnabled();
  const keys = skillChoiceSelectedKeys.slice();
  let added = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const avail = findAvailableByKey(key);
      showToast(`${i + 1}/${keys.length}…`, 'info');
      appendLog(`Bulk add ${i + 1}/${keys.length}: ${key}`, 'progress');
      const dup = findGalleryDuplicate(currentSkills, avail || { name: key }, ctx);
      if (dup) {
        skipped += 1;
        appendLog(`Skip duplicate: ${key} (already in gallery)`, 'info');
        continue;
      }
      try {
        await extractSkillQuiet(ctx, key);
        added += 1;
        await loadGallery();
      } catch (err) {
        failed += 1;
        appendLog(`Failed ${key}: ${err.message}`, 'error');
      }
    }
    await loadGallery();
    const parts = [`Added ${added}`];
    if (skipped) parts.push(`skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`);
    if (failed) parts.push(`${failed} failed`);
    showToast(parts.join(', '), failed ? 'error' : 'success');
  } finally {
    skillChoiceBusy = false;
    updateSkillChoiceBulkEnabled();
  }
}

function clearMultiPreviewNav() {
  multiPreviewContext = null;
  if (previewMultiNav) previewMultiNav.hidden = true;
}

function updateMultiPreviewNav() {
  if (!previewMultiNav || !multiPreviewContext) {
    if (previewMultiNav) previewMultiNav.hidden = true;
    return;
  }
  const { keys, index } = multiPreviewContext;
  previewMultiNav.hidden = keys.length < 2;
  if (previewMultiLabel) previewMultiLabel.textContent = `${index + 1} / ${keys.length}`;
  if (previewMultiPrev) previewMultiPrev.disabled = index <= 0 || skillChoiceBusy;
  if (previewMultiNext) previewMultiNext.disabled = index >= keys.length - 1 || skillChoiceBusy;
}

async function openMultiPreviewAt(index) {
  if (!multiPreviewContext) return;
  const ctx = multiPreviewContext.ctx || pendingSkillChoice;
  if (!ctx) return;
  const keys = multiPreviewContext.keys;
  if (index < 0 || index >= keys.length) return;
  const key = keys[index];
  const avail = (ctx.available || pendingSkillChoice?.available || []).find((s) => skillChoiceKey(s) === key)
    || findAvailableByKey(key);
  skillChoiceBusy = true;
  updateMultiPreviewNav();
  try {
    const skill = await ensureSkillExtracted(ctx, key, avail);
    multiPreviewContext = { keys, index, ctx };
    openPreviewModal(skill);
    updateMultiPreviewNav();
  } catch (err) {
    appendLog(`Preview failed for ${key}: ${err.message}`, 'error');
    showToast(`Preview failed: ${err.message}`, 'error');
  } finally {
    skillChoiceBusy = false;
    updateMultiPreviewNav();
  }
}

async function bulkPreviewSelected() {
  const ctx = pendingSkillChoice;
  if (!ctx || skillChoiceSelectedKeys.length === 0 || skillChoiceBusy) return;
  multiPreviewContext = { keys: skillChoiceSelectedKeys.slice(), index: 0, ctx };
  await openMultiPreviewAt(0);
}

async function bulkDownloadSelectedMd() {
  const ctx = pendingSkillChoice;
  if (!ctx || skillChoiceSelectedKeys.length === 0 || skillChoiceBusy) return;
  skillChoiceBusy = true;
  updateSkillChoiceBulkEnabled();
  const keys = skillChoiceSelectedKeys.slice();
  let ok = 0;
  try {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const avail = findAvailableByKey(key);
      showToast(`Download ${i + 1}/${keys.length}…`, 'info');
      try {
        const skill = await ensureSkillExtracted(ctx, key, avail);
        downloadFile(`${skill.slug || 'skill'}.skill.md`, skill.compiledMarkdown || '');
        ok += 1;
        if (i < keys.length - 1) await sleep(280);
      } catch (err) {
        appendLog(`Download failed ${key}: ${err.message}`, 'error');
      }
    }
    showToast(`Downloaded ${ok} .skill.md file${ok === 1 ? '' : 's'}`, ok ? 'success' : 'error');
  } finally {
    skillChoiceBusy = false;
    updateSkillChoiceBulkEnabled();
  }
}

async function bulkDownloadSelectedZip() {
  const ctx = pendingSkillChoice;
  if (!ctx || skillChoiceSelectedKeys.length === 0 || skillChoiceBusy) return;
  skillChoiceBusy = true;
  updateSkillChoiceBulkEnabled();
  const keys = skillChoiceSelectedKeys.slice();
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    let packed = 0;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const avail = findAvailableByKey(key);
      showToast(`ZIP ${i + 1}/${keys.length}…`, 'info');
      appendLog(`Packing ${i + 1}/${keys.length}: ${key}`, 'progress');
      try {
        const skill = await ensureSkillExtracted(ctx, key, avail);
        const fileName = `${skill.slug || 'skill'}.skill.md`;
        zip.file(fileName, skill.compiledMarkdown || '');
        packed += 1;
      } catch (err) {
        appendLog(`ZIP skip ${key}: ${err.message}`, 'error');
      }
    }
    if (packed === 0) {
      showToast('No skills to pack', 'error');
      return;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skills-selected-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${packed} playbooks as ZIP!`, 'success');
  } finally {
    skillChoiceBusy = false;
    updateSkillChoiceBulkEnabled();
  }
}

function handleSkillChoiceKeydown(e) {
  if (!skillChoiceModal?.open) return;
  if (e.target === skillChoiceSearch && e.key !== 'Escape' && e.key !== 'ArrowDown' && e.key !== 'Enter') {
    return;
  }
  const filtered = getFilteredAvailableSkills();
  if (!filtered.length && e.key !== 'Escape') return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeSkillChoiceModal();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    skillChoiceFocusIndex = Math.min(filtered.length - 1, skillChoiceFocusIndex + 1);
    renderSkillChoiceList();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    skillChoiceFocusIndex = Math.max(0, skillChoiceFocusIndex - 1);
    renderSkillChoiceList();
    return;
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    if (e.target === skillChoiceSearch) return;
    e.preventDefault();
    const focused = filtered[skillChoiceFocusIndex];
    if (!focused) return;
    skillChoiceSelectedKeys = toggleSelectionKey(skillChoiceSelectedKeys, skillChoiceKey(focused));
    renderSkillChoiceList();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (skillChoiceSelectedKeys.length > 0) {
      // Extract/open selection (preview first; Next/Prev for remaining)
      bulkPreviewSelected();
      return;
    }
    const focused = filtered[skillChoiceFocusIndex];
    if (focused) extractSingleFromChoice(skillChoiceKey(focused));
  }
}

function setupSkillChoiceUi() {
  if (!skillChoiceModal) return;
  const dismiss = () => closeSkillChoiceModal();
  skillChoiceClose?.addEventListener('click', dismiss);
  skillChoiceCancel?.addEventListener('click', dismiss);
  skillChoiceModal.addEventListener('click', (e) => {
    if (e.target === skillChoiceModal) dismiss();
  });

  skillChoiceSearch?.addEventListener('input', () => {
    skillChoiceFilterQuery = skillChoiceSearch.value || '';
    skillChoiceFocusIndex = 0;
    renderSkillChoiceList();
  });

  skillChoiceSelectAll?.addEventListener('click', () => {
    skillChoiceSelectedKeys = selectAllFilteredKeys(getFilteredAvailableSkills());
    renderSkillChoiceList();
  });

  skillChoiceClear?.addEventListener('click', () => {
    skillChoiceSelectedKeys = [];
    renderSkillChoiceList();
  });

  skillChoiceAddGallery?.addEventListener('click', () => bulkAddSelectedToGallery());
  skillChoicePreviewBtn?.addEventListener('click', () => bulkPreviewSelected());
  skillChoiceDownloadMd?.addEventListener('click', () => bulkDownloadSelectedMd());
  skillChoiceDownloadZip?.addEventListener('click', () => bulkDownloadSelectedZip());

  skillChoiceExtractOne?.addEventListener('click', () => {
    const available = pendingSkillChoice?.available || [];
    if (available.length === 1) {
      extractSingleFromChoice(skillChoiceKey(available[0]));
    }
  });

  document.addEventListener('keydown', handleSkillChoiceKeydown);

  previewMultiPrev?.addEventListener('click', () => {
    if (!multiPreviewContext || multiPreviewContext.index <= 0) return;
    openMultiPreviewAt(multiPreviewContext.index - 1);
  });
  previewMultiNext?.addEventListener('click', () => {
    if (!multiPreviewContext || multiPreviewContext.index >= multiPreviewContext.keys.length - 1) return;
    openMultiPreviewAt(multiPreviewContext.index + 1);
  });
}

// Terminal Logger
function appendLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = 'term-line';
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `
    <span class="term-time">[${time}]</span>
    <span class="term-msg ${type}">${escapeHtml(text)}</span>
  `;
  termLogs.appendChild(line);
  termLogs.scrollTop = termLogs.scrollHeight;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// Strip high-risk markup from rendered skill markdown (untrusted GitHub content).
function sanitizeRenderedHtml(html) {
  return String(html || '')
    .replace(/<(script|iframe|object|embed|link|meta|base|form)(\s|>|\/)/gi, '&lt;$1$2')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

// Navigation Switcher
function switchView(viewName) {
  if (!views[viewName]) viewName = 'extract';
  Object.keys(views).forEach(k => {
    if (views[k]) views[k].classList.remove('active');
    if (navButtons[k]) navButtons[k].classList.remove('active');
  });

  if (views[viewName]) views[viewName].classList.add('active');
  if (navButtons[viewName]) navButtons[viewName].classList.add('active');
  document.querySelectorAll('.rail-btn[data-view-link]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewLink === viewName);
  });
  if (topbarTitle) topbarTitle.textContent = VIEW_TITLES[viewName];
  window.scrollTo({ top: 0 });

  // Keep the view in the URL so /app/#gallery style links land in the right place.
  const hash = viewName === 'extract' ? '' : `#${viewName}`;
  if (window.location.hash !== hash) {
    window.history.replaceState({}, '', window.location.pathname + window.location.search + hash);
  }

  if (viewName === 'gallery') loadGallery();
  if (viewName === 'curated') renderCuratedHub();
  if (viewName === 'wasm') updateWasmStats();
  if (viewName === 'settings') loadSettingsForm();
}

// Tab Switcher for Extraction Input
function setupInputTabs() {
  const root = document.querySelector('.input-tabs');
  if (root) window.basecoat?.refresh(root);
}

// Setup Extraction Logic
function setupExtraction() {
  setupAutosuggest();
  setupQuickChips();

  btnExtractGithub.addEventListener('click', async () => {
    const input = inputGithubCmd.value.trim();
    if (!input) {
      showToast('Please enter a GitHub URL or NPX command', 'error');
      return;
    }
    await runGithubExtract(input);
  });

  btnSelectFolder.addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const files = [];
        async function readDir(handle, currentPath = '') {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              Object.defineProperty(file, 'webkitRelativePath', {
                value: currentPath ? `${currentPath}/${file.name}` : file.name
              });
              files.push(file);
            } else if (entry.kind === 'directory') {
              await readDir(entry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
            }
          }
        }
        await readDir(dirHandle, dirHandle.name);
        selectedFolderFiles = files;
        inputFolderDisplay.value = `${dirHandle.name} (${files.length} files)`;
        btnExtractFolder.disabled = false;
        appendLog(`Selected directory: ${dirHandle.name} with ${files.length} files`, 'info');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    inputFolderFile.click();
  });

  inputFolderFile.addEventListener('change', (e) => {
    if (e.target.files?.length > 0) {
      selectedFolderFiles = Array.from(e.target.files);
      const rootFolder = selectedFolderFiles[0].webkitRelativePath.split('/')[0] || 'Selected Folder';
      inputFolderDisplay.value = `${rootFolder} (${selectedFolderFiles.length} files)`;
      btnExtractFolder.disabled = false;
      appendLog(`Selected local directory: ${rootFolder} (${selectedFolderFiles.length} files)`, 'info');
    }
  });

  btnExtractFolder.addEventListener('click', async () => {
    if (!selectedFolderFiles || selectedFolderFiles.length === 0) {
      showToast('Please select a local directory first', 'error');
      return;
    }
    await runFolderExtract(selectedFolderFiles);
  });

  zipDropzone.addEventListener('click', () => inputZipFile.click());

  zipDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zipDropzone.classList.add('dragover');
  });

  zipDropzone.addEventListener('dragleave', () => {
    zipDropzone.classList.remove('dragover');
  });

  zipDropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zipDropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      handleZipFile(file);
    } else {
      showToast('Please drop a valid .zip file', 'error');
    }
  });

  inputZipFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleZipFile(file);
  });

  btnClearTerm.addEventListener('click', () => {
    termLogs.innerHTML = '';
    appendLog('Console logs cleared.', 'info');
  });
}

async function handleZipFile(file, subdirOverride = '') {
  appendLog(`Unpacking zip archive: ${file.name}${subdirOverride ? ` (skill: ${subdirOverride})` : ''}...`, 'info');
  try {
    const skill = await extractor.extractFromZip(file, {
      subdirOverride,
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });

    showToast(`Successfully extracted "${skill.name}" from ZIP!`, 'success');
    await loadGallery();
    clearMultiPreviewNav();
    openPreviewModal(skill);
  } catch (err) {
    if (!handleSkillNotFoundError(err, { mode: 'zip', zipFile: file })) {
      appendLog(`Zip extraction error: ${err.message}`, 'error');
      showToast(`Failed to extract ZIP: ${err.message}`, 'error');
    }
  }
}

// Setup Gallery & Card Rendering (Event Delegation & Fragment Batched)
async function loadGallery() {
  currentSkills = await storage.getSkills();

  // Auto-heal any broken/corrupted skills in storage (e.g. named 'root', missing descriptions, or frontmatter leaked into directives)
  let updatedAny = false;
  for (const skill of currentSkills) {
    const isCorruptedName = !skill.name || skill.name.toLowerCase() === 'root' || skill.name === 'untitled-skill';
    const isCorruptedDesc = !skill.description || skill.description === 'No description provided';
    const hasLeakedFrontmatter = typeof skill.directives === 'string' && /^\s*(?:---\s*[\r\n]+|name:\s*)/i.test(skill.directives.trim());

    if (isCorruptedName || isCorruptedDesc || hasLeakedFrontmatter) {
      const sourceToParse = skill.compiledMarkdown || skill.directives || '';
      const parsed = parseFrontmatter(sourceToParse);

      let newName = parsed.frontmatter.name;
      if (!newName || newName.toLowerCase() === 'root' || newName === 'untitled-skill') {
        const headingMatch = (parsed.directives || skill.directives || '').match(/^#\s+([^\r\n]+)/m);
        if (headingMatch) {
          newName = headingMatch[1].trim();
        } else if (skill.sourcePath) {
          const parts = skill.sourcePath.split('/');
          const folder = parts.length > 1 ? parts[parts.length - 2] : '';
          if (folder && folder.toLowerCase() !== 'root') newName = folder;
        } else if (skill.sourceUrl && skill.sourceUrl.includes('github.com')) {
          const repo = skill.sourceUrl.split('/').pop() || '';
          if (repo) newName = repo;
        }
      }
      if (!newName || newName.toLowerCase() === 'root') {
        newName = skill.name && skill.name.toLowerCase() !== 'root' ? skill.name : 'Untitled Skill';
      }

      let newDesc = parsed.frontmatter.description;
      if (!newDesc || newDesc === 'No description provided') {
        const extracted = extractFallbackDescription(parsed.directives || skill.directives || '');
        newDesc = extracted !== 'No description provided' ? extracted : skill.description;
      }

      if (newName !== skill.name || newDesc !== skill.description || hasLeakedFrontmatter) {
        skill.name = newName;
        skill.slug = sanitizeSlug(newName);
        skill.description = newDesc || 'No description provided';
        if (parsed.directives) {
          skill.directives = parsed.directives;
        }
        if (Object.keys(parsed.frontmatter).length > 0) {
          skill.metadata = { ...(skill.metadata || {}), ...parsed.frontmatter, name: newName, description: skill.description };
        }
        const recompiled = compileSkillContent({
          name: skill.name,
          description: skill.description,
          frontmatter: skill.metadata,
          directives: skill.directives,
          scripts: skill.scripts || [],
          references: skill.references || [],
          customTags: (skill.tags || []).join(', ')
        });
        skill.compiledMarkdown = recompiled.output;
        await storage.saveSkill(skill);
        updatedAny = true;
      }
    }
  }

  if (updatedAny) {
    currentSkills = await storage.getSkills(true);
  }

  badgeSkillCount.innerText = currentSkills.length;
  renderTagFilterBar();
  renderGalleryCards();
  renderRecents();
  renderPicks();
  renderSetupTray();
}

// Curated catalog entry for a stored skill, used to colour it by category.
function curatedMatch(skill) {
  return CURATED_SKILLS.find(c => c.slug === skill.slug || c.name === skill.name);
}

function renderRecents() {
  if (!recentsList) return;
  const recent = [...currentSkills]
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 8);

  if (recent.length === 0) {
    recentsList.innerHTML = '<p class="recents-empty">Skills you extract show up here.</p>';
    return;
  }

  recentsList.innerHTML = recent.map(skill => {
    const cat = getCategoryKey(curatedMatch(skill)?.category);
    return `
      <button type="button" class="recent-item" data-recent-id="${escapeHtml(skill.id)}" data-category="${cat}" title="${escapeHtml(skill.name)}">
        <span class="recent-dot"></span>
        <span class="recent-name">${escapeHtml(skill.name)}</span>
      </button>
    `;
  }).join('');
}

// Home suggestions: curated skills from the interests picked during onboarding.
function renderPicks() {
  if (!picksGrid) return;
  const { interests } = getPrefs();
  let picks = skillsForInterests(CURATED_SKILLS, interests);
  if (picks.length === 0) {
    // No interests yet: one skill per craft gives a varied first look.
    const seen = new Set();
    picks = CURATED_SKILLS.filter(s => {
      const key = getCategoryKey(s.category);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const saved = new Set(currentSkills.map(s => s.slug));
  picksGrid.innerHTML = picks.slice(0, 6).map(skill => {
    const inGallery = saved.has(skill.slug);
    return `
      <article class="pick-card" data-category="${getCategoryKey(skill.category)}">
        <div class="pick-top">
          <span class="pick-icon">${icon(getCategoryIcon(skill.category), { size: 18 })}</span>
          <span class="pick-cat">${escapeHtml(skill.badge || skill.category)}</span>
        </div>
        <h3 class="pick-title">${escapeHtml(skill.name)}</h3>
        <p class="pick-desc">${escapeHtml(skill.description)}</p>
        <div class="pick-foot">
          <span class="pick-tokens">~${(skill.tokenEstimate || 0).toLocaleString()} tokens</span>
          <button type="button" class="btn" data-size="sm" ${inGallery ? 'data-variant="outline"' : ''} data-pick-cmd="${escapeHtml(skill.command)}">
            ${inGallery ? 'Extract again' : 'Extract'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

const SETUP_STEPS = [
  {
    id: 'personalize',
    icon: 'sparkles',
    color: '#b57bff',
    title: 'Personalize your workbench',
    sub: () => 'Name, AI tool and interests',
    done: (ctx) => ctx.prefs.personalized
  },
  {
    id: 'first',
    icon: 'download',
    color: '#4da3ff',
    title: 'Extract your first skill',
    sub: () => 'Paste a repo or pick one below',
    done: (ctx) => ctx.count >= 1
  },
  {
    id: 'three',
    icon: 'library',
    color: '#3ddc97',
    title: 'Save three skills',
    sub: (ctx) => `${Math.min(ctx.count, 3)} of 3 in your gallery`,
    done: (ctx) => ctx.count >= 3
  },
  {
    id: 'token',
    icon: 'key-round',
    color: '#ffc53d',
    title: 'Add a GitHub token',
    sub: () => 'Optional. Lifts the API rate limit',
    done: (ctx) => ctx.hasToken
  }
];

async function renderSetupTray() {
  if (!setupTray || !setupSteps) return;
  const prefs = getPrefs();
  const settings = await storage.getSettings();
  const ctx = { prefs, count: currentSkills.length, hasToken: Boolean(settings.githubToken) };
  const doneCount = SETUP_STEPS.filter(step => step.done(ctx)).length;

  setupTray.hidden = prefs.setupHidden || doneCount === SETUP_STEPS.length;
  if (setupTray.hidden) return;

  setupProgress.textContent = `${doneCount}/${SETUP_STEPS.length}`;
  setupSteps.innerHTML = SETUP_STEPS.map(step => {
    const done = step.done(ctx);
    return `
      <button type="button" class="setup-step${done ? ' is-done' : ''}" data-setup-step="${step.id}" style="--step: ${step.color}" ${done ? 'aria-disabled="true"' : ''}>
        <span class="setup-step-icon">${icon(done ? 'check' : step.icon, { size: 16 })}</span>
        <span class="setup-step-title">${step.title}</span>
        <span class="setup-step-sub">${done ? 'Done' : step.sub(ctx)}</span>
      </button>
    `;
  }).join('');
}

function runSetupStep(id) {
  if (id === 'personalize') onboarding.open();
  if (id === 'first') {
    switchView('extract');
    inputGithubCmd.focus();
  }
  if (id === 'three') switchView('curated');
  if (id === 'token') {
    switchView('settings');
    openSettingsPanel('github');
    settingGhToken.focus();
  }
}

// Library name, gallery layout and suggestions follow the saved prefs.
function applyPrefs() {
  const prefs = getPrefs();
  const name = prefs.libraryName.trim();
  if (welcomeName) welcomeName.textContent = name || 'your workbench';
  if (sidebarLibraryName) sidebarLibraryName.textContent = name || 'My skill library';
  setGalleryLayout(prefs.galleryLayout, { save: false });
  renderPicks();
  renderSetupTray();
}

function setGalleryLayout(layout, { save = true } = {}) {
  if (!GALLERY_LAYOUTS.includes(layout)) layout = 'cards';
  if (save) savePrefs({ galleryLayout: layout });
  galleryLayoutToggle?.querySelectorAll('[data-layout]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.layout === layout));
  });
  if (settingGalleryLayout) settingGalleryLayout.value = layout;
  galleryCardsGrid.dataset.layout = layout;
  renderGalleryCards();
}

function openSettingsPanel(name) {
  document.querySelectorAll('[data-settings-tab]').forEach(tab => {
    const active = tab.dataset.settingsTab === name;
    tab.classList.toggle('active', active);
    if (active) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  document.querySelectorAll('[data-settings-panel]').forEach(panel => {
    panel.hidden = panel.dataset.settingsPanel !== name;
  });
}

const onboarding = createOnboarding({
  onFinish: async (prefs, { skipped }) => {
    if (!skipped && TOOL_FORMATS[prefs.tool]) {
      await storage.saveSettings({ defaultExportFormat: TOOL_FORMATS[prefs.tool] });
    }
    applyPrefs();
    if (!skipped) showToast(`${prefs.libraryName.trim() || 'Your workbench'} is ready`, 'success');
  }
});

function renderTagFilterBar() {
  const allTags = new Set();
  currentSkills.forEach(s => {
    if (s.tags && Array.isArray(s.tags)) {
      s.tags.forEach(t => allTags.add(t));
    }
  });

  galleryTagBar.innerHTML = `
    <button class="btn" data-variant="outline" data-size="sm" aria-pressed="${activeFilterTag === 'all'}" data-tag="all">All (${currentSkills.length})</button>
  `;

  Array.from(allTags).sort().forEach(tag => {
    const count = currentSkills.filter(s => s.tags?.includes(tag)).length;
    const pill = document.createElement('button');
    pill.className = 'btn';
    pill.dataset.variant = 'outline';
    pill.dataset.size = 'sm';
    pill.setAttribute('aria-pressed', String(activeFilterTag === tag));
    pill.setAttribute('data-tag', tag);
    pill.innerText = `${tag} (${count})`;
    galleryTagBar.appendChild(pill);
  });
}

// Single Event Delegation for Gallery Grid
function setupGalleryDelegation() {
  if (!galleryCardsGrid || galleryCardsGrid.dataset.delegated) return;
  galleryCardsGrid.dataset.delegated = 'true';

  galleryTagBar.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-tag]');
    if (!pill) return;
    activeFilterTag = pill.getAttribute('data-tag') || 'all';
    galleryTagBar.querySelectorAll('[data-tag]').forEach(p => {
      p.setAttribute('aria-pressed', String(p.getAttribute('data-tag') === activeFilterTag));
    });
    renderGalleryCards();
  });

  galleryCardsGrid.addEventListener('click', async (e) => {
    if (e.target.closest('[data-clear-gallery-filters]')) {
      gallerySearchInput.value = '';
      activeFilterTag = 'all';
      renderTagFilterBar();
      renderGalleryCards();
      return;
    }

    const card = e.target.closest('.skill-card');
    if (!card) return;
    const skillId = card.getAttribute('data-skill-id');
    const skill = currentSkills.find(s => s.id === skillId);
    if (!skill) return;

    if (e.target.closest('.btn-card-preview')) {
      openPreviewModal(skill);
      return;
    }

    if (e.target.closest('.btn-card-copy')) {
      await navigator.clipboard.writeText(skill.compiledMarkdown);
      showToast(`Copied "${skill.name}" playbook to clipboard!`, 'success');
      return;
    }

    if (e.target.closest('.btn-card-download')) {
      downloadFile(`${skill.slug || 'skill'}.skill.md`, skill.compiledMarkdown);
      showToast(`Downloaded ${skill.name}.skill.md`, 'success');
      return;
    }

    if (e.target.closest('.btn-card-delete')) {
      if (confirm(`Delete skill playbook "${skill.name}"?`)) {
        await storage.deleteSkill(skill.id);
        showToast('Skill deleted', 'info');
        loadGallery();
      }
      return;
    }
  });

  galleryCardsGrid.addEventListener('dragstart', (e) => {
    const dragHandle = e.target.closest('.drag-export-handle');
    if (!dragHandle) return;
    const card = dragHandle.closest('.skill-card');
    if (!card) return;
    const skill = currentSkills.find(s => s.id === card.getAttribute('data-skill-id'));
    if (!skill) return;

    const fileName = `${skill.slug || 'skill'}.skill.md`;
    const blob = new Blob([skill.compiledMarkdown], { type: 'text/markdown' });
    const fileUrl = URL.createObjectURL(blob);
    e.dataTransfer.setData('DownloadURL', `text/markdown:${fileName}:${fileUrl}`);
    e.dataTransfer.setData('text/plain', skill.compiledMarkdown);
  });
}

function renderGalleryCards() {
  const query = (gallerySearchInput.value || '').toLowerCase().trim();
  galleryCardsGrid.innerHTML = '';

  let filtered = currentSkills;
  if (activeFilterTag !== 'all') {
    filtered = filtered.filter(s => s.tags?.includes(activeFilterTag));
  }

  if (query) {
    filtered = filtered.filter(s => {
      const name = (s.name || '').toLowerCase();
      const desc = (s.description || '').toLowerCase();
      const tags = (s.tags || []).join(' ').toLowerCase();
      return name.includes(query) || desc.includes(query) || tags.includes(query) || wasmEngine.fuzzyMatch(query, name) > 400;
    });
  }

  // Day 1: nothing saved yet. The toolbar stays; the empty state explains what goes here.
  galleryEmptyState.hidden = currentSkills.length > 0;
  if (currentSkills.length === 0) return;

  if (filtered.length === 0) {
    const what = query ? `“${escapeHtml(gallerySearchInput.value.trim())}”` : `the tag “${escapeHtml(activeFilterTag)}”`;
    galleryCardsGrid.innerHTML = `
      <div class="no-match">
        <span class="no-match-icon">${icon('search-x', { size: 22 })}</span>
        <h3>No skills match ${what}</h3>
        <p>Try a shorter word or another tag. All ${currentSkills.length} skills are still in your gallery.</p>
        <button type="button" class="btn" data-variant="outline" data-clear-gallery-filters>Clear filters</button>
      </div>
    `;
    return;
  }

  const layout = galleryCardsGrid.dataset.layout || 'cards';
  if (layout === 'timeline') {
    filtered = [...filtered].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  const fragment = document.createDocumentFragment();
  let lastDay = null;

  filtered.forEach(skill => {
    if (layout === 'timeline') {
      const day = new Date(skill.dateAdded).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        const header = document.createElement('div');
        header.className = 'timeline-day';
        header.innerHTML = `<strong>${escapeHtml(formatDayLabel(skill.dateAdded))}</strong>`;
        fragment.appendChild(header);
      }
    }

    const card = document.createElement('div');
    card.className = 'skill-card';
    card.setAttribute('data-skill-id', skill.id);
    const sizeKb = ((skill.sizeBytes || 0) / 1024).toFixed(1);
    const dateStr = new Date(skill.dateAdded).toLocaleDateString();
    const tokenEst = (skill.tokenEstimate || wasmEngine.estimateTokens(skill.compiledMarkdown || '')).toLocaleString();
    const scriptsCount = skill.scripts?.length || 0;
    const refsCount = skill.references?.length || 0;

    card.innerHTML = `
      <div class="card-head">
        <div class="card-title-group">
          <span class="badge card-badge" data-variant="outline">${escapeHtml(skill.sourceType || 'skill')}</span>
          <h3 class="card-title" title="${escapeHtml(skill.name)}">${escapeHtml(skill.name)}</h3>
        </div>
        <div class="drag-export-handle" title="Drag to export .skill.md directly to desktop / editor" draggable="true">
          ${icon('grip-vertical', { size: 14 })}
        </div>
      </div>

      <p class="card-desc">${escapeHtml(skill.description)}</p>

      <div class="card-meta-row">
        <span class="meta-chip">${icon('zap', { size: 12 })} ~${tokenEst} tokens</span>
        <span class="meta-chip">${icon('package', { size: 12 })} ${sizeKb} KB</span>
        ${scriptsCount > 0 ? `<span class="meta-chip">${icon('wrench', { size: 12 })} ${scriptsCount} scripts</span>` : ''}
        ${refsCount > 0 ? `<span class="meta-chip">${icon('book-open', { size: 12 })} ${refsCount} refs</span>` : ''}
        <span class="meta-chip meta-chip-date">${icon('calendar', { size: 12 })} ${dateStr}</span>
      </div>

      <div class="card-footer-actions">
        <button class="btn btn-card-preview" data-variant="secondary" data-size="sm">
          ${icon('eye', { size: 13, attrs: { 'data-icon': 'inline-start' } })}
          <span>Preview</span>
        </button>
        <button class="btn btn-card-copy" data-variant="outline" data-size="sm">
          ${icon('copy', { size: 13, attrs: { 'data-icon': 'inline-start' } })}
          <span>Copy</span>
        </button>
        <button class="btn btn-card-download" data-variant="outline" data-size="icon-sm" title="Download .skill.md">
          ${icon('download', { size: 13 })}
        </button>
        <button class="btn btn-card-delete" data-variant="destructive" data-size="icon-sm" title="Delete skill">
          ${icon('trash-2', { size: 13 })}
        </button>
      </div>
    `;

    fragment.appendChild(card);
  });

  galleryCardsGrid.appendChild(fragment);
}

function formatDayLabel(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Auto-Suggest Setup (Pre-indexed & Fast)
function setupAutosuggest() {
  const dropdown = document.getElementById('autosuggest-dropdown');
  if (!dropdown || !inputGithubCmd) return;

  function renderSuggestions(query = '') {
    const q = query.trim().toLowerCase();
    let matches = [];

    if (!q) {
      matches = CURATED_SKILLS.slice(0, 7);
    } else {
      matches = CURATED_SEARCH_INDEX.filter(item => {
        return item.normName.includes(q) || item.normSlug.includes(q) || item.normCat.includes(q) || item.normTags.includes(q) || item.normDesc.includes(q);
      }).slice(0, 8).map(item => item.skill);
    }

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(item => {
      const div = document.createElement('div');
      div.className = 'autosuggest-item';
      div.setAttribute('data-cmd', item.command);
      div.setAttribute('data-name', item.name);
      div.innerHTML = `
        <div class="autosuggest-info">
          <div class="autosuggest-name">${escapeHtml(item.name)}</div>
          <div class="autosuggest-sub">${escapeHtml(item.description)}</div>
        </div>
        <span class="badge autosuggest-badge" data-variant="outline">${escapeHtml(item.badge)}</span>
      `;
      fragment.appendChild(div);
    });

    dropdown.innerHTML = '';
    dropdown.appendChild(fragment);
    dropdown.style.display = 'flex';
  }

  let isPresetCmd = true;

  function clearPresetCmd() {
    if (isPresetCmd && (inputGithubCmd.value === "npx skills add https://github.com/rknall/claude-skills --skill 'copywriting'" || CURATED_SKILLS.some(s => s.command === inputGithubCmd.value.trim()))) {
      inputGithubCmd.value = '';
      isPresetCmd = false;
      renderSuggestions('');
    }
  }

  inputGithubCmd.addEventListener('click', clearPresetCmd);

  dropdown.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.autosuggest-item');
    if (!item) return;
    e.preventDefault();
    inputGithubCmd.value = item.getAttribute('data-cmd') || '';
    isPresetCmd = true;
    dropdown.style.display = 'none';
    showToast(`Selected "${item.getAttribute('data-name')}"`, 'info');
  });

  inputGithubCmd.addEventListener('input', () => {
    isPresetCmd = false;
    renderSuggestions(inputGithubCmd.value);
  });

  inputGithubCmd.addEventListener('focus', () => {
    if (!inputGithubCmd.value.startsWith('http') && !inputGithubCmd.value.startsWith('git')) {
      renderSuggestions(inputGithubCmd.value);
    }
  });

  inputGithubCmd.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 200);
  });
}

// Quick Preset Chips Setup
function setupQuickChips() {
  const chips = document.querySelectorAll('.quick-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      const cmd = chip.dataset.skillCmd;
      if (cmd && inputGithubCmd) {
        inputGithubCmd.value = cmd;
        showToast(`Loaded preset: ${chip.textContent.trim()}`, 'info');
      }
    });
  });
}

// Curated Skills Hub with Event Delegation
let activeCuratedCat = 'all';
let curatedSearchQuery = '';

function renderCuratedHub() {
  if (!curatedCardsGrid) return;

  const catButtons = document.querySelectorAll('#curated-category-bar [data-curated-cat]');
  catButtons.forEach(btn => {
    btn.onclick = () => {
      catButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      activeCuratedCat = btn.dataset.curatedCat || 'all';
      filterAndRenderCurated();
    };
  });

  const searchInput = document.getElementById('curated-search-input');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    let searchDebounce = null;
    searchInput.addEventListener('input', (e) => {
      cancelAnimationFrame(searchDebounce);
      searchDebounce = requestAnimationFrame(() => {
        curatedSearchQuery = e.target.value.trim().toLowerCase();
        filterAndRenderCurated();
      });
    });
  }

  if (!curatedCardsGrid.dataset.delegated) {
    curatedCardsGrid.dataset.delegated = 'true';
    curatedCardsGrid.addEventListener('click', (e) => {
      if (e.target.closest('[data-clear-curated]')) {
        const searchInput = document.getElementById('curated-search-input');
        if (searchInput) searchInput.value = '';
        curatedSearchQuery = '';
        activeCuratedCat = 'all';
        document.querySelectorAll('#curated-category-bar [data-curated-cat]').forEach(b => {
          b.setAttribute('aria-pressed', String(b.dataset.curatedCat === 'all'));
        });
        filterAndRenderCurated();
        return;
      }
      const btn = e.target.closest('.btn-curated-extract');
      if (!btn) return;
      const cmd = btn.getAttribute('data-cmd');
      if (cmd) {
        switchView('extract');
        inputGithubCmd.value = cmd;
        btnExtractGithub.click();
      }
    });
  }

  filterAndRenderCurated();
}

function filterAndRenderCurated() {
  if (!curatedCardsGrid) return;
  curatedCardsGrid.innerHTML = '';

  const filtered = CURATED_SEARCH_INDEX.filter(item => {
    const matchesCat = (activeCuratedCat === 'all' || item.skill.category === activeCuratedCat);
    if (!matchesCat) return false;

    if (!curatedSearchQuery) return true;
    return item.normName.includes(curatedSearchQuery) || item.normSlug.includes(curatedSearchQuery) || item.normDesc.includes(curatedSearchQuery) || item.normTags.includes(curatedSearchQuery);
  }).map(item => item.skill);

  if (filtered.length === 0) {
    curatedCardsGrid.innerHTML = `
      <div class="no-match curated-empty">
        <span class="no-match-icon">${icon('search-x', { size: 22 })}</span>
        <h3>No curated skills match${curatedSearchQuery ? ` “${escapeHtml(curatedSearchQuery)}”` : ' this craft'}</h3>
        <p>Try a broader word, or clear the search to see all ${CURATED_SKILLS.length} skills.</p>
        <button type="button" class="btn" data-variant="outline" data-clear-curated>Clear search</button>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'curated-card';
    card.dataset.category = getCategoryKey(item.category);
    card.innerHTML = `
      <div class="curated-header">
        <div class="curated-icon">${icon(getCategoryIcon(item.category), { size: 18 })}</div>
        <span class="badge card-badge" data-variant="outline">${escapeHtml(item.badge)}</span>
      </div>
      <h3 class="curated-title">${escapeHtml(item.name)}</h3>
      <p class="curated-desc">${escapeHtml(item.description)}</p>
      <div class="curated-tags">
        ${(item.tags || []).map(t => `<span class="curated-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="curated-actions">
        <button class="btn btn-curated-extract" data-cmd="${escapeHtml(item.command)}">
          ${icon('play', { size: 14, attrs: { 'data-icon': 'inline-start' } })}
          Extract
        </button>
      </div>
    `;

    fragment.appendChild(card);
  });

  curatedCardsGrid.appendChild(fragment);
}

// Modal Inspector
async function openPreviewModal(skill) {
  selectedSkill = skill;
  currentModalFormat = 'skill.md';
  modalFormatSelect.value = 'skill.md';

  modalSkillTitle.innerText = skill.name;
  const tokenEst = (skill.tokenEstimate || wasmEngine.estimateTokens(skill.compiledMarkdown || '')).toLocaleString();
  modalSkillSubtitle.innerText = `${skill.slug}.skill.md • ~${tokenEst} LLM tokens • ${((skill.sizeBytes || 0) / 1024).toFixed(1)} KB`;

  const parsed = parseSkillMarkdown(skill.compiledMarkdown);

  // 1. Directives Rendered Markdown
  const html = sanitizeRenderedHtml(await parseMarkdown(parsed.directives || skill.directives || 'No directives body provided.'));
  modalRenderedContent.innerHTML = html;
  highlightCodeUnder(modalRenderedContent);

  // 2. Metadata Grid
  modalMetaGrid.innerHTML = '';
  const metaObj = { ...(skill.metadata || {}), ...(parsed.frontmatter || {}) };
  const entries = Object.entries(metaObj).filter(([k, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length > 0) {
    entries.forEach(([k, v]) => {
      let valStr = '';
      if (Array.isArray(v)) {
        valStr = v.join(', ');
      } else if (typeof v === 'object') {
        valStr = JSON.stringify(v);
      } else {
        valStr = String(v);
      }
      modalMetaGrid.innerHTML += `
        <div class="meta-lbl">${escapeHtml(k)}</div>
        <div class="meta-val">${escapeHtml(valStr)}</div>
      `;
    });
  } else {
    modalMetaGrid.innerHTML = '<div class="meta-empty">No frontmatter properties defined.</div>';
  }

  // 3. Helper Scripts
  modalScriptsCount.innerText = parsed.scripts.length;
  modalScriptSelector.innerHTML = '';
  if (parsed.scripts.length > 0) {
    parsed.scripts.forEach((script, idx) => {
      const chip = document.createElement('button');
      chip.className = 'btn script-tab-chip';
      chip.dataset.variant = 'outline';
      chip.dataset.size = 'xs';
      chip.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      chip.innerText = `scripts/${script.fileName}`;
      chip.addEventListener('click', () => {
        modalScriptSelector.querySelectorAll('.script-tab-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        modalScriptCode.innerText = script.code;
      });
      modalScriptSelector.appendChild(chip);
    });
    modalScriptCode.innerText = parsed.scripts[0].code;
  } else {
    modalScriptCode.innerText = 'No helper scripts in this skill package.';
  }

  // 4. References
  modalRefsCount.innerText = parsed.references.length;
  modalRefSelector.innerHTML = '';
  if (parsed.references.length > 0) {
    parsed.references.forEach((ref, idx) => {
      const chip = document.createElement('button');
      chip.className = 'btn script-tab-chip';
      chip.dataset.variant = 'outline';
      chip.dataset.size = 'xs';
      chip.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      chip.innerText = `references/${ref.fileName}`;
      chip.addEventListener('click', async () => {
        modalRefSelector.querySelectorAll('.script-tab-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        modalRefContent.innerHTML = sanitizeRenderedHtml(await parseMarkdown(ref.content));
        highlightCodeUnder(modalRefContent);
      });
      modalRefSelector.appendChild(chip);
    });
    modalRefContent.innerHTML = sanitizeRenderedHtml(await parseMarkdown(parsed.references[0].content));
    highlightCodeUnder(modalRefContent);
  } else {
    modalRefContent.innerHTML = '<p class="meta-empty">No reference documentation attached.</p>';
  }

  // 5. Raw Source
  modalRawSource.innerText = skill.compiledMarkdown;

  const previewTabs = document.querySelector('.preview-tabs');
  if (previewTabs) window.basecoat?.refresh(previewTabs);
  if (!previewModal.open) previewModal.showModal();
  updateMultiPreviewNav();
}

function setupModal() {
  const closeModal = () => {
    if (previewModal.open) previewModal.close();
    clearMultiPreviewNav();
  };
  modalBtnClose.addEventListener('click', closeModal);
  modalBtnDone.addEventListener('click', closeModal);
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closeModal();
  });

  modalFormatSelect.addEventListener('change', () => {
    if (!selectedSkill) return;
    currentModalFormat = modalFormatSelect.value;
    const parsed = parseSkillMarkdown(selectedSkill.compiledMarkdown);
    const { output } = compileSkillContent({
      name: selectedSkill.name,
      description: selectedSkill.description,
      frontmatter: selectedSkill.metadata || {},
      directives: parsed.directives,
      scripts: parsed.scripts,
      references: parsed.references,
      exportFormat: currentModalFormat
    });
    modalRawSource.innerText = output;
    showToast(`Converted preview to ${currentModalFormat}`, 'info');
  });

  modalBtnCopy.addEventListener('click', async () => {
    if (selectedSkill) {
      const content = modalRawSource.innerText || selectedSkill.compiledMarkdown;
      await navigator.clipboard.writeText(content);
      showToast('Playbook copied to clipboard!', 'success');
    }
  });

  modalBtnDownload.addEventListener('click', () => {
    if (selectedSkill) {
      const ext = currentModalFormat === 'claude.md' ? 'CLAUDE.md'
                : currentModalFormat === 'cursorrules' ? '.cursorrules'
                : currentModalFormat === 'windsurfrules' ? '.windsurfrules'
                : `${selectedSkill.slug}.skill.md`;
      const content = modalRawSource.innerText || selectedSkill.compiledMarkdown;
      downloadFile(ext, content);
      showToast(`Downloaded ${ext}`, 'success');
    }
  });
}

// WASM Diagnostics & Benchmark Suite
async function updateWasmStats() {
  await wasmEngine.ready();
  const skills = await storage.getSkills();
  let totalTokens = 0;
  skills.forEach(s => {
    totalTokens += (s.tokenEstimate || wasmEngine.estimateTokens(s.compiledMarkdown || ''));
  });
  if (statTotalTokens) statTotalTokens.innerText = totalTokens.toLocaleString();
  if (statWasmMem) statWasmMem.innerText = `${((wasmEngine.memory?.buffer.byteLength || 65536) / 1024).toFixed(0)} KB`;
}

function setupWasmDiagnostics() {
  btnRunBenchmark.addEventListener('click', () => {
    btnRunBenchmark.disabled = true;
    btnRunBenchmark.innerHTML = `${icon('loader-circle', { className: 'animate-spin', attrs: { 'data-icon': 'inline-start' } })} Benchmarking...`;

    setTimeout(() => {
      const result = wasmEngine.runBenchmark(10000);
      benchValWasm.innerText = `${result.wasmTimeMs} ms (10k Levenshtein ops)`;
      benchValJs.innerText = `${result.jsTimeMs} ms (10k Levenshtein ops)`;
      statWasmSpeedup.innerText = result.speedup;

      const wasmNum = parseFloat(result.wasmTimeMs);
      const jsNum = parseFloat(result.jsTimeMs);
      const maxTime = Math.max(wasmNum, jsNum, 1);

      benchBarWasm.style.width = `${Math.min(100, (wasmNum / maxTime) * 100)}%`;
      benchBarJs.style.width = `${Math.min(100, (jsNum / maxTime) * 100)}%`;

      btnRunBenchmark.disabled = false;
      btnRunBenchmark.innerHTML = `${icon('play', { attrs: { 'data-icon': 'inline-start' } })} Run benchmark (10k ops)`;
      showToast(`Benchmark complete! WebAssembly is ${result.speedup} faster!`, 'success');
    }, 50);
  });

  wasmTestInput.addEventListener('input', () => {
    const text = wasmTestInput.value;
    const tokens = wasmEngine.estimateTokens(text);
    const hash = wasmEngine.hash(text);
    wasmTestTokens.innerText = tokens.toLocaleString();
    wasmTestHash.innerText = hash;
  });
}

// Settings & Backup
async function loadSettingsForm() {
  const cfg = await storage.getSettings();
  settingTags.value = cfg.defaultTags || '';
  settingExportFormat.value = cfg.defaultExportFormat || 'skill.md';
  settingGhToken.value = cfg.githubToken || '';
  const prefs = getPrefs();
  settingGalleryLayout.value = prefs.galleryLayout;
  settingLibraryName.value = prefs.libraryName;
}

function setupSettings() {
  btnSaveSettings.addEventListener('click', async () => {
    await storage.saveSettings({
      defaultTags: settingTags.value.trim(),
      defaultExportFormat: settingExportFormat.value,
      githubToken: settingGhToken.value.trim()
    });
    savePrefs({
      galleryLayout: settingGalleryLayout.value,
      libraryName: settingLibraryName.value.trim()
    });
    applyPrefs();
    showToast('Settings saved', 'success');
  });

  // Every panel has its own Update pill; they all save the whole form.
  document.querySelectorAll('[data-save-settings]').forEach(btn => {
    btn.addEventListener('click', () => btnSaveSettings.click());
  });

  document.querySelectorAll('[data-settings-tab]').forEach(tab => {
    tab.addEventListener('click', () => openSettingsPanel(tab.dataset.settingsTab));
  });

  document.getElementById('btn-rerun-onboarding')?.addEventListener('click', () => onboarding.open());

  btnExportBackup.addEventListener('click', async () => {
    const jsonStr = await storage.exportAllToJson();
    downloadFile(`skills-sh-backup-${new Date().toISOString().slice(0, 10)}.json`, jsonStr);
    showToast('Exported complete database backup!', 'success');
  });

  btnImportBackup.addEventListener('click', () => inputImportBackup.click());
  inputImportBackup.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      const res = await storage.importFromJson(text);
      if (res.success) {
        showToast(`Imported ${res.count} skills from backup!`, 'success');
        loadGallery();
      } else {
        showToast(`Import error: ${res.error}`, 'error');
      }
    }
  });

  btnClearDb.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all extracted skills and configurations?')) {
      await storage.clearAll();
      showToast('All local storage cleared', 'info');
      loadGallery();
    }
  });

  btnExportAllZip.addEventListener('click', async () => {
    const skills = await storage.getSkills();
    if (skills.length === 0) {
      showToast('No skills to export', 'error');
      return;
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    skills.forEach(s => {
      const fileName = `${s.slug || 'skill'}.skill.md`;
      zip.file(fileName, s.compiledMarkdown || '');
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skills-sh-playbooks-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${skills.length} playbooks as ZIP archive!`, 'success');
  });
}

// Global Event Listeners & Boot
document.addEventListener('DOMContentLoaded', async () => {
  hydrateIcons();

  Object.keys(navButtons).forEach(viewName => {
    navButtons[viewName]?.addEventListener('click', () => switchView(viewName));
  });

  btnGalleryNewExtract?.addEventListener('click', () => switchView('extract'));
  btnEmptyExtract?.addEventListener('click', () => {
    switchView('extract');
    inputGithubCmd.focus();
  });

  // Rail buttons, empty-state links and anything else that names a view.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-view-link]');
    if (link) switchView(link.dataset.viewLink);
  });
  window.addEventListener('hashchange', () => switchView(window.location.hash.slice(1) || 'extract'));

  galleryLayoutToggle?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-layout]');
    if (btn) setGalleryLayout(btn.dataset.layout);
  });

  recentsList?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-recent-id]');
    const skill = item && currentSkills.find(s => s.id === item.dataset.recentId);
    if (skill) openPreviewModal(skill);
  });

  picksGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-cmd]');
    if (!btn) return;
    inputGithubCmd.value = btn.dataset.pickCmd;
    document.querySelector('.extract-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btnExtractGithub.click();
  });

  setupSteps?.addEventListener('click', (e) => {
    const step = e.target.closest('[data-setup-step]');
    if (step && step.getAttribute('aria-disabled') !== 'true') runSetupStep(step.dataset.setupStep);
  });

  document.getElementById('btn-hide-setup')?.addEventListener('click', () => {
    savePrefs({ setupHidden: true });
    setupTray.hidden = true;
  });

  document.getElementById('btn-open-onboarding')?.addEventListener('click', () => onboarding.open());
  document.getElementById('btn-personalize-picks')?.addEventListener('click', () => onboarding.open(2));

  document.querySelectorAll('#curated-nav-count, #stat-curated-count').forEach(el => {
    el.textContent = CURATED_SKILLS.length;
  });

  // Gallery live search debounced with requestAnimationFrame
  let searchDebounce = null;
  gallerySearchInput?.addEventListener('input', () => {
    cancelAnimationFrame(searchDebounce);
    searchDebounce = requestAnimationFrame(() => renderGalleryCards());
  });

  setupInputTabs();
  setupExtraction();
  setupSkillChoiceUi();
  setupGalleryDelegation();
  setupModal();
  setupWasmDiagnostics();
  setupSettings();

  applyPrefs();

  await wasmEngine.ready();
  await loadGallery();

  const initialBench = wasmEngine.runBenchmark(1000);
  if (statWasmSpeedup) statWasmSpeedup.innerText = initialBench.speedup;

  const urlParams = new URLSearchParams(window.location.search);
  const inputQuery = urlParams.get('extract') || urlParams.get('url') || urlParams.get('link') || urlParams.get('query') || urlParams.get('cmd') || urlParams.get('skill');

  const initialView = window.location.hash.slice(1);
  if (!inputQuery && views[initialView]) switchView(initialView);

  // First visit: ask four quick questions, unless the visitor arrived to extract something.
  if (!inputQuery && !getPrefs().onboarded) onboarding.open();
  if (inputQuery) {
    let cleanQuery = decodeURIComponent(inputQuery).trim();
    const foundSkill = CURATED_SKILLS.find(s => s.slug === cleanQuery || s.id === cleanQuery || s.name.toLowerCase() === cleanQuery.toLowerCase());
    if (foundSkill) {
      cleanQuery = foundSkill.command;
    }

    if (cleanQuery) {
      switchView('extract');
      const tabBtn = document.getElementById('tab-btn-github');
      if (tabBtn) document.querySelector('.input-tabs')?.select?.(tabBtn);
      if (inputGithubCmd) {
        inputGithubCmd.value = cleanQuery;
        appendLog(`Received skill request: ${cleanQuery}`, 'info');
        setTimeout(() => {
          if (btnExtractGithub && !btnExtractGithub.disabled) {
            btnExtractGithub.click();
          }
        }, 150);
      }
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }
});
