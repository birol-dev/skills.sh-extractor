import { escapeHtml } from '../services/skillCategories.js';

const CATEGORIES = new Set(['success', 'error', 'warning', 'info']);

/**
 * Shows a Basecoat toast in `#toaster`.
 * Basecoat inserts title/description as HTML, so both are escaped here.
 */
export function showToast(message, type = 'info', { description, duration } = {}) {
  const toaster = document.getElementById('toaster');
  if (!toaster) return;
  if (typeof toaster.toast !== 'function') window.basecoat?.init('toaster');
  toaster.toast?.({
    category: CATEGORIES.has(type) ? type : 'info',
    title: escapeHtml(message),
    description: description ? escapeHtml(description) : undefined,
    duration
  });
}
