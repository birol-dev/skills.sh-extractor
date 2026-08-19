/**
 * skills.sh Extractor — Landing Page Application Script
 * Features:
 *  - Interactive Monotone WebGL Shader with mouse reactivity
 *  - Live Hero Mini-Extractor Widget with 1-click prompt compiler
 *  - Dynamic 55+ Curated Skills Library with instant preview & copy
 *  - Category filtering across all disciplines
 *  - FAQ Accordions & Toast Notifications
 */

import { CURATED_SKILLS } from '../src/services/curatedSkills.js';
import { SKILL_PROMPTS } from '../src/services/curatedPrompts.js';

document.addEventListener('DOMContentLoaded', () => {
  initShader();
  initHeroWidget();
  initSkillsCatalog();
  initFaqAccordion();
});

/* ==========================================================================
   1. Interactive Monotone WebGL Shader
   ========================================================================== */
function initShader() {
  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    initCanvas2DFallback(canvas);
    return;
  }

  // Vertex Shader
  const vsSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Fragment Shader: Monochromatic Fluid Waves & Dynamic Grain
  const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_time;

    // Pseudo-random hash
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    // 2D Smooth Noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    // Fractional Brownian Motion
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

      // Mouse influence
      vec2 mouseNorm = (u_mouse.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      float distToMouse = length(st - mouseNorm);
      float mouseWave = smoothstep(0.4, 0.0, distToMouse) * 0.25;

      float t = u_time * 0.12;

      // Layered FBM distortion
      vec2 q = vec2(fbm(st + vec2(0.0, t)), fbm(st + vec2(5.2, 1.3)));
      vec2 r = vec2(fbm(st + 4.0 * q + vec2(1.7 - t * 0.15, 9.2)), fbm(st + 4.0 * q + vec2(8.3, 2.8 + t * 0.1)));

      float f = fbm(st + 3.0 * r + mouseWave);

      // Monotone curve shaping
      float intensity = smoothstep(0.1, 0.9, f);
      intensity = pow(intensity, 2.2);

      // Subtle monochromatic color gradations
      vec3 color = mix(vec3(0.035, 0.035, 0.045), vec3(0.12, 0.12, 0.15), intensity);
      color += vec3(0.85, 0.85, 0.95) * pow(intensity, 4.0) * 0.45;

      // Fine film grain
      float grain = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.035;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Shader compile failed: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) {
    initCanvas2DFallback(canvas);
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Program link error: ' + gl.getProgramInfoLog(program));
    initCanvas2DFallback(canvas);
    return;
  }

  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, 'position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
  const timeLocation = gl.getUniformLocation(program, 'u_time');

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0,
  ]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  let mouseX = window.innerWidth * 0.5;
  let mouseY = window.innerHeight * 0.5;
  let targetMouseX = mouseX;
  let targetMouseY = mouseY;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = e.clientX;
    targetMouseY = window.innerHeight - e.clientY;
  }, { passive: true });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  let startTime = performance.now();
  let isRendering = true;

  document.addEventListener('visibilitychange', () => {
    isRendering = !document.hidden;
    if (isRendering) requestAnimationFrame(render);
  });

  function render() {
    if (!isRendering) return;

    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    const currentTime = (performance.now() - startTime) * 0.001;

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(mouseLocation, mouseX * (canvas.width / window.innerWidth), mouseY * (canvas.height / window.innerHeight));
    gl.uniform1f(timeLocation, currentTime);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function initCanvas2DFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  let step = 0;
  function draw() {
    step += 0.005;
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    const spacing = 60;
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath();
      for (let y = 0; y < canvas.height; y += 10) {
        const offset = Math.sin(y * 0.01 + step + x * 0.005) * 15;
        if (y === 0) ctx.moveTo(x + offset, y);
        else ctx.lineTo(x + offset, y);
      }
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/* ==========================================================================
   2. Live Hero Mini-Extractor Widget
   ========================================================================== */
function initHeroWidget() {
  const input = document.getElementById('widgetSkillInput');
  const extractBtn = document.getElementById('widgetExtractBtn');
  const outputPanel = document.getElementById('widgetOutputPanel');
  const outputBadge = document.getElementById('outputBadge');
  const outputSkillName = document.getElementById('outputSkillName');
  const outputTokens = document.getElementById('outputTokens');
  const outputCode = document.getElementById('outputCodeSnippet');
  const copyPromptBtn = document.getElementById('widgetCopyPromptBtn');
  const presetTabs = document.querySelectorAll('.preset-tab');

  if (!input || !extractBtn) return;

  let activeSlug = 'copywriting';

  function renderHeroSkill(slug, animate = true) {
    const item = CURATED_SKILLS.find(s => s.slug === slug) || CURATED_SKILLS[0];
    const prompt = SKILL_PROMPTS[slug] || `# ${item.name}\n\n${item.description}`;
    activeSlug = slug;

    if (animate) {
      extractBtn.classList.add('loading');
      outputPanel.style.opacity = '0.5';
    }

    setTimeout(() => {
      input.value = item.command;
      outputBadge.textContent = item.badge.toUpperCase();
      outputSkillName.textContent = item.name;
      const tok = item.tokenEstimate || Math.round(prompt.length / 4);
      outputTokens.textContent = `~${tok.toLocaleString()} tokens`;
      outputCode.textContent = prompt;

      extractBtn.classList.remove('loading');
      outputPanel.style.opacity = '1';

      presetTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.skill === slug);
      });
    }, animate ? 200 : 0);
  }

  // Initial render
  renderHeroSkill('copywriting', false);

  // Preset tabs click
  presetTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const skillSlug = tab.dataset.skill;
      renderHeroSkill(skillSlug, true);
    });
  });

  // Redirection to Compiler App with Query Parameter
  function redirectToEngine(val) {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      showToast('Please enter a GitHub repository or skills command', 'info');
      return;
    }
    const targetUrl = new URL('/app/', window.location.origin);
    targetUrl.searchParams.set('extract', trimmed);
    window.location.href = targetUrl.toString();
  }

  // Extract button click -> redirects to compiler app
  extractBtn.addEventListener('click', (e) => {
    e.preventDefault();
    redirectToEngine(input.value);
  });

  // Enter key on input -> redirects to compiler app
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      redirectToEngine(input.value);
    }
  });

  // Copy prompt button click
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
      const promptText = SKILL_PROMPTS[activeSlug] || outputCode.textContent;
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('Copied prompt! Ready to paste into Claude, ChatGPT, or Cursor.', 'success');
      }).catch(() => {
        showToast('Copy failed, please select and copy manually.', 'error');
      });
    });
  }
}

