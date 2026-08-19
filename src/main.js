// skills.sh Extractor - Client-Side WebAssembly Application
import { marked } from 'marked';
import JSZip from 'jszip';
import wasmEngine from './services/wasmEngine.js';
import storage from './services/storage.js';
import extractor, { parseSkillMarkdown, compileSkillContent, sanitizeSlug } from './services/extractor.js';
import { CURATED_SKILLS } from './services/curatedSkills.js';

// Application State
let currentSkills = [];
let activeFilterTag = 'all';
let selectedSkill = null;
let currentModalFormat = 'skill.md';
let selectedFolderFiles = [];

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

// UI Elements
const badgeSkillCount = document.getElementById('badge-skill-count');
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

const modalNavButtons = document.querySelectorAll('.modal-nav-btn');
const modalPanes = {
  rendered: document.getElementById('modal-pane-rendered'),
  meta: document.getElementById('modal-pane-meta'),
  scripts: document.getElementById('modal-pane-scripts'),
  refs: document.getElementById('modal-pane-refs'),
  raw: document.getElementById('modal-pane-raw')
};

const modalRenderedContent = document.getElementById('modal-rendered-content');
const modalMetaGrid = document.getElementById('modal-meta-grid');
const modalScriptSelector = document.getElementById('modal-script-selector');
const modalScriptCode = document.getElementById('modal-script-code');
const modalRefSelector = document.getElementById('modal-ref-selector');
const modalRefContent = document.getElementById('modal-ref-content');
const modalRawSource = document.getElementById('modal-raw-source');
const modalScriptsCount = document.getElementById('modal-scripts-count');
const modalRefsCount = document.getElementById('modal-refs-count');

const toastContainer = document.getElementById('toast-container');

