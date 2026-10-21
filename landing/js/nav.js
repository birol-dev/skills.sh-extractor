export function initNavActive() {
  const navbar = document.getElementById('mainNavbar');
  const toggle = navbar?.querySelector('.nav-menu-btn');
  toggle?.addEventListener('click', () => {
    const open = navbar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  const page = document.body?.dataset?.page;
  if (!page) return;

  document.querySelectorAll('.nav-link[data-nav]').forEach((link) => {
    if (link.dataset.nav === page) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}
