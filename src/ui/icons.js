import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  CodeXml,
  Compass,
  Copy,
  Cpu,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FileText,
  FolderOpen,
  GripVertical,
  House,
  KeyRound,
  LayoutGrid,
  Library,
  LoaderCircle,
  Menu,
  Mail,
  Package,
  Palette,
  PenLine,
  PenTool,
  Play,
  Plus,
  Search,
  SearchX,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Trash2,
  TrendingUp,
  Upload,
  Wrench,
  X,
  Zap
} from 'lucide';
import { siGithub, siClaude, siCursor, siWindsurf, siGithubcopilot } from 'simple-icons';
import { brandSvg, lucideSvg } from './svg.js';

// Icons rendered from JS at runtime, plus the static placeholders hydrated below.
const ICONS = {
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'badge-dollar-sign': BadgeDollarSign,
  'book-open': BookOpen,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'clipboard-paste': ClipboardPaste,
  'code-xml': CodeXml,
  compass: Compass,
  copy: Copy,
  cpu: Cpu,
  download: Download,
  eye: Eye,
  'file-archive': FileArchive,
  'file-code': FileCode,
  'file-text': FileText,
  'folder-open': FolderOpen,
  'grip-vertical': GripVertical,
  house: House,
  'key-round': KeyRound,
  'layout-grid': LayoutGrid,
  library: Library,
  'loader-circle': LoaderCircle,
  menu: Menu,
  mail: Mail,
  package: Package,
  palette: Palette,
  'pen-line': PenLine,
  'pen-tool': PenTool,
  play: Play,
  plus: Plus,
  search: Search,
  'search-x': SearchX,
  send: Send,
  settings: Settings,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  'square-terminal': SquareTerminal,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  upload: Upload,
  wrench: Wrench,
  x: X,
  zap: Zap
};

const BRANDS = {
  github: siGithub,
  claude: siClaude,
  cursor: siCursor,
  windsurf: siWindsurf,
  githubcopilot: siGithubcopilot
};

export function icon(name, options) {
  const node = ICONS[name];
  if (!node) {
    console.warn(`[icons] "${name}" is not registered in src/ui/icons.js`);
    return '';
  }
  return lucideSvg(node, name, options);
}

export function brandIcon(slug, options) {
  const entry = BRANDS[slug];
  if (!entry) {
    console.warn(`[icons] brand "${slug}" is not registered in src/ui/icons.js`);
    return '';
  }
  return brandSvg(entry, options);
}

const ATTR_RE = /([^\s="]+)="([^"]*)"/g;

function optionsFromElement(el) {
  const attrs = Object.fromEntries([...el.outerHTML.matchAll(ATTR_RE)].map(([, key, value]) => [key, value]));
  const {
    'data-lucide': _lucide,
    'data-brand': _brand,
    'data-size': size,
    'data-stroke': strokeWidth,
    class: className,
    'aria-label': label,
    ...rest
  } = attrs;
  return {
    size: size ? Number(size) : undefined,
    strokeWidth: strokeWidth ? Number(strokeWidth) : undefined,
    className,
    label,
    attrs: rest
  };
}

/** Replaces `<i data-lucide>` / `<i data-brand>` placeholders left in static markup. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-lucide], i[data-brand]').forEach((el) => {
    const html = el.dataset.lucide
      ? icon(el.dataset.lucide, optionsFromElement(el))
      : brandIcon(el.dataset.brand, optionsFromElement(el));
    if (html) el.outerHTML = html;
  });
}
