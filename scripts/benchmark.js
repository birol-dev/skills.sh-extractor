import { performance } from 'perf_hooks';
import wasmEngine from '../src/services/wasmEngine.js';
import storage from '../src/services/storage.js';
import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { parseSkillMarkdown, compileSkillContent, sanitizeSlug } from '../src/services/extractor.js';

async function runBenchmarks() {
  console.log('==============================================');
  console.log('   SKILL EXTRACTOR PERFORMANCE BENCHMARKS     ');
  console.log('==============================================\n');

  await wasmEngine.ready();

  // 1. WASM vs JS Computational Benchmarks
  console.log('--- 1. Computation & Algorithm Benchmarks ---');
  const benchResult = wasmEngine.runBenchmark(10000);
  console.log(`Levenshtein (10,000 iterations):`);
  console.log(`  - WASM: ${benchResult.wasmTimeMs} ms`);
  console.log(`  - JS:   ${benchResult.jsTimeMs} ms`);
  console.log(`  - Speedup: ${benchResult.speedup}`);

  // Token estimation throughput
  const sampleDoc = CURATED_SKILLS.map(s => `# ${s.name}\n${s.description}\n`).join('\n').repeat(5);
  const tokenDocBytes = Buffer.byteLength(sampleDoc, 'utf8');
  const t0 = performance.now();
  const tokenIterations = 2000;
  for (let i = 0; i < tokenIterations; i++) {
    wasmEngine.estimateTokens(sampleDoc);
  }
  const tokenTimeMs = performance.now() - t0;
  const tokenThroughputMBs = ((tokenDocBytes * tokenIterations) / (1024 * 1024) / (tokenTimeMs / 1000)).toFixed(2);
  console.log(`Token Estimation Throughput:`);
  console.log(`  - Time for ${tokenIterations} runs (${(tokenDocBytes/1024).toFixed(1)} KB doc): ${tokenTimeMs.toFixed(2)} ms`);
  console.log(`  - Throughput: ${tokenThroughputMBs} MB/s`);

  // Fuzzy match search throughput across catalog
  const queries = ['copywriting', 'seo audit', 'logo designer', 'marketing', 'launch', 'not-found-xyz'];
  const t1 = performance.now();
  const searchIterations = 1000;
  let matchCount = 0;
  for (let i = 0; i < searchIterations; i++) {
    const q = queries[i % queries.length];
    for (const skill of CURATED_SKILLS) {
      if (wasmEngine.fuzzyMatch(q, skill.name) > 400) {
        matchCount++;
      }
    }
  }
  const searchTimeMs = performance.now() - t1;
  const searchOpsPerSec = Math.round((searchIterations * CURATED_SKILLS.length) / (searchTimeMs / 1000));
  console.log(`Fuzzy Search Catalog Throughput:`);
  console.log(`  - Time for ${searchIterations} full catalog searches (${CURATED_SKILLS.length} items each): ${searchTimeMs.toFixed(2)} ms`);
  console.log(`  - Comparisons/sec: ${searchOpsPerSec.toLocaleString()} ops/s`);

  // 2. Skill Parsing & Compilation Performance
  console.log('\n--- 2. Markdown Parsing & Playbook Compilation ---');
  const testSkillRaw = `---
name: Enterprise Growth & Viral Loops Engine
description: Deep comprehensive framework for growth loops, referral flywheels, and A/B testing
tags: [growth, marketing, viral, testing]
---
# Enterprise Growth Directives
You are a Principal Growth Architect.

## Consolidated Helper Scripts
### Script: \`scripts/calculate_k_factor.py\`
\`\`\`python
def calculate_k_factor(invites_sent, conversion_rate):
    return invites_sent * conversion_rate
\`\`\`

## Reference Documentation
### \`viral_framework.md\`
<details>
<summary>Reference Document: references/viral_framework.md (Click to expand)</summary>
Detailed virality models, organic referral mechanics, and coefficient formulas.
</details>
`;

  const t2 = performance.now();
  const parseIterations = 5000;
  for (let i = 0; i < parseIterations; i++) {
    const parsed = parseSkillMarkdown(testSkillRaw);
    compileSkillContent({
      name: 'Enterprise Growth',
      description: 'Growth framework',
      directives: parsed.directives,
      scripts: parsed.scripts,
      references: parsed.references,
      exportFormat: 'skill.md'
    });
  }
  const parseTimeMs = performance.now() - t2;
  console.log(`Parse & Compile 5,000 Playbooks:`);
  console.log(`  - Total Time: ${parseTimeMs.toFixed(2)} ms`);
  console.log(`  - Per Skill: ${(parseTimeMs / parseIterations).toFixed(4)} ms`);
  console.log(`  - Rate: ${Math.round(parseIterations / (parseTimeMs / 1000)).toLocaleString()} playbooks/sec`);

  // 3. Storage In-Memory Cache Performance
  console.log('\n--- 3. Storage Layer Access Latency ---');
  await storage.saveSkill({
    id: 'test_skill_1',
    name: 'Benchmarked Skill',
    slug: 'benchmarked-skill',
    compiledMarkdown: testSkillRaw
  });

  const t3 = performance.now();
  const storageIterations = 10000;
  for (let i = 0; i < storageIterations; i++) {
    await storage.getSkills();
  }
  const storageTimeMs = performance.now() - t3;
  console.log(`Storage Read Access (${storageIterations} lookups):`);
  console.log(`  - Total Time: ${storageTimeMs.toFixed(2)} ms`);
  console.log(`  - Per Read: ${(storageTimeMs / storageIterations * 1000).toFixed(2)} µs`);
  console.log(`  - Read Rate: ${Math.round(storageIterations / (storageTimeMs / 1000)).toLocaleString()} reads/sec`);

  console.log('\n==============================================\n');
}

runBenchmarks().catch(console.error);
