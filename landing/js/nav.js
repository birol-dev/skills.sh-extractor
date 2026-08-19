export function initNavActive() {
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
