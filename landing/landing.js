import '../src/ui/basecoat.js';
import { initShader } from './js/shader.js';
import { initHeroWidget } from './js/hero-widget.js';
import { initSkillsCatalog } from './js/skills-catalog.js';
import { initFaqAccordion } from './js/faq.js';
import { initNavActive } from './js/nav.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initShader();
  initHeroWidget();
  initSkillsCatalog();
  initFaqAccordion();
});
