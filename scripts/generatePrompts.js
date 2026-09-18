import fs from 'fs';
import path from 'path';

const skillsDir = path.resolve('.agents/skills');
const dirs = fs.readdirSync(skillsDir);
const prompts = {};

for (const dir of dirs) {
  const skillFile = path.join(skillsDir, dir, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    let content = fs.readFileSync(skillFile, 'utf-8');
    // Remove frontmatter
    content = content.replace(/^---\r?\n[\s\S]+?\r?\n---\r?\n/, '').trim();
    prompts[dir] = content;
  }
}

// Add engineering skills (real skills.sh names — offline cache stubs)
prompts['ai-sdk'] = `# ai-sdk

Answer questions about the AI SDK and help build AI-powered features.

## Guidance
- Prefer current AI SDK docs over training memory; APIs change frequently.
- Cover generateText, streamText, tools, agents, embeddings, and useChat patterns.
- Verify provider options against the installed package version.`;

prompts['shadcn'] = `# shadcn

Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI.

## Guidance
- Use the project's package runner with \`shadcn@latest\`.
- Respect components.json and registry/preset conventions.
- Prefer composing existing components over inventing parallel primitives.`;

prompts['next-dev-loop'] = `# next-dev-loop

Verify Next.js runtime behavior after editing app code — not just compile/type-check success.

## Guidance
- Requires a running \`next dev\`.
- Combine /_next/mcp (framework view) with agent-browser (browser view).
- Confirm the change works on the live route before declaring done.`;

prompts['playwright-dev'] = `# playwright-dev

Explains how to develop Playwright — add APIs, MCP tools, CLI commands, and vendor dependencies.

## Guidance
- Follow monorepo build/test/lint conventions.
- Prefer semantic locators and stable assertions in examples.
- Keep API/docs/tests in sync when changing surface area.`;

const outContent = '// Consolidated prompt dictionary for all 55+ curated skills\n' +
  'export const SKILL_PROMPTS = ' + JSON.stringify(prompts, null, 2) + ';\n';

fs.writeFileSync('src/services/curatedPrompts.js', outContent, 'utf-8');
console.log('Successfully wrote', Object.keys(prompts).length, 'prompts to src/services/curatedPrompts.js');
