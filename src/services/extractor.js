// Core Client-Side Skill Extractor & Compiler Engine
import wasmEngine from './wasmEngine.js';
import storage from './storage.js';
import { GitHubFetcher, parseCommandOrUrl } from './github.js';
import yaml from 'js-yaml';
import { CURATED_SKILLS } from './curatedSkills.js';
import { SKILL_PROMPTS } from './curatedPrompts.js';

export class SkillNotFoundError extends Error {
  constructor({ requested = null, owner = '', repo = '', available = [] } = {}) {
    const label = requested ? `"${requested}"` : 'a skill';
    const where = owner && repo ? ` in ${owner}/${repo}` : '';
    super(`Skill ${label} not found${where}. Pick one of the available skills.`);
    this.name = 'SkillNotFoundError';
    this.code = 'SKILL_NOT_FOUND';
    this.requested = requested ?? null;
    this.owner = owner || '';
    this.repo = repo || '';
    this.available = Array.isArray(available) ? available : [];
  }
}

export function formatAvailableSkills(skills = []) {
  return skills.map(s => ({
    name: s.name || (s.dir ? s.dir.split('/').filter(Boolean).pop() : '') || 'unnamed',
    dir: s.dir || '',
    path: s.path || ''
  }));
}

/** Exact match only: normalized dir/name equality or endsWith (no fuzzy). */
export function isExactSkillMatch(skill, target, normalizeFn) {
  if (!target || !skill || typeof normalizeFn !== 'function') return false;
  const normTarget = normalizeFn(target);
  if (!normTarget) return false;
  const normDir = normalizeFn(skill.dir || '');
  const normName = normalizeFn(skill.name || '');
  if (normName === normTarget || normDir === normTarget) return true;
  if (normDir && (normDir.endsWith(normTarget) || normName.endsWith(normTarget))) return true;
  return false;
}

export function resolveTargetSkill(allSkills, targetSubdir, { owner = '', repo = '', normalizeFn } = {}) {
  const skills = Array.isArray(allSkills) ? allSkills : [];
  const available = formatAvailableSkills(skills);

  if (targetSubdir) {
    const exact = skills.find(s => isExactSkillMatch(s, targetSubdir, normalizeFn));
    if (exact) return exact;
    throw new SkillNotFoundError({ requested: targetSubdir, owner, repo, available });
  }

  if (skills.length === 1) return skills[0];
  if (skills.length === 0) {
    throw new Error(owner && repo ? `No SKILL.md file found in ${owner}/${repo}` : 'No SKILL.md found');
  }
  throw new SkillNotFoundError({ requested: null, owner, repo, available });
}

export function dumpFrontmatterYaml(obj) {

  return yaml.dump(obj, {
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true
  });
}

export function sanitizeSlug(name) {
  if (!name) return 'untitled-skill';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'untitled-skill';
}

export function extractFallbackDescription(directives) {
  if (!directives || typeof directives !== 'string') return 'No description provided';
  const lines = directives.split(/\r?\n/);
  const paraLines = [];
  let inPara = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inPara) break;
      continue;
    }
    // Skip headings, horizontal rules, code blocks, HTML tags, blockquotes, list markers
    if (trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('```') || trimmed.startsWith('<') || trimmed.startsWith('>') || trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (inPara) break;
      continue;
    }
    inPara = true;
    paraLines.push(trimmed);
  }
  const text = paraLines.join(' ').trim();
  if (text && text.length > 5) {
    return text.length > 250 ? text.substring(0, 247) + '...' : text;
  }
  return 'No description provided';
}