// Toast Notification (Crisp Vector Icons, Zero Emojis)
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;

  let iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  if (type === 'success') {
    iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  }

  toast.innerHTML = `<span class="toast-icon">${iconSvg}</span><span class="toast-text">${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
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

// Navigation Switcher
function switchView(viewName) {
  Object.keys(views).forEach(k => {
    if (views[k]) views[k].classList.remove('active');
    if (navButtons[k]) navButtons[k].classList.remove('active');
  });

  if (views[viewName]) views[viewName].classList.add('active');
  if (navButtons[viewName]) navButtons[viewName].classList.add('active');

  if (viewName === 'gallery') loadGallery();
  if (viewName === 'curated') renderCuratedHub();
  if (viewName === 'wasm') updateWasmStats();
  if (viewName === 'settings') loadSettingsForm();
}

// Tab Switcher for Extraction Input
function setupInputTabs() {
  const tabs = [
    { btn: document.getElementById('tab-btn-github'), pane: document.getElementById('pane-input-github') },
    { btn: document.getElementById('tab-btn-folder'), pane: document.getElementById('pane-input-folder') },
    { btn: document.getElementById('tab-btn-zip'), pane: document.getElementById('pane-input-zip') }
  ];

  tabs.forEach(tab => {
    if (!tab.btn) return;
    tab.btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.remove('active');
        t.pane.classList.remove('active');
      });
      tab.btn.classList.add('active');
      tab.pane.classList.add('active');
    });
  });
}

// Setup Extraction Logic
function setupExtraction() {
  // 1. Setup Auto-Suggest and Quick-Pick Presets
  setupAutosuggest();
  setupQuickChips();

  // 2. GitHub / NPX extract
  btnExtractGithub.addEventListener('click', async () => {
    const input = inputGithubCmd.value.trim();
    if (!input) {
      showToast('Please enter a GitHub URL or NPX command', 'error');
      return;
    }

    btnExtractGithub.disabled = true;
    appendLog(`Starting extraction for: ${input}`, 'info');

    try {
      const skill = await extractor.extractFromGitHub({
        input,
        onProgress: (status, pct) => {
          appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
        }
      });

      showToast(`Successfully extracted "${skill.name}"!`, 'success');
      await loadGallery();
      openPreviewModal(skill);
    } catch (err) {
      appendLog(`Error: ${err.message}`, 'error');
      showToast(`Extraction failed: ${err.message}`, 'error');
    } finally {
      btnExtractGithub.disabled = false;
    }
  });

  // 2. Local Folder extract
  btnSelectFolder.addEventListener('click', async () => {
    // Try File System Access API if supported
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const files = [];
        async function readDir(handle, currentPath = '') {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              // Polyfill relative path
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

    // Fallback to standard input file
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

    btnExtractFolder.disabled = true;
    appendLog('Starting local folder extraction...', 'info');

    try {
      const skill = await extractor.extractFromFolder(selectedFolderFiles, {
        onProgress: (status, pct) => {
          appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
        }
      });

      showToast(`Successfully compiled "${skill.name}" from local folder!`, 'success');
      await loadGallery();
      openPreviewModal(skill);
    } catch (err) {
      appendLog(`Error: ${err.message}`, 'error');
      showToast(`Extraction failed: ${err.message}`, 'error');
    } finally {
      btnExtractFolder.disabled = false;
    }
  });

  // 3. ZIP Dropzone extract
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

async function handleZipFile(file) {
  appendLog(`Unpacking zip archive: ${file.name}...`, 'info');
  try {
    const skill = await extractor.extractFromZip(file, {
      onProgress: (status, pct) => {
        appendLog(`${status} (${pct}%)`, pct === 100 ? 'success' : 'progress');
      }
    });

    showToast(`Successfully extracted "${skill.name}" from ZIP!`, 'success');
    await loadGallery();
    openPreviewModal(skill);
  } catch (err) {
    appendLog(`Zip extraction error: ${err.message}`, 'error');
    showToast(`Failed to extract ZIP: ${err.message}`, 'error');
  }
}

// Setup Gallery & Card Rendering
async function loadGallery() {
  currentSkills = await storage.getSkills();
  badgeSkillCount.innerText = currentSkills.length;
  renderTagFilterBar();
  renderGalleryCards();
}

function renderTagFilterBar() {
  const allTags = new Set();
  currentSkills.forEach(s => {
    if (s.tags && Array.isArray(s.tags)) {
      s.tags.forEach(t => allTags.add(t));
    }
  });

  galleryTagBar.innerHTML = `
    <button class="tag-pill ${activeFilterTag === 'all' ? 'active' : ''}" data-tag="all">All (${currentSkills.length})</button>
  `;

  Array.from(allTags).sort().forEach(tag => {
    const count = currentSkills.filter(s => s.tags?.includes(tag)).length;
    const pill = document.createElement('button');
    pill.className = `tag-pill ${activeFilterTag === tag ? 'active' : ''}`;
    pill.setAttribute('data-tag', tag);
    pill.innerText = `${tag} (${count})`;
    pill.addEventListener('click', () => {
      activeFilterTag = tag;
      renderTagFilterBar();
      renderGalleryCards();
    });
    galleryTagBar.appendChild(pill);
  });

  galleryTagBar.querySelector('[data-tag="all"]').addEventListener('click', () => {
    activeFilterTag = 'all';
    renderTagFilterBar();
    renderGalleryCards();
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

  if (filtered.length === 0) {
    galleryEmptyState.style.display = 'flex';
    return;
  }

  galleryEmptyState.style.display = 'none';

  filtered.forEach(skill => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    const sizeKb = ((skill.sizeBytes || 0) / 1024).toFixed(1);
    const dateStr = new Date(skill.dateAdded).toLocaleDateString();
    const tokenEst = (skill.tokenEstimate || wasmEngine.estimateTokens(skill.compiledMarkdown || '')).toLocaleString();
    const scriptsCount = skill.scripts?.length || 0;
    const refsCount = skill.references?.length || 0;

    card.innerHTML = `
      <div class="card-head">
        <div class="card-title-group">
          <div class="card-badge">${escapeHtml(skill.sourceType || 'skill')}</div>
          <h3 class="card-title" title="${escapeHtml(skill.name)}">${escapeHtml(skill.name)}</h3>
        </div>
        <div class="drag-export-handle" title="Drag to export .skill.md directly to desktop / editor" draggable="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
        </div>
      </div>
      
      <p class="card-desc">${escapeHtml(skill.description)}</p>

      <div class="card-meta-row">
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          ~${tokenEst} tokens
        </span>
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          ${sizeKb} KB
        </span>
        ${scriptsCount > 0 ? `
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          ${scriptsCount} scripts
        </span>` : ''}
        ${refsCount > 0 ? `
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          ${refsCount} refs
        </span>` : ''}
        <span class="meta-chip" style="margin-left: auto;">${dateStr}</span>
      </div>

      <div class="card-footer-actions">
        <button class="btn btn-secondary btn-card-preview">Preview</button>
        <button class="btn btn-outline btn-card-copy">Copy</button>
        <button class="btn btn-outline btn-card-download" title="Download .skill.md">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <button class="btn btn-danger btn-card-delete" title="Delete skill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    // Preview
    card.querySelector('.btn-card-preview').addEventListener('click', () => openPreviewModal(skill));

    // Copy
    card.querySelector('.btn-card-copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(skill.compiledMarkdown);
      showToast(`Copied "${skill.name}" playbook to clipboard!`, 'success');
    });

    // Download
    card.querySelector('.btn-card-download').addEventListener('click', () => {
      downloadFile(`${skill.slug || 'skill'}.skill.md`, skill.compiledMarkdown);
      showToast(`Downloaded ${skill.name}.skill.md`, 'success');
    });

    // Delete
    card.querySelector('.btn-card-delete').addEventListener('click', async () => {
      if (confirm(`Delete skill playbook "${skill.name}"?`)) {
        await storage.deleteSkill(skill.id);
        showToast('Skill deleted', 'info');
        loadGallery();
      }
    });

    // Drag and Drop Export
    const dragHandle = card.querySelector('.drag-export-handle');
    dragHandle.addEventListener('dragstart', (e) => {
      const fileName = `${skill.slug || 'skill'}.skill.md`;
      const blob = new Blob([skill.compiledMarkdown], { type: 'text/markdown' });
      const fileUrl = URL.createObjectURL(blob);
      e.dataTransfer.setData('DownloadURL', `text/markdown:${fileName}:${fileUrl}`);
      e.dataTransfer.setData('text/plain', skill.compiledMarkdown);
    });

    galleryCardsGrid.appendChild(card);
  });
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

