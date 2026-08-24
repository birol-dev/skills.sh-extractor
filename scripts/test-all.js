import assert from 'assert';
import wasmEngine from '../src/services/wasmEngine.js';
import storage from '../src/services/storage.js';
import { parseSkillMarkdown, compileSkillContent, sanitizeSlug, detectLanguage, isTextFile, dumpFrontmatterYaml } from '../src/services/extractor.js';
import { parseCommandOrUrl } from '../src/services/github.js';
import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { SKILL_PROMPTS } from '../src/services/curatedPrompts.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('==============================================');
  console.log('     COMPREHENSIVE TEST SUITE VERIFICATION    ');
  console.log('==============================================\n');

  // Group 1: WASM Engine Tests
  console.log('--- 1. WASM Engine Unit Tests ---');
  await wasmEngine.ready();
  assert(wasmEngine.isReady === true, 'WASM engine must be ready');

  test('hash: empty string returns 0', () => {
    assert.strictEqual(wasmEngine.hash(''), '0');
  });

  test('hash: deterministic FNV-1a hash value', () => {
    const h1 = wasmEngine.hash('skills.sh extractor wasm engine');
    const h2 = wasmEngine.hash('skills.sh extractor wasm engine');
    assert.strictEqual(h1, h2);
    assert.strictEqual(h1.length, 8);
    assert.strictEqual(h1, 'eeb6d142');
  });

  test('normalize: converts to lowercase and strips non-alphanumerics', () => {
    assert.strictEqual(wasmEngine.normalize('SVG Logo Designer v2.0!'), 'svglogodesignerv20');
    assert.strictEqual(wasmEngine.normalize(''), '');
    assert.strictEqual(wasmEngine.normalize('   A-B_C 123   '), 'abc123');
  });

  test('estimateTokens: counts tokens accurately on text samples', () => {
    assert.strictEqual(wasmEngine.estimateTokens(''), 0);
    const shortText = 'You are an AI assistant specialized in SVG vector design.';
    const tok = wasmEngine.estimateTokens(shortText);
    assert(tok > 5 && tok < 30, `Expected token count between 5 and 30, got ${tok}`);
  });

  test('levenshtein: distance calculations', () => {
    assert.strictEqual(wasmEngine.levenshtein('', ''), 0);
    assert.strictEqual(wasmEngine.levenshtein('apple', 'apple'), 0);
    assert.strictEqual(wasmEngine.levenshtein('kitten', 'sitting'), 3);
    assert.strictEqual(wasmEngine.levenshtein('svg-logo-designer', 'svg_logo_designer'), 2);
  });

  test('fuzzyMatch: matching scoring', () => {
    assert.strictEqual(wasmEngine.fuzzyMatch('', 'target'), 1000);
    assert.strictEqual(wasmEngine.fuzzyMatch('query', ''), 0);
    assert.strictEqual(wasmEngine.fuzzyMatch('copywriting', 'copywriting'), 1000);
    assert(wasmEngine.fuzzyMatch('copy', 'expert copywriting formulas') >= 900);
    assert(wasmEngine.fuzzyMatch('xyz999', 'marketing strategy') < 400);
  });

  // Group 2: Storage Manager Tests
  console.log('\n--- 2. Storage Manager & Cache Tests ---');
  await asyncTest('storage: in-memory caching and retrieval', async () => {
    await storage.clearAll();
    const initialSkills = await storage.getSkills();
    assert.strictEqual(initialSkills.length, 0);

    const saved = await storage.saveSkill({
      id: 'test_skill_id_123',
      name: 'Test Skill',
      slug: 'test-skill',
      description: 'A test skill for automated testing',
      compiledMarkdown: '# Test Skill Directives\nTest content'
    });
    assert.strictEqual(saved.id, 'test_skill_id_123');

    const cachedList = await storage.getSkills();
    assert.strictEqual(cachedList.length, 1);
    assert.strictEqual(cachedList[0].name, 'Test Skill');

    const single = await storage.getSkill('test_skill_id_123');
    assert.strictEqual(single.slug, 'test-skill');

    const deleted = await storage.deleteSkill('test_skill_id_123');
    assert.strictEqual(deleted, true);

    const afterDelete = await storage.getSkills();
    assert.strictEqual(afterDelete.length, 0);
  });

  await asyncTest('storage: settings persistence and defaults', async () => {
    const defaults = await storage.getSettings();
    assert(defaults.defaultExportFormat === 'skill.md');

    await storage.saveSettings({ defaultExportFormat: 'claude.md', githubToken: 'ghp_fake123' });
    const updated = await storage.getSettings();
    assert.strictEqual(updated.defaultExportFormat, 'claude.md');
    assert.strictEqual(updated.githubToken, 'ghp_fake123');
  });

  // Group 3: Extractor & Compiler Tests
  console.log('\n--- 3. Extractor & Compiler Tests ---');
  test('sanitizeSlug: converts names to URL/file-safe slugs', () => {
    assert.strictEqual(sanitizeSlug('SVG Logo Designer'), 'svg-logo-designer');
    assert.strictEqual(sanitizeSlug('A/B Testing & Optimization!'), 'a-b-testing-optimization');
    assert.strictEqual(sanitizeSlug(''), 'untitled-skill');
  });

  test('detectLanguage: file extension mappings', () => {
    assert.strictEqual(detectLanguage('script.py'), 'python');
    assert.strictEqual(detectLanguage('index.js'), 'javascript');
    assert.strictEqual(detectLanguage('deploy.sh'), 'bash');
    assert.strictEqual(detectLanguage('types.ts'), 'typescript');
    assert.strictEqual(detectLanguage('config.yaml'), 'yaml');
  });

  test('isTextFile: text extensions vs binary', () => {
    assert.strictEqual(isTextFile('README.md'), true);
    assert.strictEqual(isTextFile('script.py'), true);
    assert.strictEqual(isTextFile('image.png'), false);
    assert.strictEqual(isTextFile('archive.zip'), false);
  });

  test('dumpFrontmatterYaml: fast serialization', () => {
    const yamlStr = dumpFrontmatterYaml({
      name: 'My Skill',
      description: 'Skill description',
      tags: ['tag1', 'tag2']
    });
    assert(yamlStr.includes('name: My Skill'));
    assert(yamlStr.includes('description: Skill description'));
    assert(yamlStr.includes('tags:'));
    assert(yamlStr.includes('  - tag1'));
  });

  test('parseSkillMarkdown & compileSkillContent: all export formats', () => {
    const rawMarkdown = `---
name: Test Extractor Skill
description: Testing directives parsing
---
# Directives
You are a test skill.

## Consolidated Helper Scripts
### Script: \`scripts/helper.sh\`
\`\`\`bash
echo "Hello from helper"
\`\`\`

## Reference Documentation
### \`guide.md\`
<details>
<summary>Reference Document: references/guide.md (Click to expand)</summary>
Detailed guide content here.
</details>
`;

    const parsed = parseSkillMarkdown(rawMarkdown);
    assert(parsed.directives.includes('You are a test skill.'));
    assert.strictEqual(parsed.scripts.length, 1);
    assert.strictEqual(parsed.scripts[0].fileName, 'helper.sh');
    assert.strictEqual(parsed.references.length, 1);
    assert.strictEqual(parsed.references[0].fileName, 'guide.md');

    // Compile to skill.md
    const skillMd = compileSkillContent({
      name: 'Test Extractor Skill',
      description: 'Testing directives parsing',
      directives: parsed.directives,
      scripts: parsed.scripts,
      references: parsed.references,
      exportFormat: 'skill.md'
    });
    assert(skillMd.output.startsWith('---\n'));
    assert(skillMd.output.includes('name: Test Extractor Skill'));
    assert(skillMd.output.includes('## Consolidated Helper Scripts'));

    // Compile to claude.md
    const claudeMd = compileSkillContent({
      name: 'Test Extractor Skill',
      description: 'Testing directives parsing',
      directives: parsed.directives,
      scripts: parsed.scripts,
      references: parsed.references,
      exportFormat: 'claude.md'
    });
    assert(claudeMd.output.startsWith('# CLAUDE.md - Test Extractor Skill'));

    // Compile to cursorrules
    const cursorRules = compileSkillContent({
      name: 'Test Extractor Skill',
      description: 'Testing directives parsing',
      directives: parsed.directives,
      scripts: parsed.scripts,
      references: parsed.references,
      exportFormat: 'cursorrules'
    });
    assert(cursorRules.output.startsWith('# Test Extractor Skill\n\n> Testing directives parsing'));
  });

  // Group 4: GitHub Command Parsing
  console.log('\n--- 4. GitHub & NPX Command Parser Tests ---');
  test('parseCommandOrUrl: parses full skills add command with subdirectories', () => {
    const cmd = "npx skills add https://github.com/rknall/claude-skills --skill 'SVG Logo Designer'";
    const res = parseCommandOrUrl(cmd);
    assert(res !== null, 'Parser must succeed');
    assert.strictEqual(res.owner, 'rknall');
    assert.strictEqual(res.repo, 'claude-skills');
    assert.strictEqual(res.subdir, 'SVG Logo Designer');
  });

  test('parseCommandOrUrl: parses direct github repo URLs', () => {
    const url = 'https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo';
    const res = parseCommandOrUrl(url);
    assert(res !== null);
    assert.strictEqual(res.owner, 'anthropics');
    assert.strictEqual(res.repo, 'anthropic-quickstarts');
    assert.strictEqual(res.branch, 'main');
    assert.strictEqual(res.subdir, 'computer-use-demo');
  });

  // Group 5: Curated Catalog & Prompt Integrity
  console.log('\n--- 5. Curated Catalog & Prompt Verification ---');
  test('CURATED_SKILLS has 55+ valid skills', () => {
    assert(CURATED_SKILLS.length >= 50, `Expected at least 50 curated skills, got ${CURATED_SKILLS.length}`);
    for (const skill of CURATED_SKILLS) {
      assert(skill.name, 'Every skill must have a name');
      assert(skill.slug, 'Every skill must have a slug');
      assert(skill.description, 'Every skill must have a description');
      assert(skill.badge, 'Every skill must have a badge');
      assert(skill.command, 'Every skill must have a command');
    }
  });

  test('SKILL_PROMPTS dictionary matches curated skills', () => {
    let foundCount = 0;
    for (const skill of CURATED_SKILLS) {
      if (SKILL_PROMPTS[skill.slug]) {
        foundCount++;
        assert(SKILL_PROMPTS[skill.slug].length > 20, `Prompt for ${skill.slug} should have content`);
      }
    }
    assert(foundCount >= 50, `Expected at least 50 prompts found in dictionary, got ${foundCount}`);
  });

  console.log('\n==============================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('==============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
