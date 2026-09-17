// GitHub Client-Side API & Parser for Skill Extractor
import wasmEngine from './wasmEngine.js';

export function parseCommandOrUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. NPX Command syntax: e.g. npx skills add https://github.com/rknall/claude-skills --skill 'SVG Logo Designer'
  if (trimmed.toLowerCase().includes('skills add')) {
    const args = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const addIdx = args.findIndex(arg => arg.toLowerCase() === 'add');
    if (addIdx !== -1 && addIdx + 1 < args.length) {
      let source = args[addIdx + 1].replace(/['"]/g, '');
      let subdir = '';

      for (let i = addIdx + 2; i < args.length; i++) {
        const arg = args[i].toLowerCase();
        if ((arg === '--skill' || arg === '-s') && i + 1 < args.length) {
          subdir = args[i + 1].replace(/['"]/g, '');
          break;
        }
        if (arg.startsWith('--skill=')) {
          subdir = args[i].slice('--skill='.length).replace(/['"]/g, '');
          break;
        }
      }

      const parsedRepo = parseGitHubUrl(source);
      return {
        raw: trimmed,
        isNpx: true,
        source,
        owner: parsedRepo?.owner || '',
        repo: parsedRepo?.repo || '',
        branch: parsedRepo?.branch || '',
        subdir: subdir || parsedRepo?.subdir || ''
      };
    }
  }

  // 2. Direct GitHub URL or shorthand
  const parsed = parseGitHubUrl(trimmed);
  if (parsed) {
    return {
      raw: trimmed,
      isNpx: false,
      source: trimmed,
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch,
      subdir: parsed.subdir
    };
  }

  return null;
}

export function parseGitHubUrl(urlStr) {
  if (!urlStr) return null;
  let clean = urlStr.trim();
  if (!clean) return null;

  // Accept GitHub's SSH clone notation in addition to browser URLs.
  const sshMatch = clean.match(/^git@github\.com:([^\s]+)$/i);
  if (sshMatch) clean = `https://github.com/${sshMatch[1]}`;

  const urlLike = /^(?:https?:)?\/\/(?:www\.)?github\.com\//i.test(clean)
    || /^github\.com\//i.test(clean);
  if (urlLike) {
    try {
      const normalizedUrl = clean.startsWith('//')
        ? `https:${clean}`
        : /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      const parsedUrl = new URL(normalizedUrl);
      if (!/^www\.github\.com$/i.test(parsedUrl.hostname) && !/^github\.com$/i.test(parsedUrl.hostname)) {
        return null;
      }

      const parts = parsedUrl.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, '');
      if (!owner || !repo) return null;

      if ((parts[2] === 'tree' || parts[2] === 'blob') && parts[3]) {
        return {
          owner,
          repo,
          branch: parts[3],
          subdir: parts.slice(4).filter(p => !p.toLowerCase().endsWith('.md')).join('/')
        };
      }

      return { owner, repo, branch: '', subdir: '' };
    } catch {
      return null;
    }
  }

  // Handle shorthand: owner/repo or owner/repo/subdir.
  clean = clean.replace(/[?#].*$/, '').replace(/\.git$/i, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length >= 2 && !clean.includes(':') && !clean.includes(' ') && !clean.includes('\\')) {
    return {
      owner: parts[0],
      repo: parts[1],
      branch: '',
      subdir: parts.slice(2).join('/')
    };
  }

  return null;
}

export class GitHubFetcher {
  constructor(token = '') {
    this.token = token;
  }

  getHeaders() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  // Fetch repository metadata to determine default branch
  async getRepoInfo(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('GitHub API rate limit exceeded. You can add a GitHub Personal Access Token in Settings to bypass.');
      }
      if (res.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" not found or is private.`);
      }
      throw new Error(`Failed to fetch repo info: HTTP ${res.status}`);
    }
    return res.json();
  }

  // Fetch entire file tree in 1 single API call using Git Trees API
  async getFileTree(owner, repo, branch = 'main') {
    let activeBranch = branch;
    if (!activeBranch) {
      try {
        const info = await this.getRepoInfo(owner, repo);
        activeBranch = info.default_branch || 'main';
      } catch (e) {
        activeBranch = 'main';
      }
    }

    // Try target branch
    let url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`;
    let res = await fetch(url, { headers: this.getHeaders() });

    // Fallback to master if main fails
    if (!res.ok && activeBranch === 'main') {
      activeBranch = 'master';
      url = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
      res = await fetch(url, { headers: this.getHeaders() });
    }

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('GitHub API rate limit reached. Please add a GitHub Token in Settings.');
      }
      throw new Error(`Failed to load repository tree: HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      branch: activeBranch,
      tree: data.tree || [],
      truncated: data.truncated || false
    };
  }

  // Discover all SKILL.md files inside the repository tree
  discoverSkills(tree) {
    const skillFiles = [];
    for (const item of tree) {
      const baseName = (item.path || '').split('/').pop() || '';
      if (item.type === 'blob' && baseName.toLowerCase() === 'skill.md') {
        const parts = item.path.split('/');
        const dir = parts.slice(0, -1).join('/');
        const skillName = parts.length > 1 ? parts[parts.length - 2] : '';
        skillFiles.push({
          path: item.path,
          dir: dir,
          name: skillName,
          sha: item.sha,
          size: item.size
        });
      }
    }
    return skillFiles;
  }

  // Fetch raw file content directly from raw.githubusercontent.com (CORS enabled)
  async fetchRawFile(owner, repo, branch, path) {
    const encodedPath = String(path || '')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
    const res = await fetch(rawUrl);
    if (!res.ok) {
      throw new Error(`Failed to download "${path}" (HTTP ${res.status})`);
    }
    return res.text();
  }

  // Fallback: download ZIP archive and extract in-memory
  async fetchZipArchive(owner, repo, branch = 'main', onProgress = null) {
    if (onProgress) onProgress('Downloading repository archive...', 15);
    
    // List of mirror proxies in case direct CORS is blocked
    const proxyUrls = [
      `https://corsproxy.io/?url=https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
      `https://api.allorigins.win/raw?url=https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
      `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`
    ];

    let zipData = null;
    let lastError = null;

    for (const pUrl of proxyUrls) {
      try {
        const res = await fetch(pUrl);
        if (res.ok) {
          zipData = await res.arrayBuffer();
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!zipData) {
      throw new Error(`Failed to download zip archive: ${lastError?.message || 'Network blocked'}`);
    }

    if (onProgress) onProgress('Unpacking archive in WebAssembly memory...', 50);
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(zipData);
    return zip;
  }
}