// Auto-Suggest Setup (Real-Time WASM & Fuzzy Match)
function setupAutosuggest() {
  const dropdown = document.getElementById('autosuggest-dropdown');
  if (!dropdown || !inputGithubCmd) return;

  function renderSuggestions(query = '') {
    const q = query.trim().toLowerCase();
    let matches = [];

    if (!q) {
      // Show top curated recommendations when input is empty/focused
      matches = CURATED_SKILLS.slice(0, 7);
    } else {
      matches = CURATED_SKILLS.filter(s => {
        const nameMatch = s.name.toLowerCase().includes(q);
        const slugMatch = s.slug.toLowerCase().includes(q);
        const catMatch = s.category.toLowerCase().includes(q);
        const tagMatch = (s.tags || []).some(t => t.toLowerCase().includes(q));
        const descMatch = s.description.toLowerCase().includes(q);
        return nameMatch || slugMatch || catMatch || tagMatch || descMatch;
      }).slice(0, 8);
    }

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = '';
    matches.forEach(item => {
      const div = document.createElement('div');
      div.className = 'autosuggest-item';
      div.innerHTML = `
        <div class="autosuggest-info">
          <div class="autosuggest-name">${escapeHtml(item.name)}</div>
          <div class="autosuggest-sub">${escapeHtml(item.description)}</div>
        </div>
        <span class="autosuggest-badge">${escapeHtml(item.badge)}</span>
      `;

      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputGithubCmd.value = item.command;
        dropdown.style.display = 'none';
        showToast(`Selected "${item.name}"`, 'info');
      });

      dropdown.appendChild(div);
    });

    dropdown.style.display = 'flex';
  }

  inputGithubCmd.addEventListener('input', () => {
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
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cmd = chip.dataset.skillCmd;
      if (cmd && inputGithubCmd) {
        inputGithubCmd.value = cmd;
        showToast(`Loaded preset: ${chip.textContent.trim()}`, 'info');
      }
    });
  });
}

// Curated Skills Hub with Live Search & Category Filter
let activeCuratedCat = 'all';
let curatedSearchQuery = '';

function renderCuratedHub() {
  if (!curatedCardsGrid) return;
  curatedCardsGrid.innerHTML = '';

  const catButtons = document.querySelectorAll('#curated-category-bar .tag-filter');
  catButtons.forEach(btn => {
    btn.onclick = () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCuratedCat = btn.dataset.curatedCat || 'all';
      filterAndRenderCurated();
    };
  });

  const searchInput = document.getElementById('curated-search-input');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', (e) => {
      curatedSearchQuery = e.target.value.trim().toLowerCase();
      filterAndRenderCurated();
    });
  }

  filterAndRenderCurated();
}

