// State Management
let currentSkillList = [];
let selectedSkill = null;
let parsedSkillData = null;
let activeProgressSubscription = null;

// DOM Elements
const navExtract = document.getElementById('nav-extract');
const navGallery = document.getElementById('nav-gallery');
const navSettings = document.getElementById('nav-settings');
const pageExtract = document.getElementById('page-extract');
const pageGallery = document.getElementById('page-gallery');
const pageSettings = document.getElementById('page-settings');

const tabGithub = document.getElementById('tab-github');
const tabLocal = document.getElementById('tab-local');
const paneGithub = document.getElementById('pane-github');
const paneLocal = document.getElementById('pane-local');

const githubRepoInput = document.getElementById('github-repo');
const btnExtractGithub = document.getElementById('btn-extract-github');
const localPathInput = document.getElementById('local-path');
const btnBrowseLocal = document.getElementById('btn-browse-local');
const btnExtractLocal = document.getElementById('btn-extract-local');

const consoleOutput = document.getElementById('console-output');
const galleryContainer = document.getElementById('gallery-container');
const galleryEmpty = document.getElementById('gallery-empty');
const gallerySearch = document.getElementById('gallery-search');
const btnRefreshGallery = document.getElementById('btn-refresh-gallery');
const btnGoExtract = document.getElementById('btn-go-extract');

// Settings Page Elements
const settingSavePathInput = document.getElementById('setting-save-path');
const btnBrowseSave = document.getElementById('btn-browse-save');
const btnResetSave = document.getElementById('btn-reset-save');
const settingAutoOpenCheck = document.getElementById('setting-auto-open');
const settingTagsInput = document.getElementById('setting-tags');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Modal Elements
const previewModal = document.getElementById('preview-modal');
const modalSkillTitle = document.getElementById('modal-skill-title');
const modalSkillFile = document.getElementById('modal-skill-file');
const modalBtnClose = document.getElementById('modal-btn-close');
const modalBtnCloseFooter = document.getElementById('modal-btn-close-footer');
const modalBtnFolder = document.getElementById('modal-btn-folder');
const modalBtnCopy = document.getElementById('modal-btn-copy');

const modalTabScripts = document.getElementById('modal-tab-scripts');
const modalTabRefs = document.getElementById('modal-tab-refs');

const modalSidebarItems = document.querySelectorAll('.modal-sidebar-item');
const previewPanes = document.querySelectorAll('.preview-pane');

const previewDirectivesBody = document.getElementById('preview-directives-body');
const previewMetaGrid = document.getElementById('preview-meta-grid');
const scriptSelector = document.getElementById('script-selector');
const previewScriptCode = document.getElementById('preview-script-code');
const refSelector = document.getElementById('ref-selector');
const previewRefBody = document.getElementById('preview-ref-body');
const previewRawCode = document.getElementById('preview-raw-code');

const toastContainer = document.getElementById('toast-container');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupTabs();
  setupExtractor();
  setupGallery();
  setupModal();
  setupSettings();
  
  // Load settings configurations on boot
  loadSettingsUI();
});

// Toast Helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 3000);
}

// Navigation Logic
function setupNavigation() {
  const handleNav = (targetId) => {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

    if (targetId === 'page-extract') {
      navExtract.classList.add('active');
      pageExtract.classList.add('active');
    } else if (targetId === 'page-gallery') {
      navGallery.classList.add('active');
      pageGallery.classList.add('active');
      loadGallery();
    } else if (targetId === 'page-settings') {
      navSettings.classList.add('active');
      pageSettings.classList.add('active');
      loadSettingsUI();
    }
  };

  navExtract.addEventListener('click', () => handleNav('page-extract'));
  navGallery.addEventListener('click', () => handleNav('page-gallery'));
  navSettings.addEventListener('click', () => handleNav('page-settings'));
  btnGoExtract.addEventListener('click', () => handleNav('page-extract'));
}

