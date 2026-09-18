/**
 * Pure helpers for skill-choice multi-select UI (filter, keys, gallery duplicate checks).
 */

/** Stable key for a skill entry from the extractor available list. */
export function skillChoiceKey(skill) {
  if (!skill) return '';
  return String(skill.name || skill.dir || skill.path || '').trim();
}

/** Case-insensitive alphanumeric normalize for duplicate matching. */
export function normalizeSkillToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Filter available skills by name / dir / path / description substring.
 * @param {Array} available
 * @param {string} query
 * @returns {Array}
 */
export function filterAvailableSkills(available, query) {
  const list = Array.isArray(available) ? available : [];
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list.slice();
  return list.filter((s) => {
    const name = (s.name || '').toLowerCase();
    const dir = (s.dir || '').toLowerCase();
    const path = (s.path || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    return name.includes(q) || dir.includes(q) || path.includes(q) || desc.includes(q);
  });
}

/**
 * Toggle a key in a selection array (immutable).
 * @param {string[]} selectedKeys
 * @param {string} key
 * @returns {string[]}
 */
export function toggleSelectionKey(selectedKeys, key) {
  if (!key) return Array.isArray(selectedKeys) ? selectedKeys.slice() : [];
  const set = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set];
}

/** Keys for every item in a filtered list. */
export function selectAllFilteredKeys(filtered) {
  return (filtered || []).map(skillChoiceKey).filter(Boolean);
}

/**
 * Detect if an available skill is already in the gallery (by source + name/slug/path).
 * @param {Array} gallerySkills
 * @param {object} availableSkill
 * @param {{ owner?: string, repo?: string, mode?: string }} ctx
 * @returns {object|null} matching gallery skill or null
 */
export function findGalleryDuplicate(gallerySkills, availableSkill, ctx = {}) {
  const gallery = Array.isArray(gallerySkills) ? gallerySkills : [];
  const key = skillChoiceKey(availableSkill);
  const keyNorm = normalizeSkillToken(key);
  const dirNorm = normalizeSkillToken(availableSkill?.dir);
  const pathNorm = normalizeSkillToken(availableSkill?.path);
  const sourceUrl =
    ctx.owner && ctx.repo ? `https://github.com/${ctx.owner}/${ctx.repo}` : '';

  return (
    gallery.find((s) => {
      if (sourceUrl && s.sourceUrl && s.sourceUrl !== sourceUrl) return false;
      // Local zip/folder: no sourceUrl constraint when ctx has none
      if (sourceUrl && !s.sourceUrl) return false;

      const nameNorm = normalizeSkillToken(s.name);
      const slugNorm = normalizeSkillToken(s.slug);
      const srcPathNorm = normalizeSkillToken(s.sourcePath);

      if (keyNorm && (nameNorm === keyNorm || slugNorm === keyNorm)) return true;
      if (dirNorm && (nameNorm === dirNorm || slugNorm === dirNorm || srcPathNorm.includes(dirNorm))) {
        return true;
      }
      if (pathNorm && srcPathNorm && (srcPathNorm === pathNorm || srcPathNorm.includes(pathNorm))) {
        return true;
      }
      return false;
    }) || null
  );
}

/**
 * Build selected-count label.
 * @param {number} count
 * @returns {string}
 */
export function formatSelectedCount(count) {
  const n = Number(count) || 0;
  if (n <= 0) return '0 selected';
  return `${n} selected`;
}