function fallbackYamlExtract(yamlStr) {
  const result = {};
  if (!yamlStr || typeof yamlStr !== 'string') return result;

  // 1. Extract name
  const nameMatch = yamlStr.match(/^name:\s*(?:['"]([^'"]+)['"]|([^\r\n#]+))/m);
  if (nameMatch) {
    const val = (nameMatch[1] || nameMatch[2] || '').trim();
    if (val && val.toLowerCase() !== 'root' && val !== 'untitled-skill') {
      result.name = val;
    }
  }

  // 2. Extract description (multiline block scalar | or > or single line)
  const blockDescMatch = yamlStr.match(/^description:\s*[|>]-?\s*[\r\n]+([\s\S]+?)(?=(?:[\r\n]+[a-zA-Z0-9_-]+:)|$)/m);
  if (blockDescMatch) {
    result.description = blockDescMatch[1]
      .split(/\r?\n/)
      .map(l => l.replace(/^\s{2,4}/, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  } else {
    const singleDescMatch = yamlStr.match(/^description:\s*(?:['"]([\s\S]*?)['"]|([^\r\n]+))/m);
    if (singleDescMatch) {
      result.description = (singleDescMatch[1] || singleDescMatch[2] || '').trim();
    }
  }

  // 3. Extract license
  const licMatch = yamlStr.match(/^license:\s*(?:['"]([^'"]+)['"]|([^\r\n#]+))/m);
  if (licMatch) {
    result.license = (licMatch[1] || licMatch[2] || '').trim();
  }

  return result;
}

export function parseFrontmatter(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { frontmatter: {}, directives: '', yamlStr: '' };
  }

  // Strip UTF-8 Byte Order Mark (BOM)
  let content = rawContent.replace(/^\uFEFF/, '');

  let yamlStr = '';
  let directives = content;

  // Pattern 1: Fenced with --- or ...
  // Handles optional leading whitespace/newlines before opening ---
  // Handles optional trailing whitespace on opening ---
  // Handles closing --- or ... with optional trailing whitespace
  const fencedRegex = /^\s*---\s*[\r\n]+([\s\S]*?)[\r\n]+(?:---|\.\.\.)\s*(?:$|[\r\n]+)/;
  const match = content.match(fencedRegex);

  if (match) {
    yamlStr = match[1];
    directives = content.substring(match[0].length).trim();
  } else {
    // Pattern 2: Unfenced YAML block at the start of the file
    // e.g. starting directly with name: or description: before the first markdown heading or rule
    const unfencedHeaderMatch = content.match(/^\s*(name:\s*[\s\S]*?)(?=[\r\n]+#+\s+|[\r\n]+---|\s*$)/);
    if (unfencedHeaderMatch) {
      yamlStr = unfencedHeaderMatch[1];
      directives = content.substring(unfencedHeaderMatch[0].length).trim();
    }
  }

  let frontmatter = {};
  if (yamlStr.trim()) {
    try {
      const parsed = yaml.load(yamlStr);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed;
      } else if (parsed !== undefined && parsed !== null) {
        console.warn('Ignoring SKILL.md frontmatter because it must be a YAML mapping.');
      }
    } catch (error) {
      // Fallback regex extractor will recover core fields from malformed YAML
    }

    // Apply regex fallback for missing or corrupted core fields
    const fallback = fallbackYamlExtract(yamlStr);
    if (!frontmatter.name && fallback.name) {
      frontmatter.name = fallback.name;
    }
    if (!frontmatter.description && fallback.description) {
      frontmatter.description = fallback.description;
    }
    if (!frontmatter.license && fallback.license) {
      frontmatter.license = fallback.license;
    }
  }

  // Ensure directives does NOT retain leading frontmatter text
  if (directives) {
    directives = directives.replace(/^\s*---\s*[\r\n]+[\s\S]*?[\r\n]+(?:---|\.\.\.)\s*[\r\n]*/, '');
    directives = directives.replace(/^\s*name:\s*[^\r\n]*[\r\n]+(?:description:\s*[\s\S]*?[\r\n]+(?=#|\r?\n\r?\n))?/, '');
    directives = directives.trim();
  }

  return {
    frontmatter,
    directives,
    yamlStr
  };
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
  const { frontmatter, directives: cleanDirectives, yamlStr } = parseFrontmatter(content);
  let rest = cleanDirectives;

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
    frontmatter,
    yamlStr,
    directives,
    scripts,
    references
  };
}

export function compileSkillContent({ name, description, frontmatter = {}, directives = '', scripts = [], references = [], customTags = '', exportFormat = 'skill.md' }) {
  const normalizedFrontmatter = frontmatter && typeof frontmatter === 'object' && !Array.isArray(frontmatter)
    ? frontmatter
    : {};

  // Clean directives from any leading frontmatter block to prevent duplication or leak into rendered body
  let cleanDirectives = String(directives || '').trim();
  if (cleanDirectives) {
    cleanDirectives = cleanDirectives.replace(/^\s*---\s*[\r\n]+[\s\S]*?[\r\n]+(?:---|\.\.\.)\s*[\r\n]*/, '');
    cleanDirectives = cleanDirectives.replace(/^\s*name:\s*[^\r\n]*[\r\n]+(?:description:\s*[\s\S]*?[\r\n]+(?=#|\r?\n\r?\n))?/, '');
    cleanDirectives = cleanDirectives.trim();
  }

  // Derive intelligent name fallback if name is 'root', 'untitled-skill', or missing
  let rawName = normalizedFrontmatter.name || name;
  if (!rawName || rawName.toLowerCase() === 'root' || rawName === 'untitled-skill') {
    const headingMatch = cleanDirectives.match(/^#\s+([^\r\n]+)/m);
    if (headingMatch) {
      rawName = headingMatch[1].trim();
    } else {
      rawName = 'Untitled Skill';
    }
  }
  const cleanName = String(rawName);

  // Derive intelligent description fallback if description is missing
  let rawDesc = normalizedFrontmatter.description || description;
  if (!rawDesc || rawDesc === 'No description provided') {
    const fallbackDesc = extractFallbackDescription(cleanDirectives);
    if (fallbackDesc && fallbackDesc !== 'No description provided') {
      rawDesc = fallbackDesc;
    } else {
      rawDesc = 'No description provided';
    }
  }
  const cleanDesc = String(rawDesc);
  const slug = sanitizeSlug(cleanName);

  // Merge extra tags
  let tags = [];
  if (normalizedFrontmatter.tags) {
    tags = Array.isArray(normalizedFrontmatter.tags) ? normalizedFrontmatter.tags : [normalizedFrontmatter.tags];
  }
  if (customTags) {
    const extra = customTags.split(',').map(t => t.trim()).filter(Boolean);
    tags = [...new Set([...tags, ...extra])];
  }
  tags = tags.map(tag => String(tag).trim()).filter(Boolean);

  const finalFrontmatter = {
    ...normalizedFrontmatter,
    name: cleanName,
    description: cleanDesc,
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
  if (exportFormat === 'cursorrules' || exportFormat === 'mdc' || exportFormat === 'windsurfrules') {
    let output = `# ${cleanName}\n\n`;
    output += `> ${cleanDesc}\n\n`;
    if (tags.length > 0) {
      output += `**Tags**: ${tags.join(', ')}\n\n`;
    }
    output += `## Directives\n\n${cleanDirectives}`;
    output += scriptsContent;
    output += referencesContent;
    return { output, slug, name: cleanName, description: cleanDesc, tags };
  }

  if (exportFormat === 'claude.md') {
    let output = `# CLAUDE.md - ${cleanName}\n\n`;
    output += `${cleanDesc}\n\n`;
    output += `## Instructions & Directives\n\n${cleanDirectives}`;
    output += scriptsContent;
    output += referencesContent;
    return { output, slug, name: cleanName, description: cleanDesc, tags };
  }

  // Standard .skill.md
  let output = `---\n`;
  output += dumpFrontmatterYaml(finalFrontmatter);
  output += `---\n\n`;
  output += cleanDirectives;
  output += scriptsContent;
  output += referencesContent;

  return { output, slug, name: cleanName, description: cleanDesc, tags };
}

export class SkillExtractor {
  constructor() {
    this.wasm = wasmEngine;
  }

  // 1. Extract from GitHub URL or NPX Command
  async extractFromGitHub({ input, subdirOverride = '', onProgress = () => {} } = {}) {
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

    // Fail-closed: exact match only — never fuzzy-auto-select or silently take [0]
    const targetSkillFile = resolveTargetSkill(allSkills, targetSubdir, {
      owner,
      repo,
      normalizeFn: (v) => this.wasm.normalize(v)
    });

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
    const { frontmatter, directives } = parseFrontmatter(skillMdRaw);

    let skillName = frontmatter.name;
    if (!skillName || skillName.toLowerCase() === 'root' || skillName === 'untitled-skill') {
      const headingMatch = directives.match(/^#\s+([^\r\n]+)/m);
      if (headingMatch) {
        skillName = headingMatch[1].trim();
      } else if (targetSkillFile.name && targetSkillFile.name.toLowerCase() !== 'root') {
        skillName = targetSkillFile.name;
      } else {
        skillName = repo || 'Untitled Skill';
      }
    }

    let skillDesc = frontmatter.description;
    if (!skillDesc || skillDesc === 'No description provided') {
      const extractedDesc = extractFallbackDescription(directives);
      skillDesc = extractedDesc !== 'No description provided' ? extractedDesc : 'No description provided';
    }

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
  async extractFromZip(zipFile, { subdirOverride = '', onProgress = () => {} } = {}) {
    await this.wasm.ready();
    const settings = await storage.getSettings();

    onProgress('Loading and decompressing ZIP archive...', 20);
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(zipFile);

    onProgress('Searching archive for SKILL.md...', 40);
    const zipEntries = Object.keys(zip.files);
    
    // Find all SKILL.md entries
    const skillEntries = [];
    for (const path of zipEntries) {
      const baseName = path.split('/').pop() || '';
      if (!zip.files[path].dir && baseName.toLowerCase() === 'skill.md') {
        const parts = path.split('/');
        const dir = parts.slice(0, -1).join('/');
        const name = parts.length > 1 ? parts[parts.length - 2] : '';
        skillEntries.push({ path, dir, name });
      }
    }

    if (skillEntries.length === 0) {
      throw new Error('No SKILL.md found in the provided ZIP archive');
    }

    // Fail-closed: exact match only — never fuzzy or silent [0] when ambiguous
    const targetEntry = resolveTargetSkill(skillEntries, subdirOverride, {
      owner: 'local',
      repo: 'zip',
      normalizeFn: (v) => this.wasm.normalize(v)
    });

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
    const { frontmatter, directives } = parseFrontmatter(skillMdRaw);

    let skillName = frontmatter.name;
    if (!skillName || skillName.toLowerCase() === 'root' || skillName === 'untitled-skill') {
      const headingMatch = directives.match(/^#\s+([^\r\n]+)/m);
      if (headingMatch) {
        skillName = headingMatch[1].trim();
      } else if (targetEntry.name && targetEntry.name.toLowerCase() !== 'root') {
        skillName = targetEntry.name;
      } else {
        skillName = 'Extracted Zip Skill';
      }
    }

    let skillDesc = frontmatter.description;
    if (!skillDesc || skillDesc === 'No description provided' || skillDesc === 'Extracted from ZIP archive') {
      const extractedDesc = extractFallbackDescription(directives);
      skillDesc = extractedDesc !== 'No description provided' ? extractedDesc : (frontmatter.description || 'Extracted from ZIP archive');
    }

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
  async extractFromFolder(files, { subdirOverride = '', onProgress = () => {} } = {}) {
    await this.wasm.ready();
    const settings = await storage.getSettings();

    onProgress(`Scanning ${files.length} files in local folder...`, 20);

    // Discover all SKILL.md files
    const skillFiles = [];
    for (const file of files) {
      const relPath = file.webkitRelativePath || file.name;
      const baseName = relPath.split('/').pop() || file.name;
      if (baseName.toLowerCase() === 'skill.md') {
        const parts = relPath.split('/');
        const dir = parts.slice(0, -1).join('/');
        const name = parts.length > 1 ? parts[parts.length - 2] : '';
        skillFiles.push({ file, path: relPath, dir, name });
      }
    }

    if (skillFiles.length === 0) {
      throw new Error('Could not find SKILL.md in the selected local folder');
    }

    const targetSkill = resolveTargetSkill(skillFiles, subdirOverride, {
      owner: 'local',
      repo: 'folder',
      normalizeFn: (v) => this.wasm.normalize(v)
    });

    const skillFile = targetSkill.file;
    const skillMdRaw = await skillFile.text();
    const relPath = targetSkill.path;
    const baseDir = targetSkill.dir || '';

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
    const { frontmatter, directives } = parseFrontmatter(skillMdRaw);

    let skillName = frontmatter.name;
    if (!skillName || skillName.toLowerCase() === 'root' || skillName === 'untitled-skill') {
      const headingMatch = directives.match(/^#\s+([^\r\n]+)/m);
      if (headingMatch) {
        skillName = headingMatch[1].trim();
      } else if (baseDir && baseDir.split('/').pop().toLowerCase() !== 'root') {
        skillName = baseDir.split('/').pop();
      } else {
        skillName = 'Local Skill';
      }
    }

    let skillDesc = frontmatter.description;
    if (!skillDesc || skillDesc === 'No description provided' || skillDesc === 'Extracted from local directory') {
      const extractedDesc = extractFallbackDescription(directives);
      skillDesc = extractedDesc !== 'No description provided' ? extractedDesc : (frontmatter.description || 'Extracted from local directory');
    }

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