// Tab Selector Logic
function setupTabs() {
  const handleTab = (activeTab, activePane, inactiveTab, inactivePane) => {
    activeTab.classList.add('active');
    activePane.classList.add('active');
    inactiveTab.classList.remove('active');
    inactivePane.classList.remove('active');
  };

  tabGithub.addEventListener('click', () => handleTab(tabGithub, paneGithub, tabLocal, paneLocal));
  tabLocal.addEventListener('click', () => handleTab(tabLocal, paneLocal, tabGithub, paneGithub));
}

// Command Parsing Logic
function parseNpxCommand(input) {
  const trimmed = input.trim();
  
  // Return null if it is not an npx command targeting skills add
  if (!trimmed.toLowerCase().includes('skills add')) {
    return null;
  }
  
  // Simple command splitter that respects single/double quoted sub-arguments
  const args = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  
  let source = '';
  let subdir = '';
  
  const addIdx = args.findIndex(arg => arg.toLowerCase() === 'add');
  if (addIdx !== -1 && addIdx + 1 < args.length) {
    source = args[addIdx + 1].replace(/['"]/g, ''); // strip quotes
    
    // Scan for directory parameters --skill or -s
    for (let i = addIdx + 2; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if ((arg === '--skill' || arg === '-s') && i + 1 < args.length) {
        subdir = args[i + 1].replace(/['"]/g, '');
        break;
      }
    }
  }
  
  if (!source) return null;
  
  return {
    source,
    subdir
  };
}

// Console Logging Helpers
function clearLogs() {
  consoleOutput.innerHTML = '';
}

function appendLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Extraction Panel Logic
function setupExtractor() {
  if (activeProgressSubscription) activeProgressSubscription();
  activeProgressSubscription = window.api.onExtractionProgress((data) => {
    let type = 'info';
    if (data.status.toLowerCase().includes('success')) {
      type = 'success';
    } else if (data.status.toLowerCase().includes('error') || data.status.toLowerCase().includes('fail')) {
      type = 'error';
    } else if (data.status.toLowerCase().includes('downloading') || data.status.toLowerCase().includes('%')) {
      type = 'progress';
    }
    appendLog(data.status, type);
  });

  btnBrowseLocal.addEventListener('click', async () => {
    const selected = await window.api.selectFolder();
    if (selected) {
      localPathInput.value = selected;
      btnExtractLocal.removeAttribute('disabled');
      appendLog(`Selected local directory: ${selected}`, 'info');
    }
  });

  btnExtractGithub.addEventListener('click', async () => {
    const input = githubRepoInput.value.trim();
    if (!input) {
      showToast('Please enter a repository source, URL, or raw npx command', 'error');
      return;
    }
    
    const cmdParse = parseNpxCommand(input);
    if (cmdParse) {
      appendLog(`Parsed raw NPX Command: repository = "${cmdParse.source}", target skill = "${cmdParse.subdir || 'root'}"`, 'info');
      await triggerExtraction('github', cmdParse.source, cmdParse.subdir);
    } else {
      await triggerExtraction('github', input, null);
    }
  });

  btnExtractLocal.addEventListener('click', async () => {
    const source = localPathInput.value.trim();
    if (!source) {
      showToast('Please select a local directory first', 'error');
      return;
    }
    await triggerExtraction('local', source, null);
  });
}

async function triggerExtraction(type, source, subdir) {
  // Disable UI
  btnExtractGithub.setAttribute('disabled', 'true');
  btnExtractLocal.setAttribute('disabled', 'true');
  btnBrowseLocal.setAttribute('disabled', 'true');
  githubRepoInput.setAttribute('disabled', 'true');
  
  clearLogs();
  appendLog(`Starting extraction for "${source}"...`, 'info');

  try {
    const result = await window.api.extractSkill({ type, source, subdir });
    if (result.success) {
      appendLog(`Process Complete! Saved to: ${result.filePath}`, 'success');
      showToast(`Successfully extracted ${result.name}!`, 'success');
      githubRepoInput.value = '';
    } else {
      appendLog(`Extraction Failed: ${result.error}`, 'error');
      showToast(`Extraction Failed: ${result.error}`, 'error');
    }
  } catch (e) {
    appendLog(`Uncaught Exception: ${e.message}`, 'error');
    showToast(`Extraction Error: ${e.message}`, 'error');
  } finally {
    btnExtractGithub.removeAttribute('disabled');
    if (localPathInput.value) {
      btnExtractLocal.removeAttribute('disabled');
    }
    btnBrowseLocal.removeAttribute('disabled');
    githubRepoInput.removeAttribute('disabled');
  }
}

// Gallery Tab Logic
async function loadGallery() {
  galleryContainer.innerHTML = '';
  galleryEmpty.style.display = 'none';

  try {
    currentSkillList = await window.api.getExtractedSkills();
    renderGalleryGrid(currentSkillList);
  } catch (e) {
    showToast('Failed to load gallery content', 'error');
    console.error(e);
  }
}

function setupGallery() {
  btnRefreshGallery.addEventListener('click', loadGallery);
  
  gallerySearch.addEventListener('input', () => {
    const query = gallerySearch.value.toLowerCase().trim();
    if (!query) {
      renderGalleryGrid(currentSkillList);
      return;
    }
    const filtered = currentSkillList.filter(skill => {
      const name = (skill.metadata.name || '').toLowerCase();
      const desc = (skill.metadata.description || '').toLowerCase();
      const filename = (skill.fileName || '').toLowerCase();
      return name.includes(query) || desc.includes(query) || filename.includes(query);
    });
    renderGalleryGrid(filtered);
  });
}

function renderGalleryGrid(skills) {
  galleryContainer.innerHTML = '';
  
  if (skills.length === 0) {
    galleryEmpty.style.display = 'flex';
    return;
  }
  
  galleryEmpty.style.display = 'none';

  skills.forEach(skill => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    const sizeKB = (skill.sizeBytes / 1024).toFixed(1);

    const name = skill.metadata.name || skill.fileName.replace('.skill.md', '');
    const desc = skill.metadata.description || 'No description provided';
    
    card.innerHTML = `
      <div class="card-top">
        <h3 class="skill-name" title="${name}">${name}</h3>
        <div class="drag-handle" title="Drag and Drop compiled MD file" draggable="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
        </div>
      </div>
      <p class="skill-desc">${desc}</p>
      <div class="skill-meta">
        <span class="meta-item">Size: ${sizeKB} KB</span>
        <span class="meta-item">${new Date(skill.dateAdded).toLocaleDateString()}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-preview">Preview</button>
        <button class="btn btn-outline btn-copy">Copy</button>
        <button class="btn btn-danger-outline btn-delete" title="Delete extracted file">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    card.querySelector('.btn-preview').addEventListener('click', () => openPreviewModal(skill));
    card.querySelector('.btn-copy').addEventListener('click', async () => {
      try {
        const content = await window.api.readSkillContent(skill.filePath);
        await navigator.clipboard.writeText(content);
        showToast('Skill playbook copied to clipboard!', 'success');
      } catch (e) {
        showToast('Failed to copy skill', 'error');
      }
    });
    
    card.querySelector('.btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`Are you sure you want to delete ${name}?`);
      if (confirmDelete) {
        try {
          const ok = await window.api.deleteSkill(skill.filePath);
          if (ok) {
            showToast('Skill deleted successfully', 'success');
            loadGallery();
          }
        } catch (err) {
          showToast('Failed to delete skill', 'error');
        }
      }
    });

    const handleEl = card.querySelector('.drag-handle');
    handleEl.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.api.startDrag(skill.filePath);
    });

    galleryContainer.appendChild(card);
  });
}

// Settings Controls
async function loadSettingsUI() {
  try {
    const currentSettings = await window.api.getSettings();
    settingSavePathInput.value = currentSettings.saveLocation;
    settingAutoOpenCheck.checked = currentSettings.autoOpen;
    settingTagsInput.value = currentSettings.defaultTags || '';
  } catch (err) {
    showToast('Failed to load settings configuration', 'error');
    console.error(err);
  }
}

function setupSettings() {
  btnBrowseSave.addEventListener('click', async () => {
    const selected = await window.api.selectSaveDirectory();
    if (selected) {
      settingSavePathInput.value = selected;
    }
  });

  btnResetSave.addEventListener('click', async () => {
    const defaultPath = await window.api.getDefaultSavePath();
    settingSavePathInput.value = defaultPath;
  });

  btnSaveSettings.addEventListener('click', async () => {
    const saveLocation = settingSavePathInput.value.trim();
    const autoOpen = settingAutoOpenCheck.checked;
    const defaultTags = settingTagsInput.value.trim();

    if (!saveLocation) {
      showToast('Save location path cannot be empty', 'error');
      return;
    }

    try {
      const ok = await window.api.updateSettings({
        saveLocation,
        autoOpen,
        defaultTags
      });
      if (ok) {
        showToast('Configurations saved successfully!', 'success');
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Error saving settings', 'error');
      console.error(err);
    }
  });
}

// Markdown and Consolidation Parser
function parseSkillMarkdown(content) {
  let yamlStr = '';
  let rest = content;

  const yamlMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (yamlMatch) {
    yamlStr = yamlMatch[1];
    rest = content.substring(yamlMatch[0].length).trim();
  }

  let directives = rest;
  let scriptsSection = '';
  let referencesSection = '';

  const scriptsHeader = '## Consolidated Helper Scripts';
  const refsHeader = '## Reference Documentation';

  const scriptsIndex = rest.indexOf(scriptsHeader);
  const refsIndex = rest.indexOf(refsHeader);

  if (scriptsIndex !== -1 && refsIndex !== -1) {
    if (scriptsIndex < refsIndex) {
      directives = rest.substring(0, scriptsIndex).trim();
      scriptsSection = rest.substring(scriptsIndex, refsIndex).trim();
      referencesSection = rest.substring(refsIndex).trim();
    } else {
      directives = rest.substring(0, refsIndex).trim();
      referencesSection = rest.substring(refsIndex, scriptsIndex).trim();
      scriptsSection = rest.substring(scriptsIndex).trim();
    }
  } else if (scriptsIndex !== -1) {
    directives = rest.substring(0, scriptsIndex).trim();
    scriptsSection = rest.substring(scriptsIndex).trim();
  } else if (refsIndex !== -1) {
    directives = rest.substring(0, refsIndex).trim();
    referencesSection = rest.substring(refsIndex).trim();
  }

  const scripts = [];
  if (scriptsSection) {
    const scriptRegex = /### Script:\s+\`scripts\/(.+?)\`[\s\S]*?\`\`\`\w*\r?\n([\s\S]*?)\`\`\`/g;
    let match;
    while ((match = scriptRegex.exec(scriptsSection)) !== null) {
      scripts.push({
        fileName: match[1],
        code: match[2].trim()
      });
    }
  }

  const references = [];
  if (referencesSection) {
    const refRegex = /###\s+\`(.+?)\`[\s\S]*?<details>[\s\S]*?<summary>([\s\S]*?)<\/summary>\r?\n\r?\n([\s\S]*?)\r?\n\r?\n<\/details>/g;
    let match;
    while ((match = refRegex.exec(referencesSection)) !== null) {
      references.push({
        fileName: match[1],
        summary: match[2].trim(),
        content: match[3].trim()
      });
    }
    
    if (references.length === 0) {
      const backupRefRegex = /###\s+\`(.+?)\`[\s\S]*?<details>[\s\S]*?<summary>([\s\S]*?)<\/summary>\r?\n+([\s\S]*?)\r?\n+<\/details>/g;
      while ((match = backupRefRegex.exec(referencesSection)) !== null) {
        references.push({
          fileName: match[1],
          summary: match[2].trim(),
          content: match[3].trim()
        });
      }
    }
  }

  return {
    yamlStr,
    directives,
    scripts,
    references
  };
}

// Modal View Controllers
async function openPreviewModal(skill) {
  selectedSkill = skill;
  modalSkillTitle.innerText = skill.metadata.name || skill.fileName.replace('.skill.md', '');
  modalSkillFile.innerText = skill.filePath;

  try {
    const rawContent = await window.api.readSkillContent(skill.filePath);
    parsedSkillData = parseSkillMarkdown(rawContent);

    previewRawCode.innerText = rawContent;
    previewDirectivesBody.innerText = parsedSkillData.directives;

    // Metadata Properties list
    previewMetaGrid.innerHTML = '';
    const lines = parsedSkillData.yamlStr.split('\n');
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const label = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (label && value) {
          previewMetaGrid.innerHTML += `
            <div class="preview-meta-label">${label}</div>
            <div class="preview-meta-val">${value}</div>
          `;
        }
      }
    });
    if (previewMetaGrid.innerHTML === '') {
      previewMetaGrid.innerHTML = '<div style="grid-column: span 2; color: var(--muted-foreground)">No metadata properties found.</div>';
    }

    // Scripts Pane
    scriptSelector.innerHTML = '';
    previewScriptCode.innerText = 'Select a script file from above to view...';
    modalTabScripts.innerText = `Helper Scripts (${parsedSkillData.scripts.length})`;
    
    if (parsedSkillData.scripts.length > 0) {
      modalTabScripts.style.display = 'block';
      parsedSkillData.scripts.forEach((script, idx) => {
        const btn = document.createElement('button');
        btn.className = `script-select-btn ${idx === 0 ? 'active' : ''}`;
        btn.innerText = script.fileName;
        btn.addEventListener('click', () => {
          document.querySelectorAll('#script-selector .script-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          previewScriptCode.innerText = script.code;
        });
        scriptSelector.appendChild(btn);
      });
      previewScriptCode.innerText = parsedSkillData.scripts[0].code;
    } else {
      modalTabScripts.style.display = 'none';
    }

    // References Pane
    refSelector.innerHTML = '';
    previewRefBody.innerText = 'Select a reference document from above to view...';
    modalTabRefs.innerText = `References (${parsedSkillData.references.length})`;
    
    if (parsedSkillData.references.length > 0) {
      modalTabRefs.style.display = 'block';
      parsedSkillData.references.forEach((ref, idx) => {
        const btn = document.createElement('button');
        btn.className = `script-select-btn ${idx === 0 ? 'active' : ''}`;
        btn.innerText = ref.fileName;
        btn.addEventListener('click', () => {
          document.querySelectorAll('#ref-selector .script-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          previewRefBody.innerText = ref.content;
        });
        refSelector.appendChild(btn);
      });
      previewRefBody.innerText = parsedSkillData.references[0].content;
    } else {
      modalTabRefs.style.display = 'none';
    }

    switchModalPane('preview-directives');
    previewModal.classList.add('active');
  } catch (err) {
    showToast('Failed to open file details', 'error');
    console.error(err);
  }
}

function switchModalPane(paneId) {
  modalSidebarItems.forEach(item => {
    if (item.getAttribute('data-pane') === paneId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  previewPanes.forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

function setupModal() {
  modalSidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      switchModalPane(item.getAttribute('data-pane'));
    });
  });

  const closeModal = () => {
    previewModal.classList.remove('active');
    selectedSkill = null;
    parsedSkillData = null;
  };

  modalBtnClose.addEventListener('click', closeModal);
  modalBtnCloseFooter.addEventListener('click', closeModal);
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closeModal();
  });

  modalBtnFolder.addEventListener('click', async () => {
    if (selectedSkill) {
      await window.api.showInFolder(selectedSkill.filePath);
    }
  });

  modalBtnCopy.addEventListener('click', async () => {
    if (selectedSkill) {
      try {
        const rawContent = await window.api.readSkillContent(selectedSkill.filePath);
        await navigator.clipboard.writeText(rawContent);
        showToast('Playbook source code copied!', 'success');
      } catch (e) {
        showToast('Copying failed', 'error');
      }
    }
  });
}
