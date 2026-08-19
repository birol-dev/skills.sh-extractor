// Core Client-Side Skill Extractor & Compiler Engine
import yaml from 'js-yaml';
import JSZip from 'jszip';
import wasmEngine from './wasmEngine.js';
import storage from './storage.js';
import { GitHubFetcher, parseCommandOrUrl } from './github.js';
import { CURATED_SKILLS } from './curatedSkills.js';
import { SKILL_PROMPTS } from './curatedPrompts.js';

export function sanitizeSlug(name) {
  if (!name) return 'untitled-skill';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function detectLanguage(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash';
    case 'py':
    case 'python':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'ps1':
    case 'psm1':
      return 'powershell';
    case 'bat':
    case 'cmd':
      return 'batch';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'sql':
      return 'sql';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    default:
      return '';
  }
}

export function isTextFile(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const textExtensions = [
    'md', 'txt', 'sh', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'yml', 'yaml',
    'ps1', 'bat', 'cmd', 'rb', 'go', 'rs', 'sql', 'html', 'css', 'env', 'toml',
    'xml', 'csv', 'dockerfile', 'gitignore', 'editorconfig', ''
  ];
  return textExtensions.includes(ext) || !filename.includes('.');
}

export function parseSkillMarkdown(content) {
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
    const scriptRegex = /### Script:\s+`scripts\/(.+?)`[\s\S]*?```\w*\r?\n([\s\S]*?)```/g;
    let match;
    while ((match = scriptRegex.exec(scriptsSection)) !== null) {
      scripts.push({
        fileName: match[1],
        language: detectLanguage(match[1]),
        code: match[2].trim()
      });
    }
  }

  const references = [];
  if (referencesSection) {
    const refRegex = /###\s+`(.+?)`[\s\S]*?<details>[\s\S]*?<summary>([\s\S]*?)<\/summary>\r?\n+([\s\S]*?)\r?\n+<\/details>/g;
    let match;
    while ((match = refRegex.exec(referencesSection)) !== null) {
      references.push({
        fileName: match[1],
        summary: match[2].trim(),
        content: match[3].trim()
      });
    }
  }

  return {
    yamlStr,
    directives,
    scripts,
    references
  };
}

export function compileSkillContent({ name, description, frontmatter = {}, directives = '', scripts = [], references = [], customTags = '', exportFormat = 'skill.md' }) {
  const cleanName = frontmatter.name || name || 'Untitled Skill';
  const cleanDesc = frontmatter.description || description || 'No description provided';
  const slug = sanitizeSlug(cleanName);

  // Merge extra tags
  let tags = [];
  if (frontmatter.tags) {
    tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
  }
  if (customTags) {
    const extra = customTags.split(',').map(t => t.trim()).filter(Boolean);
    tags = [...new Set([...tags, ...extra])];
  }

  const finalFrontmatter = {
    name: cleanName,
    description: cleanDesc,
    ...frontmatter,
    tags: tags.length > 0 ? tags : undefined
  };

  // Build scripts section
  let scriptsContent = '';
  if (scripts.length > 0) {
    scriptsContent += `\n\n---\n\n## Consolidated Helper Scripts\n`;
    scriptsContent += `*These auxiliary helper scripts were extracted from the skill package structure to run deterministic tasks.*\n`;
    for (const script of scripts) {
      const lang = script.language || detectLanguage(script.fileName);
      scriptsContent += `\n### Script: \`scripts/${script.fileName}\`\n\n\`\`\`${lang}\n${script.code}\n\`\`\`\n`;
    }
  }

  // Build references section
  let referencesContent = '';
  if (references.length > 0) {
    referencesContent += `\n\n---\n\n## Reference Documentation\n`;
    referencesContent += `*This contextual reference material was extracted from the skill package structure to provide guidelines and rule parameters.*\n`;
    for (const ref of references) {
      const summaryText = `Reference Document: references/${ref.fileName}`;
      referencesContent += `\n### \`${ref.fileName}\`\n\n`;
      referencesContent += `<details>\n`;
      referencesContent += `<summary>${summaryText} (Click to expand)</summary>\n\n`;
      
      const ext = (ref.fileName.split('.').pop() || '').toLowerCase();
      if (ext === 'md') {
        referencesContent += ref.content;
      } else {
        const lang = detectLanguage(ref.fileName);
        referencesContent += `\`\`\`${lang}\n${ref.content}\n\`\`\``;
      }
      
      referencesContent += `\n\n</details>\n`;
    }
  }

  // Format based on chosen target format
  if (exportFormat === 'cursorrules' || exportFormat === 'mdc') {
    let output = `# ${cleanName}\n\n`;
    output += `> ${cleanDesc}\n\n`;
    if (tags.length > 0) {
      output += `**Tags**: ${tags.join(', ')}\n\n`;
    }
    output += `## Directives\n\n${directives}`;
    output += scriptsContent;
    output += referencesContent;
    return { output, slug, name: cleanName, description: cleanDesc, tags };
  }

  if (exportFormat === 'claude.md') {
    let output = `# CLAUDE.md - ${cleanName}\n\n`;
    output += `${cleanDesc}\n\n`;
    output += `## Instructions & Directives\n\n${directives}`;
    output += scriptsContent;
    output += referencesContent;
    return { output, slug, name: cleanName, description: cleanDesc, tags };
  }

  // Standard .skill.md
  let output = `---\n`;
  output += yaml.dump(finalFrontmatter, { lineWidth: -1 });
  output += `---\n\n`;
  output += directives;
  output += scriptsContent;
  output += referencesContent;

  return { output, slug, name: cleanName, description: cleanDesc, tags };
}

