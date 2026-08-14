/**
 * skills.sh Extractor — Landing Page Application Script
 * Features:
 *  - Interactive Monotone WebGL Shader with mouse reactivity
 *  - Clean Live Hero Mini-Extractor Widget with 1-click prompt compiler
 *  - Categorized Skills Library with preview modal & copy triggers
 *  - FAQ Accordions & Performance optimization
 */

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
   2. Skill Presets & Compilation Dictionary
   ========================================================================== */
const SKILL_DATABASE = {
  'copywriting': {
    name: 'High-Converting Landing Page Copywriter',
    category: 'Copywriting & Messaging',
    badge: 'COPYWRITING',
    tokens: 1840,
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'copywriting'",
    description: 'A direct-response copywriting playbook designed to structure high-converting website copy, hero headlines, value propositions, and objection mitigation.',
    prompt: `# High-Converting Landing Page Copywriter Playbook

You are an elite direct-response conversion copywriter.

## Directives:
1. **Above the Fold Hero Section:**
   - **Headline (H1):** The single most valuable transformation in clear, direct English.
   - **Sub-headline (H2):** Explain *how* the product delivers the promise, for whom, and what friction it eliminates.
   - **Primary CTA:** High-intent action copy with risk reversal.

2. **Feature-to-Benefit Matrix:**
   - Always map: [Feature] -> [Immediate Benefit] -> [Emotional Outcome].

3. **Objection Pre-emption:**
   - Address top 3 buyer hesitations immediately next to conversion points.`
  },
  'marketing': {
    name: 'Growth Experiment & A/B Testing Planner',
    category: 'Marketing & Growth',
    badge: 'MARKETING',
    tokens: 2100,
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'ab-testing'",
    description: 'Systematic growth experimentation framework for planning, scoring, and executing high-velocity A/B tests with statistical confidence.',
    prompt: `# Growth Experiment & A/B Testing Playbook

You are a Growth Lead specializing in conversion optimization and quantitative experiment design.

## Directives:
1. **Hypothesis Standard:**
   - "Because we observed [Friction], we believe that [Change] will result in [Lift] because [Rationale]."

2. **ICE Prioritization (1–10):**
   - **Impact:** Expected lift on North Star metric.
   - **Confidence:** Evidentiary backing from analytics/recordings.
   - **Ease:** Engineering and design implementation velocity.`
  },
  'svg-logo': {
    name: 'SVG Logo & Brand Identity Architect',
    category: 'Design & Visuals',
    badge: 'DESIGN',
    tokens: 2450,
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'svg-logo-designer'",
    description: 'Generates production-grade, mathematically balanced SVG vector marks, geometric logos, and icon systems with embedded accessibility tags.',
    prompt: `# SVG Logo & Brand Identity Architect

You are a senior vector brand designer and SVG engineer.

## Directives:
1. **SVG Code Specifications:**
   - Output clean, valid XML SVG markup with \`xmlns="http://www.w3.org/2000/svg"\` and \`viewBox="0 0 500 500"\`.
   - Never use raster images or external dependencies.
   - Use semantic SVG elements: \`<path>\`, \`<circle>\`, \`<rect>\`, \`<defs>\`, and \`<linearGradient>\`.

2. **Visual Geometry:**
   - Align to consistent 8px/16px grid divisions with high contrast in dark and light modes.`
  },
  'cold-email': {
    name: 'B2B Cold Outreach & Follow-Up Engine',
    category: 'Sales & Outbound',
    badge: 'SALES',
    tokens: 1620,
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'cold-email'",
    description: 'High-reply outbound email sequencing engine that crafts personalized icebreakers, concise value props, and frictionless conversational CTAs.',
    prompt: `# B2B Cold Outreach & Follow-Up Playbook

You are a specialized outbound sales strategist writing B2B cold emails with high reply rates.

## Directives:
1. **Constraints:**
   - Under 90 words total per email.
   - Mobile-first formatting (max 2 sentences per paragraph).

2. **Sequence Architecture:**
   - **Touch 1:** Observation/Trigger event + Relevant Insight + Soft Interest Ask.
   - **Touch 2 (+3 days):** 1-sentence case study / proof metric.
   - **Touch 3 (+6 days):** 9-word re-engagement prompt.`
  },
  'seo-audit': {
    name: 'AI Answer Engine Optimization (GEO)',
    category: 'SEO & Citations',
    badge: 'SEO & GEO',
    tokens: 1980,
    command: "npx skills add https://github.com/rknall/claude-skills --skill 'ai-seo'",
    description: 'Comprehensive playbook for ranking in Perplexity, ChatGPT Search, and Google AI Overviews with structured JSON-LD and llms.txt.',
    prompt: `# AI Search & Generative Engine Optimization (GEO) Playbook

You are an AI Search Specialist optimizing websites for LLM answer engines (Perplexity, ChatGPT Search, Claude, Google AI Overviews).

## Directives:
1. **Direct Answer Architecture:**
   - Provide explicit, factual summary answers in the first 40 words of each section.
   - Structure data with markdown tables, definition lists, and numbered steps.

2. **Schema & Knowledge Graph:**
   - Implement JSON-LD with \`@type: "TechArticle"\`, \`SoftwareApplication\`, and \`FAQPage\`.
   - Standard \`llms.txt\` and \`llms-full.txt\` for agentic crawlers.`
  },
  'typescript': {
    name: 'TypeScript Strict Refactorer & Zod Validator',
    category: 'Engineering & Code',
    badge: 'ENGINEERING',
    tokens: 2300,
    command: "npx skills add https://github.com/vercel/ai --skill typescript-strict",
    description: 'Refactors untyped JavaScript or loose TypeScript into strictly typed, zero-`any` code with runtime Zod schema parsing and generics.',
    prompt: `# Strict TypeScript & Runtime Validation Playbook

You are a Principal TypeScript Architect enforcing strict type safety and domain-driven design.

## Directives:
1. **Type Strictness:**
   - \`noImplicitAny: true\`, \`strictNullChecks: true\`.
   - Never use \`any\` — use \`unknown\` with type guards or discriminated unions.

2. **Runtime Validation:**
   - Validate all external API inputs and query parameters with \`z.infer<typeof Schema>\`.`
  }
};

