# Skill Extractor & Playbook Compiler (WebAssembly)

A high-performance, **pure client-side WebAssembly (WASM) Single Page Application** designed to compile and manage reusable capability playbooks for AI coding agents (**Claude Code, Cursor, Windsurf, Antigravity, and GitHub Copilot**).

**Zero backend required** — all repository extraction, zip unpacking, fuzzy subdirectory resolution, YAML frontmatter parsing, script consolidation, token estimation, and Markdown generation run entirely in your browser using **WebAssembly** and modern Web APIs.

---

## ⚡ Key Features

- 🚀 **100% Pure Client-Side (No Backend Required)**: Runs entirely in modern web browsers. Deployable statically to GitHub Pages, Vercel, Cloudflare Pages, or Netlify.
- ⚡ **WebAssembly Acceleration Engine**: Custom compiled WASM binary module executing linear memory string normalization, fuzzy Levenshtein distance calculations, token estimation, and FNV-1a 32-bit hashing.
- 📦 **Consolidated Compilation Pipeline**:
  - Automatically parses `SKILL.md` frontmatter metadata and extracts core directives.
  - Formats all helper scripts inside deterministic code blocks (`## Consolidated Helper Scripts`).
  - Embeds reference documentation inside collapsible sections (`## Reference Documentation`).
- 🔗 **NPX Command & GitHub Parsing**: Accepts raw CLI statements (e.g. `npx skills add https://github.com/rknall/claude-skills --skill 'SVG Logo Designer'`), shorthand (`owner/repo`), branch URLs, or direct Git tree structures.
- 📁 **Multiple Input Modes**:
  - **GitHub / NPX**: Fetches directly from GitHub APIs with CORS support.
  - **Local Folder**: Scans local directories using the File System Access API and `<input webkitdirectory>`.
  - **ZIP Dropzone**: Drag-and-drop any `.zip` package to decompress in-memory via `JSZip`.
  - **Curated Skills Hub**: 1-Click instant test extract for top AI agent skills.
- 🔄 **Multi-Format Playbook Exporter**:
  - Standard `skills.sh` (`.skill.md`)
  - Claude Code (`CLAUDE.md`)
  - Cursor (`.cursorrules` / `.mdc`)
  - Windsurf (`.windsurfrules`)
  - Antigravity IDE (`.agents/skills/`)
- 🗂️ **Persistent Client Gallery (IndexedDB)**: Full offline-first storage with instant live search, tag filtering, token metrics, 1-click copy, and file download.
- 🫳 **Direct Drag-and-Drop Export**: Drag playbook handles directly onto your Desktop, code editors, or chat windows.
- 🎨 **Shadcn-Inspired Dark Zinc Aesthetic**: Glowing emerald accents, glassmorphic modals, live terminal logs, and responsive layout.

---

## 🏗️ Architecture

```
├── index.html                   # Main single-page web app entry
├── vite.config.js               # Vite static build configuration
├── package.json                 # Web dependencies (Vite, JSZip, js-yaml, marked, prismjs)
├── scripts/
│   └── build-wasm.js            # WebAssembly bytecode builder & test suite
└── src/
    ├── main.js                  # Application controller & event orchestrator
    ├── styles/
    │   └── main.css             # Shadcn-inspired dark zinc design system
    ├── wasm/
    │   ├── engine.wasm          # Compiled WebAssembly binary module
    │   └── wasmBinary.js        # Embedded base64 bytecode for instant zero-fetch loading
    └── services/
        ├── wasmEngine.js        # WebAssembly loader, interface & benchmark harness
        ├── github.js            # GitHub Git Trees API & raw content fetcher
        ├── extractor.js         # Core skill compilation and consolidation pipeline
        ├── storage.js           # IndexedDB persistence manager
        └── curatedSkills.js     # Catalog of curated popular agent skills
```

---

## 🛠️ Development & Building

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Build for Static Production Deployment
```bash
npm run build
```
The compiled, production-ready static assets will be in `dist/`.

---

## 📄 License

Distributed under the MIT License.
