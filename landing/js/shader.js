export function initShader() {
  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    initCanvas2DFallback(canvas);
    return;
  }

  const vsSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_time;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

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

      vec2 mouseNorm = (u_mouse.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      float distToMouse = length(st - mouseNorm);
      float mouseWave = smoothstep(0.4, 0.0, distToMouse) * 0.25;

      float t = u_time * 0.12;

      vec2 q = vec2(fbm(st + vec2(0.0, t)), fbm(st + vec2(5.2, 1.3)));
      vec2 r = vec2(fbm(st + 4.0 * q + vec2(1.7 - t * 0.15, 9.2)), fbm(st + 4.0 * q + vec2(8.3, 2.8 + t * 0.1)));

      float f = fbm(st + 3.0 * r + mouseWave);

      float intensity = smoothstep(0.1, 0.9, f);
      intensity = pow(intensity, 2.2);

      vec3 color = mix(vec3(0.035, 0.035, 0.045), vec3(0.12, 0.12, 0.15), intensity);
      color += vec3(0.85, 0.85, 0.95) * pow(intensity, 4.0) * 0.45;

      float grain = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.035;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(glCtx, type, source) {
    const shader = glCtx.createShader(type);
    glCtx.shaderSource(shader, source);
    glCtx.compileShader(shader);
    if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
      console.warn('Shader compile failed: ' + glCtx.getShaderInfoLog(shader));
      glCtx.deleteShader(shader);
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
