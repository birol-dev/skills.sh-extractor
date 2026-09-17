// IndexedDB Storage Manager for Skill Extractor (with In-Memory Caching)
const DB_NAME = 'SkillExtractorDB';
const DB_VERSION = 1;
const STORE_SKILLS = 'skills';
const STORE_SETTINGS = 'settings';

class StorageManager {
  constructor() {
    this.db = null;
    this.cachedSkills = null;
    this.cachedSettings = null;
    this.initPromise = this.initDB();
  }

  async initDB() {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_SKILLS)) {
            const skillStore = db.createObjectStore(STORE_SKILLS, { keyPath: 'id' });
            skillStore.createIndex('name', 'name', { unique: false });
            skillStore.createIndex('dateAdded', 'dateAdded', { unique: false });
            skillStore.createIndex('slug', 'slug', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
          }
        };

        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };

        request.onerror = (e) => {
          console.warn('IndexedDB failed to open, fallback to localStorage will be used:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization exception:', err);
        resolve(null);
      }
    });
  }

  async ready() {
    await this.initPromise;
    return !!this.db;
  }

  // Skills CRUD (Cache-First)
  async getSkills(forceRefresh = false) {
    if (!forceRefresh && this.cachedSkills !== null) {
      return this.cachedSkills;
    }

    await this.ready();
    if (!this.db) {
      // LocalStorage fallback
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('skill_extractor_skills');
          this.cachedSkills = raw ? JSON.parse(raw) : [];
        } else {
          this.cachedSkills = this.cachedSkills || [];
        }
        return this.cachedSkills;
      } catch (e) {
        this.cachedSkills = [];
        return [];
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_SKILLS, 'readonly');
      const store = tx.objectStore(STORE_SKILLS);
      const request = store.getAll();

      request.onsuccess = () => {
        const skills = request.result || [];
        // Sort descending by dateAdded
        skills.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        this.cachedSkills = skills;
        resolve(skills);
      };

      request.onerror = () => {
        this.cachedSkills = [];
        resolve([]);
      };
    });
  }

  async getSkill(id) {
    const skills = await this.getSkills();
    return skills.find(s => s.id === id) || null;
  }

  async saveSkill(skill) {
    await this.ready();
    const item = {
      id: skill.id || `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: skill.name || 'Untitled Skill',
      slug: skill.slug || 'untitled-skill',
      description: skill.description || 'No description provided',
      metadata: skill.metadata || {},
      directives: skill.directives || '',
      scripts: skill.scripts || [],
      references: skill.references || [],
      compiledMarkdown: skill.compiledMarkdown || '',
      sourceType: skill.sourceType || 'custom', // 'github' | 'local' | 'curated' | 'paste'
      sourceUrl: skill.sourceUrl || '',
      sourcePath: skill.sourcePath || '',
      sizeBytes: skill.sizeBytes || (new Blob([skill.compiledMarkdown || '']).size),
      tokenEstimate: skill.tokenEstimate || 0,
      hash: skill.hash || '',
      tags: skill.tags || [],
      dateAdded: skill.dateAdded || new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    // Update in-memory cache immediately
    const skills = await this.getSkills();
    const existingIdx = skills.findIndex(s => s.id === item.id || s.slug === item.slug);
    if (existingIdx >= 0) {
      // A slug identifies a skill to users. Reuse the original primary key so
      // IndexedDB updates that record instead of retaining a hidden duplicate.
      item.id = skills[existingIdx].id;
      item.dateAdded = skills[existingIdx].dateAdded || item.dateAdded;
      skills[existingIdx] = item;
    } else {
      skills.unshift(item);
    }
    this.cachedSkills = skills;

    if (!this.db) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('skill_extractor_skills', JSON.stringify(skills));
      }
      return item;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_SKILLS, 'readwrite');
      const store = tx.objectStore(STORE_SKILLS);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = (e) => reject(e);
    });
  }

  async deleteSkill(id) {
    await this.ready();
    const skills = await this.getSkills();
    this.cachedSkills = skills.filter(s => s.id !== id);

    if (!this.db) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('skill_extractor_skills', JSON.stringify(this.cachedSkills));
      }
      return true;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_SKILLS, 'readwrite');
      const store = tx.objectStore(STORE_SKILLS);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  // Settings (Cache-First)
  async getSettings(forceRefresh = false) {
    const defaults = {
      defaultTags: 'verified, agent-skill',
      defaultExportFormat: 'skill.md', // 'skill.md' | 'claude.md' | 'cursorrules' | 'windsurfrules' | 'antigravity'
      autoDownload: false,
      githubToken: '',
      enableWasm: true,
      editorFontSize: 13
    };

    if (!forceRefresh && this.cachedSettings !== null) {
      return this.cachedSettings;
    }

    await this.ready();
    if (!this.db) {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('skill_extractor_settings');
          this.cachedSettings = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
        } else {
          this.cachedSettings = defaults;
        }
        return this.cachedSettings;
      } catch (e) {
        this.cachedSettings = defaults;
        return defaults;
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get('app_config');

      request.onsuccess = () => {
        if (request.result?.value) {
          this.cachedSettings = { ...defaults, ...request.result.value };
        } else {
          this.cachedSettings = defaults;
        }
        resolve(this.cachedSettings);
      };
      request.onerror = () => {
        this.cachedSettings = defaults;
        resolve(defaults);
      };
    });
  }

  async saveSettings(settings) {
    await this.ready();
    const currentSettings = await this.getSettings();
    this.cachedSettings = { ...currentSettings, ...settings };

    if (!this.db) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('skill_extractor_settings', JSON.stringify(this.cachedSettings));
      }
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.put({ key: 'app_config', value: this.cachedSettings });

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e);
    });
  }

  // Backup & Restore
  async exportAllToJson() {
    const skills = await this.getSkills();
    const settings = await this.getSettings();
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      skills
    }, null, 2);
  }

  async importFromJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.skills || !Array.isArray(parsed.skills)) {
        throw new Error('Invalid backup format: missing skills array');
      }

      for (const skill of parsed.skills) {
        await this.saveSkill(skill);
      }

      if (parsed.settings) {
        await this.saveSettings(parsed.settings);
      }

      return { success: true, count: parsed.skills.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async clearAll() {
    await this.ready();
    this.cachedSkills = [];
    this.cachedSettings = null;

    if (!this.db) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('skill_extractor_skills');
        localStorage.removeItem('skill_extractor_settings');
      }
      return true;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_SKILLS, STORE_SETTINGS], 'readwrite');
      tx.objectStore(STORE_SKILLS).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
}

export const storage = new StorageManager();
export default storage;
