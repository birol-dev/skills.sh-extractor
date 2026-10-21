import '../src/ui/basecoat.js';
import { initSkillsCatalog } from './js/skills-catalog.js';
import { initNavActive } from './js/nav.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initSkillsCatalog();
});