function filterAndRenderCurated() {
  if (!curatedCardsGrid) return;
  curatedCardsGrid.innerHTML = '';

  const filtered = CURATED_SKILLS.filter(item => {
    const matchesCat = (activeCuratedCat === 'all' || item.category === activeCuratedCat);
    if (!matchesCat) return false;

    if (!curatedSearchQuery) return true;
    const nameMatch = item.name.toLowerCase().includes(curatedSearchQuery);
    const slugMatch = item.slug.toLowerCase().includes(curatedSearchQuery);
    const descMatch = item.description.toLowerCase().includes(curatedSearchQuery);
    const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(curatedSearchQuery));
    return nameMatch || slugMatch || descMatch || tagMatch;
  });

  if (filtered.length === 0) {
    curatedCardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--muted-foreground);">
        <p>No curated skills matching your search criteria.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'curated-card';
    card.innerHTML = `
      <div class="curated-header">
        <div class="curated-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
        <span class="card-badge">${escapeHtml(item.badge)}</span>
      </div>
      <h3 class="curated-title">${escapeHtml(item.name)}</h3>
      <p class="curated-desc">${escapeHtml(item.description)}</p>
      <div class="curated-tags">
        ${(item.tags || []).map(t => `<span class="curated-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div style="margin-top: auto; display: flex; gap: 8px;">
        <button class="btn btn-primary btn-curated-extract" style="width: 100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          1-Click Extract
        </button>
      </div>
    `;

    card.querySelector('.btn-curated-extract').addEventListener('click', async () => {
      switchView('extract');
      inputGithubCmd.value = item.command;
      btnExtractGithub.click();
    });

    curatedCardsGrid.appendChild(card);
  });
}

// Modal Inspector
function openPreviewModal(skill) {
  selectedSkill = skill;
  currentModalFormat = 'skill.md';
  modalFormatSelect.value = 'skill.md';

  modalSkillTitle.innerText = skill.name;
  const tokenEst = (skill.tokenEstimate || wasmEngine.estimateTokens(skill.compiledMarkdown || '')).toLocaleString();
  modalSkillSubtitle.innerText = `${skill.slug}.skill.md • ~${tokenEst} LLM tokens • ${((skill.sizeBytes || 0) / 1024).toFixed(1)} KB`;

  const parsed = parseSkillMarkdown(skill.compiledMarkdown);

  // 1. Directives Rendered Markdown
  modalRenderedContent.innerHTML = marked.parse(parsed.directives || skill.directives || 'No directives body provided.');
  if (window.Prism) Prism.highlightAllUnder(modalRenderedContent);

  // 2. Metadata Grid
  modalMetaGrid.innerHTML = '';
  const lines = (parsed.yamlStr || '').split('\n');
  lines.forEach(l => {
    const parts = l.split(':');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join(':').trim();
      if (k && v) {
        modalMetaGrid.innerHTML += `
          <div class="meta-lbl">${escapeHtml(k)}</div>
          <div class="meta-val">${escapeHtml(v)}</div>
        `;
      }
    }
  });
  if (!modalMetaGrid.innerHTML) {
    modalMetaGrid.innerHTML = '<div style="grid-column: span 2; color: var(--text-dim);">No frontmatter properties defined.</div>';
  }

  // 3. Helper Scripts
  modalScriptsCount.innerText = parsed.scripts.length;
  modalScriptSelector.innerHTML = '';
  if (parsed.scripts.length > 0) {
    parsed.scripts.forEach((script, idx) => {
      const chip = document.createElement('button');
      chip.className = `script-tab-chip ${idx === 0 ? 'active' : ''}`;
      chip.innerText = `scripts/${script.fileName}`;
      chip.addEventListener('click', () => {
        modalScriptSelector.querySelectorAll('.script-tab-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
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
      chip.className = `script-tab-chip ${idx === 0 ? 'active' : ''}`;
      chip.innerText = `references/${ref.fileName}`;
      chip.addEventListener('click', () => {
        modalRefSelector.querySelectorAll('.script-tab-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        modalRefContent.innerHTML = marked.parse(ref.content);
        if (window.Prism) Prism.highlightAllUnder(modalRefContent);
      });
      modalRefSelector.appendChild(chip);
    });
    modalRefContent.innerHTML = marked.parse(parsed.references[0].content);
    if (window.Prism) Prism.highlightAllUnder(modalRefContent);
  } else {
    modalRefContent.innerHTML = '<p style="color: var(--text-dim);">No reference documentation attached.</p>';
  }

  // 5. Raw Source
  modalRawSource.innerText = skill.compiledMarkdown;

  switchModalTab('modal-pane-rendered');
  previewModal.classList.add('active');
}

function switchModalTab(targetPaneId) {
  modalNavButtons.forEach(btn => {
    if (btn.getAttribute('data-pane') === targetPaneId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  Object.values(modalPanes).forEach(pane => {
    if (pane && pane.id === targetPaneId) {
      pane.classList.add('active');
    } else if (pane) {
      pane.classList.remove('active');
    }
  });
}

function setupModal() {
  modalNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchModalTab(btn.getAttribute('data-pane'));
    });
  });

  const closeModal = () => previewModal.classList.remove('active');
  modalBtnClose.addEventListener('click', closeModal);
  modalBtnDone.addEventListener('click', closeModal);
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closeModal();
  });

  // Modal Format Switcher
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
  statTotalTokens.innerText = totalTokens.toLocaleString();
  statWasmMem.innerText = `${((wasmEngine.memory?.buffer.byteLength || 65536) / 1024).toFixed(0)} KB`;
}

function setupWasmDiagnostics() {
  btnRunBenchmark.addEventListener('click', () => {
    btnRunBenchmark.disabled = true;
    btnRunBenchmark.innerText = 'Benchmarking...';

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
      btnRunBenchmark.innerText = 'Run Benchmark (10k ops)';
      showToast(`Benchmark complete! WebAssembly is ${result.speedup} faster!`, 'success');
    }, 50);
  });

  // Token Estimator Sandbox
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
}

function setupSettings() {
  btnSaveSettings.addEventListener('click', async () => {
    await storage.saveSettings({
      defaultTags: settingTags.value.trim(),
      defaultExportFormat: settingExportFormat.value,
      githubToken: settingGhToken.value.trim()
    });
    showToast('Settings saved successfully!', 'success');
  });

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

  // Export All ZIP
  btnExportAllZip.addEventListener('click', async () => {
    const skills = await storage.getSkills();
    if (skills.length === 0) {
      showToast('No skills to export', 'error');
      return;
    }

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
  // Navigation Buttons
  Object.keys(navButtons).forEach(viewName => {
    navButtons[viewName]?.addEventListener('click', () => switchView(viewName));
  });

  btnGalleryNewExtract?.addEventListener('click', () => switchView('extract'));
  btnEmptyExtract?.addEventListener('click', () => switchView('extract'));

  // Gallery live search
  gallerySearchInput?.addEventListener('input', () => renderGalleryCards());

  // Setup modules
  setupInputTabs();
  setupExtraction();
  setupModal();
  setupWasmDiagnostics();
  setupSettings();

  // Initialize WASM and Load Database
  await wasmEngine.ready();
  await loadGallery();

  // Run initial lightweight benchmark on load
  const initialBench = wasmEngine.runBenchmark(1000);
  statWasmSpeedup.innerText = initialBench.speedup;

  // Handle URL query parameter from landing page redirect (e.g. ?extract=... or ?skill=...)
  const urlParams = new URLSearchParams(window.location.search);
  const inputQuery = urlParams.get('extract') || urlParams.get('url') || urlParams.get('link') || urlParams.get('query') || urlParams.get('cmd') || urlParams.get('skill');
  if (inputQuery) {
    let cleanQuery = decodeURIComponent(inputQuery).trim();
    // Check if inputQuery is a slug of a curated skill
    const foundSkill = CURATED_SKILLS.find(s => s.slug === cleanQuery || s.id === cleanQuery || s.name.toLowerCase() === cleanQuery.toLowerCase());
    if (foundSkill) {
      cleanQuery = foundSkill.command;
    }

    if (cleanQuery) {
      switchView('extract');
      const tabBtn = document.getElementById('tab-btn-github');
      if (tabBtn) tabBtn.click();
      if (inputGithubCmd) {
        inputGithubCmd.value = cleanQuery;
        appendLog(`Received skill request: ${cleanQuery}`, 'info');
        setTimeout(() => {
          if (btnExtractGithub && !btnExtractGithub.disabled) {
            btnExtractGithub.click();
          }
        }, 150);
      }
      // Clean query parameter from browser address bar without reloading
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }
});
