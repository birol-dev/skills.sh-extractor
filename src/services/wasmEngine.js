// WebAssembly Acceleration Engine for Skill Extractor (Zero-Copy Optimized)
import { WASM_BINARY_BASE64 } from '../wasm/wasmBinary.js';

// Module-level cached TextEncoder / TextDecoder instances to eliminate GC thrashing
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

class WasmEngine {
  constructor() {
    this.instance = null;
    this.memory = null;
    this.exports = null;
    this.isReady = false;
    this.memView = null;
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
      this.memView = new Uint8Array(this.memory.buffer);
      this.isReady = true;
      console.log('[WASM] Engine initialized successfully (', len, 'bytes)');
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

  // Ensure WASM linear memory buffer can hold `bytesNeeded`
  ensureMemory(bytesNeeded) {
    if (!this.memory) return null;
    const currentBytes = this.memory.buffer.byteLength;
    if (bytesNeeded > currentBytes) {
      const pagesNeeded = Math.ceil((bytesNeeded - currentBytes) / 65536) + 1;
      this.memory.grow(pagesNeeded);
      this.memView = new Uint8Array(this.memory.buffer);
    } else if (!this.memView || this.memView.buffer !== this.memory.buffer) {
      this.memView = new Uint8Array(this.memory.buffer);
    }
    return this.memView;
  }

  // 1. Hash string (FNV-1a 32-bit, zero-copy into WASM memory)
  hash(str) {
    if (!str) return '0';
    if (this.isReady && this.exports?.hash_fnv1a && textEncoder) {
      const maxBytes = str.length * 3 + 4;
      const mem = this.ensureMemory(maxBytes);
      const { written } = textEncoder.encodeInto(str, mem);
      const hashInt = this.exports.hash_fnv1a(0, written) >>> 0;
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
    if (this.isReady && this.exports?.normalize_alpha && textEncoder && textDecoder) {
      const maxBytes = str.length * 3 + 32;
      const mem = this.ensureMemory(maxBytes * 2);
      const { written } = textEncoder.encodeInto(str, mem);
      const dstOffset = written + 8;
      const outLen = this.exports.normalize_alpha(0, written, dstOffset);
      return textDecoder.decode(mem.subarray(dstOffset, dstOffset + outLen));
    }
    // JS Fallback
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // 3. Estimate LLM tokens (Fast zero-copy Wasm byte scanner)
  estimateTokens(text) {
    if (!text) return 0;
    if (this.isReady && this.exports?.estimate_tokens && textEncoder) {
      const maxBytes = text.length * 3 + 16;
      const mem = this.ensureMemory(maxBytes);
      const { written } = textEncoder.encodeInto(text, mem);
      return this.exports.estimate_tokens(0, written);
    }
    // JS Fallback
    const words = text.trim().split(/\s+/).filter(Boolean);
    const symbols = (text.match(/[{}\[\]()<>;:=+\-/*`"'\#,\.]/g) || []).length;
    return Math.round(words.length * 1.3 + symbols * 0.5);
  }

  // 4. Levenshtein edit distance (zero intermediate allocations)
  levenshtein(s1, s2) {
    if (s1 === s2) return 0;
    if (!s1) return s2.length;
    if (!s2) return s1.length;

    if (this.isReady && this.exports?.levenshtein && textEncoder) {
      const maxLen1 = s1.length * 3 + 2;
      const maxLen2 = s2.length * 3 + 2;
      const bufSize = (maxLen2 + 4) * 4;
      const totalNeeded = maxLen1 + maxLen2 + bufSize + 32;
      const mem = this.ensureMemory(totalNeeded);

      const s1Ptr = 0;
      const { written: len1 } = textEncoder.encodeInto(s1, mem.subarray(s1Ptr));
      const s2Ptr = len1 + 1;
      const { written: len2 } = textEncoder.encodeInto(s2, mem.subarray(s2Ptr));
      const bufPtr = s2Ptr + len2 + 4;

      return this.exports.levenshtein(s1Ptr, len1, s2Ptr, len2, bufPtr);
    }

    // JS Fallback
    const m = s1.length;
    const n = s2.length;
    const dp = new Uint16Array((m + 1) * (n + 1));
    for (let i = 0; i <= m; i++) dp[i * (n + 1)] = i;
    for (let j = 0; j <= n; j++) dp[j] = j;

    for (let i = 1; i <= m; i++) {
      const iOffset = i * (n + 1);
      const prevOffset = (i - 1) * (n + 1);
      for (let j = 1; j <= n; j++) {
        const cost = s1.charCodeAt(i - 1) === s2.charCodeAt(j - 1) ? 0 : 1;
        const del = dp[prevOffset + j] + 1;
        const ins = dp[iOffset + (j - 1)] + 1;
        const sub = dp[prevOffset + (j - 1)] + cost;
        dp[iOffset + j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      }
    }
    return dp[m * (n + 1) + n];
  }

  // 5. Fuzzy Match Score (0 - 1000)
  fuzzyMatch(query, target, preNormQ = null, preNormT = null) {
    if (!query) return 1000;
    if (!target) return 0;

    const normQ = preNormQ !== null ? preNormQ : this.normalize(query);
    const normT = preNormT !== null ? preNormT : this.normalize(target);

    if (normQ === normT) return 1000;
    if (normT.includes(normQ)) return 900;

    if (this.isReady && this.exports?.fuzzy_score && textEncoder) {
      const qBytesMax = normQ.length * 3 + 2;
      const tBytesMax = normT.length * 3 + 2;
      const mem = this.ensureMemory(qBytesMax + tBytesMax + 16);

      const qPtr = 0;
      const { written: qLen } = textEncoder.encodeInto(normQ, mem.subarray(qPtr));
      const tPtr = qLen + 2;
      const { written: tLen } = textEncoder.encodeInto(normT, mem.subarray(tPtr));

      return this.exports.fuzzy_score(qPtr, qLen, tPtr, tLen);
    }

    // Fast JS Subsequence Match
    let score = 0;
    let qi = 0;
    const qLen = normQ.length;
    const tLen = normT.length;
    for (let ti = 0; ti < tLen && qi < qLen; ti++) {
      if (normQ.charCodeAt(qi) === normT.charCodeAt(ti)) {
        score += 10;
        qi++;
      }
    }
    return qi === qLen ? Math.min(1000, Math.round((score * 100) / tLen)) : 0;
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
