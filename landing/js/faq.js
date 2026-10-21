/** FAQ markup is a Basecoat accordion; this remains so existing page entrypoints stay valid. */
export function initFaqAccordion() {
  document.querySelectorAll('.accordion').forEach((root) => {
    window.basecoat?.refresh(root);
  });
}
