// WebAssembly Acceleration Engine for Skill Extractor
import { WASM_BINARY_BASE64 } from '../wasm/wasmBinary.js';

class WasmEngine {
  constructor() {
    this.instance = null;
    this.memory = null;
    this.exports = null;
    this.isReady = false;
    this.initPromise = this.init();
  }

  async init() {
    try {
      // Decode embedded base64 WASM binary into Uint8Array
      const binaryString = atob(WASM_BINARY_BASE64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Instantiate WebAssembly module
      const module = await WebAssembly.instantiate(bytes);
      this.instance = module.instance;
      this.exports = module.instance.exports;
      this.memory = this.exports.memory;
      this.isReady = true;
      console.log('⚡ WebAssembly Engine initialized successfully (', len, 'bytes)');
      return true;
    } catch (err) {
      console.warn('WebAssembly initialization failed, falling back to JS implementation:', err);
      this.isReady = false;
      return false;
    }
  }

  async ready() {
    await this.initPromise;
    return this.isReady;
  }

  // 1. Hash string (FNV-1a 32-bit)
  hash(str) {
    if (!str) return '0';
    if (this.isReady && this.exports?.hash_fnv1a) {
      const bytes = new TextEncoder().encode(str);
      const memView = new Uint8Array(this.memory.buffer);
      memView.set(bytes, 0);
      const hashInt = this.exports.hash_fnv1a(0, bytes.length) >>> 0;
      return hashInt.toString(16).padStart(8, '0');
    }
    // JS Fallback
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  // 2. Normalize alphanumeric (lowercased, only a-z and 0-9)
  normalize(str) {
    if (!str) return '';
    if (this.isReady && this.exports?.normalize_alpha) {
      const bytes = new TextEncoder().encode(str);
      const memView = new Uint8Array(this.memory.buffer);
      memView.set(bytes, 0);
      const dstOffset = bytes.length + 10;
      const outLen = this.exports.normalize_alpha(0, bytes.length, dstOffset);
      const outBytes = new Uint8Array(this.memory.buffer, dstOffset, outLen);
      return new TextDecoder().decode(outBytes);
    }
    // JS Fallback
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // 3. Estimate LLM tokens (Wasm byte scanner)
  estimateTokens(text) {
    if (!text) return 0;
    if (this.isReady && this.exports?.estimate_tokens) {
      const bytes = new TextEncoder().encode(text);
      // Ensure memory buffer is big enough
      if (bytes.length > this.memory.buffer.byteLength) {
        const pagesNeeded = Math.ceil((bytes.length - this.memory.buffer.byteLength) / 65536) + 1;
        this.memory.grow(pagesNeeded);
      }
      const memView = new Uint8Array(this.memory.buffer);
      memView.set(bytes, 0);
      return this.exports.estimate_tokens(0, bytes.length);
    }
    // JS Fallback
    const words = text.trim().split(/\s+/).filter(Boolean);
    const symbols = (text.match(/[{}\[\]()<>;:=+\-/*`"'\#,\.]/g) || []).length;
    return Math.round(words.length * 1.3 + symbols * 0.5);
  }

  // 4. Levenshtein edit distance
  levenshtein(s1, s2) {
    if (s1 === s2) return 0;
    if (!s1) return s2.length;
    if (!s2) return s1.length;

    if (this.isReady && this.exports?.levenshtein) {
      const b1 = new TextEncoder().encode(s1);
      const b2 = new TextEncoder().encode(s2);
      const memView = new Uint8Array(this.memory.buffer);
      
      const s1Ptr = 0;
      const s2Ptr = b1.length + 1;
      const bufPtr = s2Ptr + b2.length + 4;

      memView.set(b1, s1Ptr);
      memView.set(b2, s2Ptr);

      return this.exports.levenshtein(s1Ptr, b1.length, s2Ptr, b2.length, bufPtr);
    }

    // JS Fallback
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  // 5. Fuzzy Match Score (0 - 1000)
  fuzzyMatch(query, target) {
    if (!query) return 1000;
    if (!target) return 0;

    const normQ = this.normalize(query);
    const normT = this.normalize(target);

    if (normQ === normT) return 1000;
    if (normT.includes(normQ)) return 900;

    if (this.isReady && this.exports?.fuzzy_score) {
      const b1 = new TextEncoder().encode(normQ);
      const b2 = new TextEncoder().encode(normT);
      const memView = new Uint8Array(this.memory.buffer);
      
      const qPtr = 0;
      const tPtr = b1.length + 2;
      memView.set(b1, qPtr);
      memView.set(b2, tPtr);

      return this.exports.fuzzy_score(qPtr, b1.length, tPtr, b2.length);
    }

    // JS Fallback
    let score = 0;
    let qi = 0;
    for (let ti = 0; ti < normT.length && qi < normQ.length; ti++) {
      if (normQ[qi] === normT[ti]) {
        score += 10;
        qi++;
      }
    }
    return qi === normQ.length ? Math.min(1000, Math.round((score * 100) / normT.length)) : 0;
  }

  // Benchmark suite comparing WASM vs pure JS
  runBenchmark(iterations = 10000) {
    const testStrings = [
      "skills.sh extractor wasm benchmark test query string",
      "SVG Logo Designer - Claude Coding Agent Capability Playbook",
      "https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo",
      "consolidate-scripts-and-references-fuzzy-matcher"
    ];

    // 1. Benchmark WASM Levenshtein
    const t0 = performance.now();
    let wasmSum = 0;
    for (let i = 0; i < iterations; i++) {
      const s1 = testStrings[i % testStrings.length];
      const s2 = testStrings[(i + 1) % testStrings.length];
      wasmSum += this.levenshtein(s1, s2);
    }
    const wasmTime = performance.now() - t0;

    // 2. Benchmark JS Levenshtein
    const jsLevenshtein = (s1, s2) => {
      const m = s1.length, n = s2.length;
      let prev = new Array(n + 1);
      let curr = new Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
          curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
      }
      return prev[n];
    };

    const t1 = performance.now();
    let jsSum = 0;
    for (let i = 0; i < iterations; i++) {
      const s1 = testStrings[i % testStrings.length];
      const s2 = testStrings[(i + 1) % testStrings.length];
      jsSum += jsLevenshtein(s1, s2);
    }
    const jsTime = performance.now() - t1;

    // 3. Token estimation benchmark
    const sampleDoc = testStrings.join(' \n ').repeat(10);
    const t2 = performance.now();
    for (let i = 0; i < 500; i++) {
      this.estimateTokens(sampleDoc);
    }
    const tokenTime = performance.now() - t2;

    const speedup = jsTime > 0 ? (jsTime / Math.max(wasmTime, 0.01)).toFixed(2) : '1.0';

    return {
      iterations,
      wasmTimeMs: wasmTime.toFixed(2),
      jsTimeMs: jsTime.toFixed(2),
      speedup: `${speedup}x`,
      tokenTimeMs: tokenTime.toFixed(2),
      isWasmActive: this.isReady,
      memoryBytes: this.memory ? this.memory.buffer.byteLength : 0
    };
  }
}

export const wasmEngine = new WasmEngine();
export default wasmEngine;
