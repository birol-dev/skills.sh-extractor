// Workbench preferences that only shape the UI (greeting, suggestions, gallery layout).
// Skills and export settings stay in IndexedDB via services/storage.js.
const KEY = 'skillExtractor.prefs';

const DEFAULTS = {
  libraryName: '',
  tool: '',
  interests: [],
  galleryLayout: 'cards',
  onboarded: false,
  personalized: false,
  setupHidden: false
};

export const GALLERY_LAYOUTS = ['cards', 'list', 'compact', 'timeline'];

// The export format that suits each AI tool picked during onboarding.
export const TOOL_FORMATS = {
  claude: 'claude.md',
  chatgpt: 'skill.md',
  cursor: 'cursorrules',
  windsurf: 'windsurfrules',
  copilot: 'skill.md',
  antigravity: 'skill.md'
};

export const FORMAT_LABELS = {
  'skill.md': '.skill.md',
  'claude.md': 'CLAUDE.md',
  cursorrules: '.cursorrules',
  windsurfrules: '.windsurfrules'
};

export function getPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the UI still works for this visit.
  }
  return next;
}
