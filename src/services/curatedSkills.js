// Curated catalog of top AI coding agent skills
export const CURATED_SKILLS = [
  {
    id: 'curated_svg_logo',
    name: 'SVG Logo Designer',
    category: 'Design & Visuals',
    badge: 'Design',
    description: 'Create professional SVG logos, brand marks, and icons from specifications with multiple variations.',
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'SVG Logo Designer'",
    sourceUrl: 'https://github.com/rknall/claude-skills',
    subdir: 'svg-logo-designer',
    tags: ['svg', 'logo', 'design', 'vector', 'branding'],
    icon: 'palette'
  },
  {
    id: 'curated_ts_refactor',
    name: 'TypeScript Strict Refactorer',
    category: 'Engineering',
    badge: 'TypeScript',
    description: 'Refactor JavaScript and loose TypeScript to strict type-safe code with zod schemas and generics.',
    command: 'npx skills add https://github.com/vercel/ai --skill typescript-strict',
    sourceUrl: 'https://github.com/vercel/ai',
    subdir: 'typescript-strict',
    tags: ['typescript', 'refactor', 'typesafe', 'zod'],
    icon: 'code'
  },
  {
    id: 'curated_shadcn_ui',
    name: 'Shadcn & Tailwind UI Wizard',
    category: 'Frontend',
    badge: 'Frontend',
    description: 'Assemble modern, high-converting interfaces using Radix primitives, Tailwind CSS, and Framer Motion.',
    command: 'npx skills add https://github.com/shadcn-ui/ui --skill react-components',
    sourceUrl: 'https://github.com/shadcn-ui/ui',
    subdir: 'react-components',
    tags: ['react', 'tailwind', 'shadcn', 'ui', 'css'],
    icon: 'layout'
  },
  {
    id: 'curated_code_review',
    name: 'Agentic Code Review & Security Audit',
    category: 'Security',
    badge: 'Security',
    description: 'Thorough static analysis, vulnerability detection (OWASP Top 10), and architecture compliance reviewer.',
    command: 'npx skills add https://github.com/goldbergyoni/nodebestpractices --skill security-audit',
    sourceUrl: 'https://github.com/goldbergyoni/nodebestpractices',
    subdir: 'security-audit',
    tags: ['security', 'audit', 'code-review', 'owasp'],
    icon: 'shield'
  },
  {
    id: 'curated_nextjs_architect',
    name: 'Next.js App Router Master',
    category: 'Fullstack',
    badge: 'Fullstack',
    description: 'Architect scalable Server Components, Server Actions, parallel routes, and cache optimizations in Next.js.',
    command: 'npx skills add https://github.com/vercel/next.js --skill app-router-expert',
    sourceUrl: 'https://github.com/vercel/next.js',
    subdir: 'app-router-expert',
    tags: ['nextjs', 'react', 'rsc', 'server-actions'],
    icon: 'layers'
  },
  {
    id: 'curated_sql_opt',
    name: 'PostgreSQL & Query Optimizer',
    category: 'Database',
    badge: 'Database',
    description: 'Design relational schemas, write optimal indexes, debug slow queries, and generate Prisma/Drizzle migrations.',
    command: 'npx skills add https://github.com/prisma/prisma --skill sql-performance',
    sourceUrl: 'https://github.com/prisma/prisma',
    subdir: 'sql-performance',
    tags: ['sql', 'postgres', 'database', 'prisma', 'indexing'],
    icon: 'database'
  },
  {
    id: 'curated_playwright_test',
    name: 'E2E Test Automation (Playwright & Vitest)',
    category: 'Testing',
    badge: 'Testing',
    description: 'Generate rock-solid end-to-end browser tests, unit test suites with mocking, and CI pipeline workflows.',
    command: 'npx skills add https://github.com/microsoft/playwright --skill test-generator',
    sourceUrl: 'https://github.com/microsoft/playwright',
    subdir: 'test-generator',
    tags: ['testing', 'playwright', 'vitest', 'automation', 'qa'],
    icon: 'check-circle'
  },
  {
    id: 'curated_prompt_engineer',
    name: 'System Prompt & Metaprompt Optimizer',
    category: 'AI & Prompts',
    badge: 'AI Prompts',
    description: 'Refine system prompts with XML tagging, few-shot examples, chain-of-thought triggers, and edge constraints.',
    command: 'npx skills add https://github.com/anthropics/anthropic-cookbook --skill metaprompt-optimizer',
    sourceUrl: 'https://github.com/anthropics/anthropic-cookbook',
    subdir: 'metaprompt-optimizer',
    tags: ['prompts', 'llm', 'system-prompts', 'metaprompt'],
    icon: 'cpu'
  }
];