/* ==========================================================================
   3. Live Hero Mini-Extractor Widget
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

  let activeSkillKey = 'copywriting';

  function renderSkill(skillKey, animate = true) {
    const data = SKILL_DATABASE[skillKey] || SKILL_DATABASE['copywriting'];
    activeSkillKey = skillKey;

    if (animate) {
      extractBtn.classList.add('loading');
      outputPanel.style.opacity = '0.5';
    }

    setTimeout(() => {
      input.value = data.command;
      outputBadge.textContent = data.badge;
      outputSkillName.textContent = data.name;
      outputTokens.textContent = `~${data.tokens.toLocaleString()} tokens`;
      outputCode.textContent = data.prompt;

      extractBtn.classList.remove('loading');
      outputPanel.style.opacity = '1';

      presetTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.skill === skillKey);
      });
    }, animate ? 200 : 0);
  }

  // Initial render
  renderSkill('copywriting', false);

  // Preset tabs click
  presetTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const skill = tab.dataset.skill;
      renderSkill(skill, true);
    });
  });

  // Extract button click
  extractBtn.addEventListener('click', () => {
    const query = input.value.toLowerCase();
    let matchedKey = 'copywriting';

    for (const key of Object.keys(SKILL_DATABASE)) {
      if (query.includes(key) || query.includes(SKILL_DATABASE[key].name.toLowerCase())) {
        matchedKey = key;
        break;
      }
    }

    renderSkill(matchedKey, true);
    showToast('✨ Skill compiled in browser with WebAssembly');
  });

  // Copy prompt button click
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
      const promptText = SKILL_DATABASE[activeSkillKey]?.prompt || outputCode.textContent;
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('📋 Copied prompt! Ready to paste into Claude or ChatGPT.');
      }).catch(() => {
        showToast('⚠️ Copy failed, please select and copy manually.');
      });
    });
  }
}

/* ==========================================================================
   4. Skills Showcase Catalog & Filter
   ========================================================================= */
function initSkillsCatalog() {
  const tabs = document.querySelectorAll('.catalog-tab');
  const cards = document.querySelectorAll('.skill-card');
  const modal = document.getElementById('skillPreviewModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalCategoryBadge = document.getElementById('modalCategoryBadge');
  const modalDescription = document.getElementById('modalDescription');
  const modalTokens = document.getElementById('modalTokens');
  const modalPromptCode = document.getElementById('modalPromptCode');

  let currentModalSkill = null;

  // Filter Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const category = tab.dataset.category;
      cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Modal Open Handler
  function openModal(skillId) {
    const data = SKILL_DATABASE[skillId];
    if (!data || !modal) return;

    currentModalSkill = data;
    modalTitle.textContent = data.name;
    modalCategoryBadge.textContent = data.category;
    modalDescription.textContent = data.description;
    modalTokens.textContent = `~${data.tokens.toLocaleString()} tokens`;
    modalPromptCode.textContent = data.prompt;

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

  // Preview Buttons on Cards
  document.querySelectorAll('.skill-btn-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const skillId = btn.dataset.previewId;
      openModal(skillId);
    });
  });

  // Direct Copy Buttons on Cards
  document.querySelectorAll('.skill-btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const skillId = btn.dataset.copyId;
      const data = SKILL_DATABASE[skillId];
      if (data) {
        navigator.clipboard.writeText(data.prompt).then(() => {
          showToast(`📋 Copied "${data.name}" prompt`);
        });
      }
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      if (currentModalSkill) {
        navigator.clipboard.writeText(currentModalSkill.prompt).then(() => {
          showToast(`📋 Copied "${currentModalSkill.name}"`);
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

/* ==========================================================================
   5. FAQ Accordion
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
   6. Toast Notifications
   ========================================================================== */
function showToast(message, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;

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
