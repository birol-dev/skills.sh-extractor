import '../src/ui/basecoat.js';
import { initFaqAccordion } from './js/faq.js';
import { initNavActive } from './js/nav.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initFaqAccordion();
});
