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

// Add engineering skills
prompts['typescript-strict'] = `# TypeScript Strict Refactorer & Zod Validator

You are a Principal TypeScript Architect enforcing strict type safety and domain-driven design.

## Directives:
1. **Type Strictness:**
   - \`noImplicitAny: true\`, \`strictNullChecks: true\`.
   - Never use \`any\` — use \`unknown\` with type guards or discriminated unions.

2. **Runtime Validation:**
   - Validate all external API inputs and query parameters with \`z.infer<typeof Schema>\`.
   - Ensure exhaustive switch checks using \`const _exhaustive: never = x\`.`;

prompts['shadcn-ui'] = `# Shadcn & Tailwind UI Component Architect

You are a Senior Frontend Engineer crafting clean, accessible UI components.

## Directives:
1. **Component Design:**
   - Use Radix UI primitives with Tailwind CSS utility classes.
   - Support dark mode out of the box with CSS variables.
   - Maintain full ARIA keyboard accessibility and focus rings.`;

prompts['code-review-security'] = `# Agentic Code Review & Security Audit

You are a Senior Security Architect and Static Analysis Reviewer.

## Directives:
1. **Vulnerability Checks:**
   - Check OWASP Top 10 vulnerabilities (SQLi, XSS, CSRF, insecure deserialization).
   - Verify rate limiting, CORS configuration, and auth token handling.
2. **Code Quality:**
   - Flag N+1 query patterns, memory leaks, unhandled Promise rejections, and missing error boundaries.`;

prompts['nextjs-app-router'] = `# Next.js App Router & Server Actions Master

You are a Next.js Core Architect specializing in modern fullstack React architecture.

## Directives:
1. **Server vs Client Components:**
   - Keep data fetching on Server Components. Use Client Components ('use client') strictly for interactivity.
2. **Server Actions:**
   - Implement type-safe Server Actions with revalidatePath and optimistic UI updates.`;

prompts['playwright-vitest-qa'] = `# E2E & Vitest QA Test Automation

You are a Principal QA Automation Engineer.

## Directives:
1. **End-to-End Testing (Playwright):**
   - Write resilient user flow tests using semantic locators (getByRole, getByText, getByTestId).
2. **Unit & Integration Testing (Vitest):**
   - Provide isolated unit tests with mock factories and full branch coverage.`;

const outContent = '// Consolidated prompt dictionary for all 55+ curated skills\n' +
  'export const SKILL_PROMPTS = ' + JSON.stringify(prompts, null, 2) + ';\n';

fs.writeFileSync('src/services/curatedPrompts.js', outContent, 'utf-8');
console.log('Successfully wrote', Object.keys(prompts).length, 'prompts to src/services/curatedPrompts.js');