export class SkillExtractor {
  constructor() {
    this.wasm = wasmEngine;
  }

  // 1. Extract from GitHub URL or NPX Command
  async extractFromGitHub({ input, subdirOverride = '', onProgress = () => {} }) {
    await this.wasm.ready();
    const settings = await storage.getSettings();
    const fetcher = new GitHubFetcher(settings.githubToken);

    onProgress('Parsing repository input command...', 5);
    const parsed = parseCommandOrUrl(input);
    if (!parsed || !parsed.owner || !parsed.repo) {
      throw new Error('Invalid GitHub repository input. Format: owner/repo, full URL, or npx skills add command.');
    }

    const { owner, repo, branch: specifiedBranch, subdir: parsedSubdir } = parsed;
    const targetSubdir = subdirOverride || parsedSubdir || '';

    onProgress(`Fetching file tree for ${owner}/${repo}...`, 15);
    let branch = specifiedBranch;
    let tree = null;
    let allSkills = [];

    try {
      const treeRes = await fetcher.getFileTree(owner, repo, specifiedBranch);
      branch = treeRes.branch;
      tree = treeRes.tree;
      onProgress('Scanning tree for skill packages...', 30);
      allSkills = fetcher.discoverSkills(tree);
    } catch (fetchErr) {
      console.warn('GitHub tree fetch encountered an issue:', fetchErr);
      // Check if we have an offline pre-compiled playbook for this skill
      const fallbackMatch = CURATED_SKILLS.find(s => 
        s.slug === targetSubdir || 
        (targetSubdir && s.name.toLowerCase().includes(targetSubdir.toLowerCase())) ||
        input.includes(s.slug)
      );

      if (fallbackMatch && SKILL_PROMPTS[fallbackMatch.slug]) {
        onProgress(`Compiling pre-cached playbook for "${fallbackMatch.name}"...`, 60);
        const directives = SKILL_PROMPTS[fallbackMatch.slug];
        const { output: compiledMarkdown, slug, tags } = compileSkillContent({
          name: fallbackMatch.name,
          description: fallbackMatch.description,
          frontmatter: { name: fallbackMatch.name, description: fallbackMatch.description },
          directives,
          scripts: [],
          references: [],
          customTags: settings.defaultTags,
          exportFormat: settings.defaultExportFormat || 'skill.md'
        });

        const tokenEstimate = this.wasm.estimateTokens(compiledMarkdown);
        const hash = this.wasm.hash(compiledMarkdown);

        const savedSkill = await storage.saveSkill({
          name: fallbackMatch.name,
          slug,
          description: fallbackMatch.description,
          metadata: { name: fallbackMatch.name, description: fallbackMatch.description },
          directives,
          scripts: [],
          references: [],
          compiledMarkdown,
          sourceType: 'curated-cache',
          sourceUrl: fallbackMatch.sourceUrl || `https://github.com/${owner}/${repo}`,
          sourcePath: fallbackMatch.subdir || targetSubdir,
          tokenEstimate,
          hash,
          tags
        });

        onProgress('Skill extracted and compiled successfully from curated database!', 100);
        return savedSkill;
      }
      throw fetchErr;
    }

    if (allSkills.length === 0) {
      throw new Error(`No SKILL.md file found in ${owner}/${repo}`);
    }

    // Resolve target skill using WASM fuzzy search
    let targetSkillFile = null;
    if (targetSubdir) {
      const normTarget = this.wasm.normalize(targetSubdir);
      
      // Try exact folder match first
      targetSkillFile = allSkills.find(s => {
        const normDir = this.wasm.normalize(s.dir);
        return normDir === normTarget || normDir.endsWith(normTarget);
      });

      // Fuzzy matching via WASM
      if (!targetSkillFile) {
        let bestScore = -1;
        for (const s of allSkills) {
          const score = this.wasm.fuzzyMatch(targetSubdir, s.dir || s.name);
          if (score > bestScore && score > 300) {
            bestScore = score;
            targetSkillFile = s;
          }
        }
      }

      if (!targetSkillFile) {
        onProgress(`Target "${targetSubdir}" not matched, using first detected skill (${allSkills[0].name})...`, 40);
        targetSkillFile = allSkills[0];
      }
    } else {
      targetSkillFile = allSkills[0];
    }

    onProgress(`Selected skill: ${targetSkillFile.name} (at ${targetSkillFile.dir || 'root'})`, 45);
    const skillBaseDir = targetSkillFile.dir;

    // Fetch SKILL.md
    onProgress('Downloading SKILL.md...', 55);
    const skillMdRaw = await fetcher.fetchRawFile(owner, repo, branch, targetSkillFile.path);

    // Scan for scripts and references in tree
    const scriptsPrefix = skillBaseDir ? `${skillBaseDir}/scripts/` : 'scripts/';
    const refsPrefix = skillBaseDir ? `${skillBaseDir}/references/` : 'references/';

    const scriptItems = tree.filter(t => t.type === 'blob' && t.path.startsWith(scriptsPrefix) && isTextFile(t.path));
    const refItems = tree.filter(t => t.type === 'blob' && t.path.startsWith(refsPrefix) && isTextFile(t.path));

    // Download scripts
    const scripts = [];
    if (scriptItems.length > 0) {
      onProgress(`Downloading ${scriptItems.length} helper scripts...`, 65);
      for (const item of scriptItems) {
        const fileName = item.path.substring(scriptsPrefix.length);
        if (fileName && !fileName.includes('/')) {
          try {
            const code = await fetcher.fetchRawFile(owner, repo, branch, item.path);
            scripts.push({
              fileName,
              language: detectLanguage(fileName),
              code: code.trim()
            });
          } catch (e) {
            console.warn(`Failed to fetch script ${item.path}:`, e);
          }
        }
      }
    }

    // Download references
    const references = [];
    if (refItems.length > 0) {
      onProgress(`Downloading ${refItems.length} reference documents...`, 80);
      for (const item of refItems) {
        const fileName = item.path.substring(refsPrefix.length);
        if (fileName && !fileName.includes('/')) {
          try {
            const content = await fetcher.fetchRawFile(owner, repo, branch, item.path);
            references.push({
              fileName,
              summary: `Reference Document: references/${fileName}`,
              content: content.trim()
            });
          } catch (e) {
            console.warn(`Failed to fetch reference ${item.path}:`, e);
          }
        }
      }
    }

    // Parse Frontmatter and Compile
    onProgress('Parsing frontmatter and consolidating playbook...', 90);
    let frontmatter = {};
    let directives = skillMdRaw;

    const yamlMatch = skillMdRaw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (yamlMatch) {
      try {
        frontmatter = yaml.load(yamlMatch[1]) || {};
        directives = skillMdRaw.substring(yamlMatch[0].length).trim();
      } catch (e) {
        console.warn('YAML parsing warning:', e);
      }
    }

    const skillName = frontmatter.name || targetSkillFile.name || repo;
    const skillDesc = frontmatter.description || 'No description provided';

    const { output: compiledMarkdown, slug, tags } = compileSkillContent({
      name: skillName,
      description: skillDesc,
      frontmatter,
      directives,
      scripts,
      references,
      customTags: settings.defaultTags,
      exportFormat: settings.defaultExportFormat || 'skill.md'
    });

    onProgress('Estimating tokens and computing hash in WebAssembly...', 95);
    const tokenEstimate = this.wasm.estimateTokens(compiledMarkdown);
    const hash = this.wasm.hash(compiledMarkdown);

    const savedSkill = await storage.saveSkill({
      name: skillName,
      slug,
      description: skillDesc,
      metadata: frontmatter,
      directives,
      scripts,
      references,
      compiledMarkdown,
      sourceType: 'github',
      sourceUrl: `https://github.com/${owner}/${repo}`,
      sourcePath: targetSkillFile.path,
      tokenEstimate,
      hash,
      tags
    });

    onProgress('Skill extracted and compiled successfully!', 100);
    return savedSkill;
  }

