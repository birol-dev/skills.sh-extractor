/**
 * SVG serializers for Lucide icon nodes and Simple Icons brand marks.
 * Pure string functions: shared by the build-time HTML plugin (Node) and the browser bundle.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeAttrs(attrs) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([key, value]) => (value === true ? key : `${key}="${escapeAttr(value)}"`))
    .join(' ');
}

function a11yAttrs(label) {
  return label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
}

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function kebabToPascal(name) {
  return String(name)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Lucide IconNode (`[tag, attrs][]`) to an inline SVG string. */
export function lucideSvg(iconNode, name, { size = 16, strokeWidth = 2, className = '', label = '', attrs = {} } = {}) {
  const children = iconNode.map(([tag, childAttrs]) => `<${tag} ${serializeAttrs(childAttrs)}/>`).join('');
  return `<svg ${serializeAttrs({
    xmlns: SVG_NS,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: joinClasses('lucide', `lucide-${name}`, className),
    ...a11yAttrs(label),
    ...attrs
  })}>${children}</svg>`;
}

/** Simple Icons entry (`{ slug, path }`) to an inline SVG string. */
export function brandSvg(icon, { size = 16, className = '', label = '', attrs = {} } = {}) {
  return `<svg ${serializeAttrs({
    xmlns: SVG_NS,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    class: joinClasses('brand-icon', `brand-${icon.slug}`, className),
    ...a11yAttrs(label),
    ...attrs
  })}><path d="${escapeAttr(icon.path)}"/></svg>`;
}
