# skills.sh Extractor

A premium, open-source **Electron Application** designed to compile and manage reusable capability playbooks for AI coding agents (such as **Claude Code, Cursor, Windsurf, Codex CLI, and GitHub Copilot**).

It downloads multi-file skill packages from GitHub or loads them from your local machine, extracts the rules, consolidates auxiliary helper scripts and reference files, and compiles them into a **single, self-contained Markdown (`.md`) file**. The application features an interactive gallery and native OS-level **drag-and-drop exporting** to drop playbooks directly into your code editors or system workspace.

---

## Key Features

- 📦 **Consolidated Compilation**: Bundles metadata frontmatter, `SKILL.md` directives, text-based scripts in `scripts/`, and documentation in `references/` into a single, highly readable `.md` file.
- 🔗 **NPX Command Parsing**: Accepts raw CLI statements (e.g. `npx skills add https://github.com/rknall/claude-skills --skill 'SVG Logo Designer'`), extracts repository parameters, and targets specific skill sub-folders.
- 📁 **Fuzzy Subdirectory Resolver**: Employs alphanumeric name normalization to recursive directory scans, mapping custom spaced inputs (like `'SVG Logo Designer'`) to target folders (like `svg-logo-designer`) automatically.
- ⚙️ **Persistent Configurations**: A dedicated settings panel allows customizing output directory locations, prefilling metadata tags, and toggling post-extraction actions (such as opening the save directory in File Explorer).
- 🗂️ **Interactive Gallery**: Manage extracted playbooks with live searching and dynamic previews. Clicking preview renders direct tabs for **Directives**, **Frontmatter**, **Scripts code panels**, and **References**.
- 🫳 **Fileless OS Drag-and-Drop**: Drag cards or handles from the UI to drop the compiled playbook `.md` file directly onto your Desktop, File Explorer, or IDE chat window.
- 🎨 **Shadcn-Inspired Interface**: Clean, minimalist dark zinc aesthetic with customized outlines, vector SVG assets, and interactive progress logs.

---

## How It Works: Compilation Pipeline

1. **Fetch**: Clones/downloads a GitHub repository archive via the GitHub API (with automated main/master branch fallbacks) or scans a local folder path.
2. **Scoping**: Resolves targeted subdirectories recursively to isolate specific skills in monorepo structures.
3. **Consolidation**:
   - Locates `SKILL.md`, parses its YAML frontmatter, and extracts the core directives.
   - Appends all text-based helper scripts inside formatting blocks (`## Consolidated Helper Scripts`).
   - Embeds documentation files inside collapsible HTML details elements (`## Reference Documentation`).
4. **Purge**: Cleans up all downloaded ZIP files and temporary unzipped source folders, saving only the final compiled `.md` playbook.

---

## Installation & Setup

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/skill-extractor.git
cd skill-extractor
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run the Application

```bash
npm start
```

---

## Project Structure

```
├── main.js                  # Electron main process (IPC handlers, downloader, unzipper, compiler)
├── preload.js               # IPC preload bridge securely exposing API modules to the renderer
├── index.html               # Main dashboard HTML (sidebar tabs, terminal logs, modal views)
├── styles.css               # Vanilla CSS stylesheet containing the shadcn design palette
├── renderer/
│   └── app.js               # Renderer script (UI routing, search filters, HTML renders, command parser)
├── package.json             # Package scripts and manifest definitions
└── README.md                # Project documentation
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
