const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');

let mainWindow;

// Settings Management
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
let settings = {
  saveLocation: path.join(app.getPath('userData'), 'extracted_skills'),
  autoOpen: false,
  defaultTags: ''
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      settings = { ...settings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  
  // Ensure active save location exists
  if (!fs.existsSync(settings.saveLocation)) {
    try {
      fs.mkdirSync(settings.saveLocation, { recursive: true });
    } catch (err) {
      console.error('Failed to create save directory, resetting to default', err);
      settings.saveLocation = path.join(app.getPath('userData'), 'extracted_skills');
      fs.mkdirSync(settings.saveLocation, { recursive: true });
    }
  }
}

function saveSettings(newSettings) {
  try {
    settings = { ...settings, ...newSettings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    
    // Ensure the new save directory exists
    if (!fs.existsSync(settings.saveLocation)) {
      fs.mkdirSync(settings.saveLocation, { recursive: true });
    }
    return true;
  } catch (e) {
    console.error('Failed to save settings', e);
    return false;
  }
}

// Call settings load on boot
loadSettings();

function getSkillsDir() {
  return settings.saveLocation;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#fafafa',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper to sanitize filename
function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Download file helper that handles redirects
function downloadFile(urlStr, destPath, progressCallback) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Skill-Extractor-Electron-App'
      }
    };

    https.get(urlStr, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirect
        downloadFile(res.headers.location, destPath, progressCallback)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: Status code ${res.statusCode}`));
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedSize = 0;
      const fileStream = fs.createWriteStream(destPath);

      fileStream.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(destPath)) {
          try { fs.unlinkSync(destPath); } catch (e) {}
        }
        reject(err);
      });

      fileStream.on('finish', () => {
        resolve();
      });

      res.on('data', (chunk) => {
        fileStream.write(chunk);
        downloadedSize += chunk.length;
        if (totalSize > 0 && progressCallback) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          progressCallback(percent);
        }
      });

      res.on('end', () => {
        fileStream.end();
      });

      res.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(destPath)) {
          try { fs.unlinkSync(destPath); } catch (e) {}
        }
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-extracted-skills', async () => {
  try {
    const skillsDir = getSkillsDir();
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }
    const files = fs.readdirSync(skillsDir);
    const skills = [];

    for (const file of files) {
      if (!file.endsWith('.skill.md')) continue;
      const filePath = path.join(skillsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse YAML frontmatter if exists
      let metadata = { name: file.replace('.skill.md', ''), description: 'No description provided' };
      const yamlMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      if (yamlMatch) {
        try {
          const parsed = yaml.load(yamlMatch[1]);
          if (parsed) {
            metadata = { ...metadata, ...parsed };
          }
        } catch (e) {
          console.error('Failed to parse frontmatter for', file, e);
        }
      }

      const stats = fs.statSync(filePath);
      skills.push({
        fileName: file,
        filePath: filePath,
        metadata: metadata,
        sizeBytes: stats.size,
        dateAdded: stats.mtime
      });
    }

    // Sort by date added desc
    return skills.sort((a, b) => b.dateAdded - a.dateAdded);
  } catch (err) {
    console.error('Failed to get extracted skills', err);
    return [];
  }
});

ipcMain.handle('read-skill-content', async (event, filePath) => {
  const skillsDir = getSkillsDir();
  const resolvedPath = path.resolve(filePath);
  const resolvedSkillsDir = path.resolve(skillsDir);
  
  if (!resolvedPath.startsWith(resolvedSkillsDir)) {
    throw new Error('Unauthorized file access');
  }
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('delete-skill', async (event, filePath) => {
  const skillsDir = getSkillsDir();
  const resolvedPath = path.resolve(filePath);
  const resolvedSkillsDir = path.resolve(skillsDir);

  if (!resolvedPath.startsWith(resolvedSkillsDir)) {
    throw new Error('Unauthorized file deletion');
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// Initiate Drag and Drop
ipcMain.on('start-drag', (event, filePath) => {
  if (!fs.existsSync(filePath)) return;
  
  const absolutePath = path.resolve(filePath);
  
  try {
    event.sender.startDrag({
      file: absolutePath,
      icon: nativeImage.createEmpty()
    });
  } catch (err) {
    console.error('Failed to start drag', err);
  }
});

// Settings IPC Handlers
ipcMain.handle('get-settings', () => {
  return settings;
});

ipcMain.handle('update-settings', (event, newSettings) => {
  return saveSettings(newSettings);
});

ipcMain.handle('select-save-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: settings.saveLocation
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-default-save-path', () => {
  return path.join(app.getPath('userData'), 'extracted_skills');
});

// Main Compilation Logic
ipcMain.handle('extract-skill', async (event, { type, source, subdir }) => {
  const updateStatus = (status, progress = 0) => {
    mainWindow.webContents.send('extraction-progress', { status, progress });
  };

  const tempDir = path.join(app.getPath('userData'), 'temp_extract');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    let sourceDir = '';

    if (type === 'github') {
      let repoStr = source.trim();
      repoStr = repoStr.replace(/https?:\/\/github\.com\//i, '');
      repoStr = repoStr.replace(/\.git$/i, '');
      const parts = repoStr.split('/');
      if (parts.length < 2) {
        throw new Error('Invalid GitHub repository format. Use owner/repo or full url.');
      }
      const owner = parts[0];
      const repo = parts[1];

      updateStatus(`Downloading repository zip for ${owner}/${repo}...`, 10);
      const zipPath = path.join(tempDir, 'repo.zip');
      
      try {
        const downloadUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
        await downloadFile(downloadUrl, zipPath, (pct) => {
          updateStatus(`Downloading zip (API): ${pct}%`, 10 + Math.round(pct * 0.4));
        });
      } catch (err) {
        updateStatus('API request failed. Falling back to direct main branch download...', 35);
        try {
          const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`;
          await downloadFile(downloadUrl, zipPath, (pct) => {
            updateStatus(`Downloading zip (main): ${pct}%`, 10 + Math.round(pct * 0.4));
          });
        } catch (err2) {
          updateStatus('Main branch download failed. Falling back to master branch...', 50);
          const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`;
          await downloadFile(downloadUrl, zipPath, (pct) => {
            updateStatus(`Downloading zip (master): ${pct}%`, 10 + Math.round(pct * 0.4));
          });
        }
      }

      updateStatus('Extracting ZIP archive...', 60);
      const zip = new AdmZip(zipPath);
      const extractPath = path.join(tempDir, 'extracted');
      zip.extractAllTo(extractPath, true);

      const subdirs = fs.readdirSync(extractPath);
      if (subdirs.length === 0) {
        throw new Error('Extracted archive is empty');
      }
      sourceDir = path.join(extractPath, subdirs[0]);
    } else {
      sourceDir = source;
      updateStatus('Scanning local folder...', 20);
    }

    // Resolve Subdirectory Targeted (via npx subcommand --skill copywriting)
    let skillSearchStartDir = sourceDir;
    if (subdir) {
      const checkSubdir = path.join(sourceDir, subdir);
      if (fs.existsSync(checkSubdir) && fs.statSync(checkSubdir).isDirectory()) {
        skillSearchStartDir = checkSubdir;
        updateStatus(`Targeted subdirectory matched: ${subdir}`, 63);
      } else {
        updateStatus(`Subdirectory "${subdir}" not found directly. Searching recursively...`, 64);
        
        // Helper to normalize names for loose matching
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // If they passed a path with slashes, take the last segment (leaf name) for recursive search
        const leafName = path.basename(subdir);
        const targetNormalized = normalize(leafName);
        
        const findSubdir = (dir, targetNorm) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              if (normalize(file) === targetNorm) {
                return fullPath;
              }
              const found = findSubdir(fullPath, targetNorm);
              if (found) return found;
            }
          }
          return null;
        };
        
        const resolvedSub = findSubdir(sourceDir, targetNormalized);
        if (resolvedSub) {
          skillSearchStartDir = resolvedSub;
          updateStatus(`Targeted subdirectory resolved: ${path.relative(sourceDir, resolvedSub)}`, 68);
        } else {
          throw new Error(`Specified skill directory "${subdir}" could not be resolved inside the package.`);
        }
      }
    }

    // Pipeline: Compilation
    updateStatus('Locating SKILL.md...', 70);
    
    // Find SKILL.md (case insensitive, search inside resolved search directory)
    const findSkillFile = (dir) => {
      const files = fs.readdirSync(dir);
      // Check root level of directory first
      for (const file of files) {
        if (file.toLowerCase() === 'skill.md') {
          return path.join(dir, file);
        }
      }
      // Check children recursively
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          if (file !== 'node_modules' && file !== '.git') {
            const found = findSkillFile(fullPath);
            if (found) return found;
          }
        }
      }
      return null;
    };

    const skillMdPath = findSkillFile(skillSearchStartDir);
    if (!skillMdPath) {
      throw new Error(`Could not find SKILL.md inside "${path.relative(sourceDir, skillSearchStartDir) || 'root'}".`);
    }

    const skillBaseDir = path.dirname(skillMdPath);
    const skillContent = fs.readFileSync(skillMdPath, 'utf-8');

    // Parse Frontmatter
    updateStatus('Parsing metadata...', 80);
    let frontmatter = {};
    let mainBody = skillContent;

    const yamlMatch = skillContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (yamlMatch) {
      try {
        frontmatter = yaml.load(yamlMatch[1]) || {};
        mainBody = skillContent.substring(yamlMatch[0].length).trim();
      } catch (e) {
        updateStatus('Warning: Frontmatter exists but failed to parse YAML: ' + e.message);
      }
    }

    const name = frontmatter.name || path.basename(skillBaseDir);
    const description = frontmatter.description || 'No description provided';
    const slug = sanitizeFilename(name);

    // Scan for scripts/
    updateStatus('Consolidating scripts...', 85);
    let scriptsContent = '';
    const scriptsDir = path.join(skillBaseDir, 'scripts');
    
    if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
      const scriptFiles = fs.readdirSync(scriptsDir);
      for (const scriptFile of scriptFiles) {
        const scriptPath = path.join(scriptsDir, scriptFile);
        if (fs.statSync(scriptPath).isFile()) {
          const ext = path.extname(scriptFile).toLowerCase();
          const isText = ['.sh', '.py', '.js', '.json', '.yml', '.yaml', '.txt', '.ps1', '.bat', ''].includes(ext);
          if (isText) {
            try {
              const content = fs.readFileSync(scriptPath, 'utf-8');
              const lang = ext === '.sh' ? 'bash' 
                         : ext === '.py' ? 'python' 
                         : ext === '.js' ? 'javascript' 
                         : ext === '.json' ? 'json' 
                         : ext === '.yml' || ext === '.yaml' ? 'yaml' 
                         : ext === '.ps1' ? 'powershell'
                         : '';
              scriptsContent += `\n### Script: \`scripts/${scriptFile}\`\n\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
            } catch (e) {
              console.error(`Failed to read script ${scriptFile}`, e);
            }
          }
        }
      }
    }

    // Scan for references/
    updateStatus('Consolidating references...', 90);
    let referencesContent = '';
    const refsDir = path.join(skillBaseDir, 'references');

    if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
      const refFiles = fs.readdirSync(refsDir);
      for (const refFile of refFiles) {
        const refPath = path.join(refsDir, refFile);
        if (fs.statSync(refPath).isFile()) {
          const ext = path.extname(refFile).toLowerCase();
          const isText = ['.md', '.txt', '.json', '.yml', '.yaml', '.html', '.css', '.js'].includes(ext);
          if (isText) {
            try {
              const content = fs.readFileSync(refPath, 'utf-8');
              const summaryText = `Reference Document: references/${refFile}`;
              
              referencesContent += `\n### \`${refFile}\`\n\n`;
              referencesContent += `<details>\n`;
              referencesContent += `<summary>${summaryText} (Click to expand)</summary>\n\n`;
              
              if (ext === '.md') {
                referencesContent += content;
              } else {
                const lang = ext === '.json' ? 'json' : ext === '.yml' || ext === '.yaml' ? 'yaml' : '';
                referencesContent += `\`\`\`${lang}\n${content}\n\`\`\``;
              }
              
              referencesContent += `\n\n</details>\n`;
            } catch (e) {
              console.error(`Failed to read reference ${refFile}`, e);
            }
          }
        }
      }
    }

    // Construct final compiled markdown
    updateStatus('Writing compiled skill...', 95);
    
    // Inject default settings tags if configured
    if (settings.defaultTags) {
      const tags = settings.defaultTags.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        if (!frontmatter.tags) frontmatter.tags = [];
        if (Array.isArray(frontmatter.tags)) {
          frontmatter.tags = [...new Set([...frontmatter.tags, ...tags])];
        } else if (typeof frontmatter.tags === 'string') {
          frontmatter.tags = [...new Set([frontmatter.tags, ...tags])];
        }
      }
    }

    const finalFrontmatter = {
      name: name,
      description: description,
      ...frontmatter
    };

    let compiledMarkdown = `---\n`;
    compiledMarkdown += yaml.dump(finalFrontmatter);
    compiledMarkdown += `---\n\n`;
    compiledMarkdown += mainBody;

    if (scriptsContent) {
      compiledMarkdown += `\n\n---\n\n## Consolidated Helper Scripts\n`;
      compiledMarkdown += `*These auxiliary helper scripts were extracted from the skill's package structure to run deterministic tasks.*\n`;
      compiledMarkdown += scriptsContent;
    }

    if (referencesContent) {
      compiledMarkdown += `\n\n---\n\n## Reference Documentation\n`;
      compiledMarkdown += `*This contextual reference material was extracted from the skill's package structure to provide guidelines and rule parameters.*\n`;
      compiledMarkdown += referencesContent;
    }

    const outputFileName = `${slug}.skill.md`;
    const skillsDir = getSkillsDir();
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }
    const outputPath = path.join(skillsDir, outputFileName);
    fs.writeFileSync(outputPath, compiledMarkdown, 'utf-8');

    updateStatus('Cleaning up temporary directories...', 98);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    updateStatus('Skill compiled successfully!', 100);
    
    // Trigger auto-open if active
    if (settings.autoOpen) {
      setTimeout(() => {
        shell.showItemInFolder(outputPath);
      }, 300);
    }

    return {
      success: true,
      name: name,
      filePath: outputPath,
      fileName: outputFileName
    };

  } catch (error) {
    console.error('Extraction error:', error);
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    }
    updateStatus(`Error: ${error.message}`, 0);
    return {
      success: false,
      error: error.message
    };
  }
});