/* ==========================================================================
   3. Skills Showcase Catalog & Filter (55+ Curated Skills)
   ========================================================================== */
function initSkillsCatalog() {
  const tabs = document.querySelectorAll('.catalog-tab');
  const grid = document.getElementById('skillsGrid');
  const modal = document.getElementById('skillPreviewModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalOpenInAppBtn = document.getElementById('modalOpenInAppBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalCategoryBadge = document.getElementById('modalCategoryBadge');
  const modalDescription = document.getElementById('modalDescription');
  const modalTokens = document.getElementById('modalTokens');
  const modalPromptCode = document.getElementById('modalPromptCode');

  let currentModalSkill = null;

  function getCategoryKey(cat) {
    if (!cat) return 'other';
    const c = cat.toLowerCase();
    if (c.includes('copywriting')) return 'copywriting';
    if (c.includes('marketing') || c.includes('growth')) return 'marketing';
    if (c.includes('design') || c.includes('visual')) return 'design';
    if (c.includes('sales') || c.includes('outbound')) return 'sales';
    if (c.includes('seo') || c.includes('search')) return 'seo';
    if (c.includes('monetization') || c.includes('offer') || c.includes('pricing')) return 'monetization';
    if (c.includes('strategy') || c.includes('operations') || c.includes('revops') || c.includes('research')) return 'strategy';
    if (c.includes('engineering') || c.includes('code') || c.includes('dev')) return 'dev';
    return 'other';
  }

  function renderGrid(filterCat = 'all') {
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = CURATED_SKILLS.filter(s => {
      if (filterCat === 'all') return true;
      return getCategoryKey(s.category) === filterCat;
    });

    filtered.forEach(s => {
      const prompt = SKILL_PROMPTS[s.slug] || `# ${s.name}\n\n${s.description}`;
      const tok = s.tokenEstimate || Math.round(prompt.length / 4);
      const catKey = getCategoryKey(s.category);

      const card = document.createElement('div');
      card.className = 'skill-card';
      card.dataset.category = catKey;
      card.dataset.skillId = s.slug;

      card.innerHTML = `
        <div class="card-ambient-overlay"></div>
        <div class="skill-card-header">
          <div class="skill-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div class="skill-meta-right">
            <span class="skill-category-name">${escapeHtml(s.badge.toUpperCase())}</span>
            <span class="skill-token-count">~${tok.toLocaleString()} tok</span>
          </div>
        </div>
        <h3 class="skill-card-title">${escapeHtml(s.name)}</h3>
        <p class="skill-card-desc">${escapeHtml(s.description)}</p>
        <div class="skill-card-actions">
          <button type="button" class="btn btn-card-preview skill-btn-preview" data-preview-id="${s.slug}">View Prompt</button>
          <button type="button" class="btn btn-primary btn-card-copy skill-btn-copy" data-copy-id="${s.slug}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
      `;

      card.querySelector('.skill-btn-preview').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(s.slug);
      });

      card.querySelector('.skill-btn-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(prompt).then(() => {
          showToast(`Copied "${s.name}" prompt!`, 'success');
        });
      });

      grid.appendChild(card);
    });
  }

  // Initial Grid Render
  renderGrid('all');

  // Filter Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category || 'all';
      renderGrid(cat);
    });
  });

  // Modal Open Handler
  function openModal(slug) {
    const s = CURATED_SKILLS.find(item => item.slug === slug);
    if (!s || !modal) return;

    const prompt = SKILL_PROMPTS[slug] || `# ${s.name}\n\n${s.description}`;
    const tok = s.tokenEstimate || Math.round(prompt.length / 4);

    currentModalSkill = { ...s, prompt, tok };
    modalTitle.textContent = s.name;
    modalCategoryBadge.textContent = s.badge.toUpperCase();
    modalDescription.textContent = s.description;
    modalTokens.textContent = `~${tok.toLocaleString()} tokens`;
    modalPromptCode.textContent = prompt;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (modalOpenInAppBtn) {
    modalOpenInAppBtn.addEventListener('click', () => {
      if (currentModalSkill?.command) {
        const targetUrl = new URL('/app/', window.location.origin);
        targetUrl.searchParams.set('extract', currentModalSkill.command);
        window.location.href = targetUrl.toString();
      }
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      if (currentModalSkill) {
        navigator.clipboard.writeText(currentModalSkill.prompt).then(() => {
          showToast(`Copied "${currentModalSkill.name}" prompt!`, 'success');
          closeModal();
        });
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   4. FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      items.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   5. Toast Notifications
   ========================================================================== */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  if (type === 'success') {
    iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  }

  toast.innerHTML = `<span class="toast-icon">${iconSvg}</span><span class="toast-text">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}