  // 2. Extract from Zip File (Blob / ArrayBuffer)
  async extractFromZip(zipFile, { subdirOverride = '', onProgress = () => {} }) {
    await this.wasm.ready();
    const settings = await storage.getSettings();

    onProgress('Loading and decompressing ZIP archive...', 20);
    const zip = await JSZip.loadAsync(zipFile);

    onProgress('Searching archive for SKILL.md...', 40);
    const zipEntries = Object.keys(zip.files);
    
    // Find all SKILL.md entries
    const skillEntries = [];
    for (const path of zipEntries) {
      if (!zip.files[path].dir && path.toLowerCase().endsWith('skill.md')) {
        const parts = path.split('/');
        const dir = parts.slice(0, -1).join('/');
        const name = parts.length > 1 ? parts[parts.length - 2] : 'root';
        skillEntries.push({ path, dir, name });
      }
    }

    if (skillEntries.length === 0) {
      throw new Error('No SKILL.md found in the provided ZIP archive');
    }

    // Resolve target
    let targetEntry = skillEntries[0];
    if (subdirOverride) {
      const normTarget = this.wasm.normalize(subdirOverride);
      targetEntry = skillEntries.find(s => this.wasm.normalize(s.dir).includes(normTarget)) || skillEntries[0];
    }

    onProgress(`Found target skill at ${targetEntry.path}`, 60);
    const skillMdRaw = await zip.files[targetEntry.path].async('text');
    const baseDir = targetEntry.dir;

    // Scan scripts & references
    const scripts = [];
    const references = [];

    const scriptsPrefix = baseDir ? `${baseDir}/scripts/` : 'scripts/';
    const refsPrefix = baseDir ? `${baseDir}/references/` : 'references/';

    for (const path of zipEntries) {
      if (zip.files[path].dir) continue;
      
      if (path.startsWith(scriptsPrefix)) {
        const fileName = path.substring(scriptsPrefix.length);
        if (fileName && !fileName.includes('/') && isTextFile(fileName)) {
          const code = await zip.files[path].async('text');
          scripts.push({ fileName, language: detectLanguage(fileName), code: code.trim() });
        }
      } else if (path.startsWith(refsPrefix)) {
        const fileName = path.substring(refsPrefix.length);
        if (fileName && !fileName.includes('/') && isTextFile(fileName)) {
          const content = await zip.files[path].async('text');
          references.push({ fileName, summary: `Reference Document: references/${fileName}`, content: content.trim() });
        }
      }
    }

    onProgress('Compiling skill playbook...', 85);
    let frontmatter = {};
    let directives = skillMdRaw;

    const yamlMatch = skillMdRaw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (yamlMatch) {
      try {
        frontmatter = yaml.load(yamlMatch[1]) || {};
        directives = skillMdRaw.substring(yamlMatch[0].length).trim();
      } catch (e) {}
    }

    const skillName = frontmatter.name || targetEntry.name || 'Extracted Zip Skill';
    const skillDesc = frontmatter.description || 'Extracted from ZIP archive';

    const { output: compiledMarkdown, slug, tags } = compileSkillContent({
      name: skillName,
      description: skillDesc,
      frontmatter,
      directives,
      scripts,
      references,
      customTags: settings.defaultTags,
      exportFormat: settings.defaultExportFormat || 'skill.md'
    });

    const tokenEstimate = this.wasm.estimateTokens(compiledMarkdown);
    const hash = this.wasm.hash(compiledMarkdown);

    const savedSkill = await storage.saveSkill({
      name: skillName,
      slug,
      description: skillDesc,
      metadata: frontmatter,
      directives,
      scripts,
      references,
      compiledMarkdown,
      sourceType: 'local',
      sourceUrl: 'Local ZIP',
      sourcePath: targetEntry.path,
      tokenEstimate,
      hash,
      tags
    });

    onProgress('Skill extracted and compiled successfully from ZIP!', 100);
    return savedSkill;
  }

  // 3. Extract from Local Folder (Files list from webkitdirectory or File System API)
  async extractFromFolder(files, { onProgress = () => {} }) {
    await this.wasm.ready();
    const settings = await storage.getSettings();

    onProgress(`Scanning ${files.length} files in local folder...`, 20);
    
    // Find SKILL.md
    let skillFile = null;
    for (const file of files) {
      const relPath = file.webkitRelativePath || file.name;
      if (relPath.toLowerCase().endsWith('skill.md')) {
        skillFile = file;
        break;
      }
    }

    if (!skillFile) {
      throw new Error('Could not find SKILL.md in the selected local folder');
    }

    const skillMdRaw = await skillFile.text();
    const relPath = skillFile.webkitRelativePath || skillFile.name;
    const baseDir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';

    const scriptsPrefix = baseDir ? `${baseDir}/scripts/` : 'scripts/';
    const refsPrefix = baseDir ? `${baseDir}/references/` : 'references/';

    const scripts = [];
    const references = [];

    for (const file of files) {
      const fPath = file.webkitRelativePath || file.name;
      if (fPath.startsWith(scriptsPrefix)) {
        const fileName = fPath.substring(scriptsPrefix.length);
        if (fileName && !fileName.includes('/') && isTextFile(fileName)) {
          const code = await file.text();
          scripts.push({ fileName, language: detectLanguage(fileName), code: code.trim() });
        }
      } else if (fPath.startsWith(refsPrefix)) {
        const fileName = fPath.substring(refsPrefix.length);
        if (fileName && !fileName.includes('/') && isTextFile(fileName)) {
          const content = await file.text();
          references.push({ fileName, summary: `Reference Document: references/${fileName}`, content: content.trim() });
        }
      }
    }

    onProgress('Parsing and compiling local skill...', 80);
    let frontmatter = {};
    let directives = skillMdRaw;

    const yamlMatch = skillMdRaw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (yamlMatch) {
      try {
        frontmatter = yaml.load(yamlMatch[1]) || {};
        directives = skillMdRaw.substring(yamlMatch[0].length).trim();
      } catch (e) {}
    }

    const skillName = frontmatter.name || (baseDir ? baseDir.split('/').pop() : 'Local Skill');
    const skillDesc = frontmatter.description || 'Extracted from local directory';

    const { output: compiledMarkdown, slug, tags } = compileSkillContent({
      name: skillName,
      description: skillDesc,
      frontmatter,
      directives,
      scripts,
      references,
      customTags: settings.defaultTags,
      exportFormat: settings.defaultExportFormat || 'skill.md'
    });

    const tokenEstimate = this.wasm.estimateTokens(compiledMarkdown);
    const hash = this.wasm.hash(compiledMarkdown);

    const savedSkill = await storage.saveSkill({
      name: skillName,
      slug,
      description: skillDesc,
      metadata: frontmatter,
      directives,
      scripts,
      references,
      compiledMarkdown,
      sourceType: 'local',
      sourceUrl: 'Local Directory',
      sourcePath: relPath,
      tokenEstimate,
      hash,
      tags
    });

    onProgress('Local skill compiled and saved successfully!', 100);
    return savedSkill;
  }
}

export const extractor = new SkillExtractor();
export default extractor;
