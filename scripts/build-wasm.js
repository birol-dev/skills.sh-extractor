// Script to generate and test the Skill Extractor WebAssembly Engine binary
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// WASM Binary Builder Helpers
function encodeLEB128(val, signed = false) {
  const bytes = [];
  let v = Math.floor(val);
  if (signed) {
    let more = true;
    while (more) {
      let byte = v & 0x7f;
      v >>= 7;
      if ((v === 0 && (byte & 0x40) === 0) || (v === -1 && (byte & 0x40) !== 0)) {
        more = false;
      } else {
        byte |= 0x80;
      }
      bytes.push(byte);
    }
  } else {
    do {
      let byte = v & 0x7f;
      v >>>= 7;
      if (v !== 0) {
        byte |= 0x80;
      }
      bytes.push(byte);
    } while (v !== 0);
  }
  return bytes;
}

function encodeString(str) {
  const utf8 = Buffer.from(str, 'utf8');
  return [...encodeLEB128(utf8.length), ...utf8];
}

function createSection(id, payload) {
  return [id, ...encodeLEB128(payload.length), ...payload];
}

// Bytecode opcodes
const OP = {
  unreachable: 0x00,
  nop: 0x01,
  block: 0x02,
  loop: 0x03,
  if: 0x04,
  else: 0x05,
  end: 0x0b,
  br: 0x0c,
  br_if: 0x0d,
  return: 0x0f,
  call: 0x10,
  drop: 0x1a,
  select: 0x1b,
  local_get: 0x20,
  local_set: 0x21,
  local_tee: 0x22,
  i32_load: 0x28,
  i32_load8_u: 0x2d,
  i32_store: 0x36,
  i32_store8: 0x3a,
  i32_const: 0x41,
  i32_eqz: 0x45,
  i32_eq: 0x46,
  i32_ne: 0x47,
  i32_lt_s: 0x48,
  i32_lt_u: 0x49,
  i32_gt_s: 0x4a,
  i32_gt_u: 0x4b,
  i32_le_s: 0x4c,
  i32_le_u: 0x4d,
  i32_ge_s: 0x4e,
  i32_ge_u: 0x4f,
  i32_add: 0x6a,
  i32_sub: 0x6b,
  i32_mul: 0x6c,
  i32_div_s: 0x6d,
  i32_div_u: 0x6e,
  i32_rem_s: 0x6f,
  i32_rem_u: 0x70,
  i32_and: 0x71,
  i32_or: 0x72,
  i32_xor: 0x73,
  i32_shl: 0x74,
  i32_shr_s: 0x75,
  i32_shr_u: 0x76,
};

const TYPE = {
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
  void: 0x40,
  func: 0x60
};

// Functions to implement:
// 1. fnv1a_hash(ptr: i32, len: i32) -> i32
//    Computes 32-bit FNV-1a hash over memory[ptr..ptr+len]
function buildHashFnv1aCode() {
  const locals = [
    // 0: ptr, 1: len, 2: hash, 3: i
    { count: 2, type: TYPE.i32 } // local 2: hash, local 3: i
  ];
  
  // FNV-1a 32-bit offset basis: 0x811c9dc5 = 2166136261 (signed: -2128831035)
  // FNV prime: 0x01000193 = 16777619
  const body = [
    // hash = 2166136261 (0x811c9dc5 -> -2128831035 signed leb128)
    OP.i32_const, ...encodeLEB128(-2128831035, true),
    OP.local_set, 2,
    // i = 0
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 3,

    // loop
    OP.block, TYPE.void,
    OP.loop, TYPE.void,
      // if i >= len break
      OP.local_get, 3,
      OP.local_get, 1,
      OP.i32_ge_u,
      OP.br_if, 1, // exit block

      // byte = mem[ptr + i]
      // hash = (hash ^ byte) * 16777619
      OP.local_get, 2, // hash
      OP.local_get, 0, // ptr
      OP.local_get, 3, // i
      OP.i32_add,
      OP.i32_load8_u, 0x00, 0x00, // align 0, offset 0
      OP.i32_xor,
      OP.i32_const, ...encodeLEB128(16777619, true),
      OP.i32_mul,
      OP.local_set, 2,

      // i++
      OP.local_get, 3,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_add,
      OP.local_set, 3,
      OP.br, 0, // continue loop
    OP.end, // end loop
    OP.end, // end block

    OP.local_get, 2,
    OP.end
  ];

  return encodeFunctionBody(locals, body);
}

// 2. normalize_alpha(src_ptr: i32, src_len: i32, dst_ptr: i32) -> i32 (returns dst_len)
//    Takes string at src_ptr, lowercases A-Z to a-z, keeps only 0-9 and a-z, writes to dst_ptr
function buildNormalizeAlphaCode() {
  const locals = [
    // 0: src_ptr, 1: src_len, 2: dst_ptr
    // 3: i, 4: out_len, 5: ch
    { count: 3, type: TYPE.i32 }
  ];

  const body = [
    // i = 0, out_len = 0
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 3,
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 4,

    OP.block, TYPE.void,
    OP.loop, TYPE.void,
      OP.local_get, 3,
      OP.local_get, 1,
      OP.i32_ge_u,
      OP.br_if, 1, // exit loop

      // ch = mem[src_ptr + i]
      OP.local_get, 0,
      OP.local_get, 3,
      OP.i32_add,
      OP.i32_load8_u, 0, 0,
      OP.local_set, 5,

      // if ch >= 'A' (65) and ch <= 'Z' (90) => ch += 32
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(65, true),
      OP.i32_ge_u,
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(90, true),
      OP.i32_le_u,
      OP.i32_and,
      OP.if, TYPE.void,
        OP.local_get, 5,
        OP.i32_const, ...encodeLEB128(32, true),
        OP.i32_add,
        OP.local_set, 5,
      OP.end,

      // if (ch >= 'a' (97) && ch <= 'z' (122)) || (ch >= '0' (48) && ch <= '9' (57))
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(97, true),
      OP.i32_ge_u,
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(122, true),
      OP.i32_le_u,
      OP.i32_and,
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(48, true),
      OP.i32_ge_u,
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(57, true),
      OP.i32_le_u,
      OP.i32_and,
      OP.i32_or,
      OP.if, TYPE.void,
        // mem[dst_ptr + out_len] = ch
        OP.local_get, 2,
        OP.local_get, 4,
        OP.i32_add,
        OP.local_get, 5,
        OP.i32_store8, 0, 0,
        // out_len++
        OP.local_get, 4,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_add,
        OP.local_set, 4,
      OP.end,

      // i++
      OP.local_get, 3,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_add,
      OP.local_set, 3,
      OP.br, 0,
    OP.end,
    OP.end,

    OP.local_get, 4, // return out_len
    OP.end
  ];

  return encodeFunctionBody(locals, body);
}

// 3. estimate_tokens(ptr: i32, len: i32) -> i32
//    Fast token estimator: counts words, code punctuation, operators, whitespace changes
function buildEstimateTokensCode() {
  const locals = [
    // 0: ptr, 1: len
    // 2: i, 3: tokens, 4: in_word, 5: ch
    { count: 4, type: TYPE.i32 }
  ];

  const body = [
    // if len == 0 return 0
    OP.local_get, 1,
    OP.i32_eqz,
    OP.if, TYPE.void,
      OP.i32_const, ...encodeLEB128(0, true),
      OP.return,
    OP.end,

    // tokens = 0, i = 0, in_word = 0
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 2,
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 3,
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 4,

    OP.block, TYPE.void,
    OP.loop, TYPE.void,
      OP.local_get, 2,
      OP.local_get, 1,
      OP.i32_ge_u,
      OP.br_if, 1,

      // ch = mem[ptr + i]
      OP.local_get, 0,
      OP.local_get, 2,
      OP.i32_add,
      OP.i32_load8_u, 0, 0,
      OP.local_set, 5,

      // check if whitespace (ch <= 32: space, newline, tab)
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(32, true),
      OP.i32_le_u,
      OP.if, TYPE.void,
        OP.i32_const, ...encodeLEB128(0, true),
        OP.local_set, 4, // in_word = 0
      OP.else,
        // if punctuation or symbol ({}[]()<>;:=+-/*`"'\#) => each counts as token
        OP.local_get, 5,
        OP.i32_const, ...encodeLEB128(48, true),
        OP.i32_lt_u, // < '0' (symbols like !"$%&'()*+,-./#)
        OP.local_get, 5,
        OP.i32_const, ...encodeLEB128(58, true),
        OP.i32_ge_u,
        OP.local_get, 5,
        OP.i32_const, ...encodeLEB128(64, true),
        OP.i32_le_u, // :;<=>?@
        OP.i32_and,
        OP.i32_or,
        OP.if, TYPE.void,
          OP.local_get, 3,
          OP.i32_const, ...encodeLEB128(1, true),
          OP.i32_add,
          OP.local_set, 3,
          OP.i32_const, ...encodeLEB128(0, true),
          OP.local_set, 4,
        OP.else,
          // alphanumeric char
          OP.local_get, 4,
          OP.i32_eqz,
          OP.if, TYPE.void,
            OP.local_get, 3,
            OP.i32_const, ...encodeLEB128(1, true),
            OP.i32_add,
            OP.local_set, 3,
            OP.i32_const, ...encodeLEB128(1, true),
            OP.local_set, 4,
          OP.end,
        OP.end,
      OP.end,

      // i++
      OP.local_get, 2,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_add,
      OP.local_set, 2,
      OP.br, 0,
    OP.end,
    OP.end,

    OP.local_get, 3,
    OP.end
  ];

  return encodeFunctionBody(locals, body);
}

// 4. levenshtein(s1_ptr, s1_len, s2_ptr, s2_len, buffer_ptr) -> i32
//    Computes Levenshtein edit distance using dynamic programming row buffer at buffer_ptr
function buildLevenshteinCode() {
  const locals = [
    // 0: s1_ptr, 1: s1_len, 2: s2_ptr, 3: s2_len, 4: buf_ptr
    // 5: i, 6: j, 7: prev, 8: temp, 9: cost, 10: c1, 11: c2, 12: min_val
    { count: 8, type: TYPE.i32 }
  ];

  const body = [
    // if s1_len == 0 return s2_len
    OP.local_get, 1,
    OP.i32_eqz,
    OP.if, TYPE.void,
      OP.local_get, 3,
      OP.return,
    OP.end,
    // if s2_len == 0 return s1_len
    OP.local_get, 3,
    OP.i32_eqz,
    OP.if, TYPE.void,
      OP.local_get, 1,
      OP.return,
    OP.end,

    // initialize buffer[j] = j for j in 0..=s2_len (4 bytes per i32)
    OP.i32_const, ...encodeLEB128(0, true),
    OP.local_set, 6, // j = 0
    OP.block, TYPE.void,
    OP.loop, TYPE.void,
      OP.local_get, 6,
      OP.local_get, 3,
      OP.i32_gt_u,
      OP.br_if, 1,

      // buf[j * 4] = j
      OP.local_get, 4,
      OP.local_get, 6,
      OP.i32_const, ...encodeLEB128(4, true),
      OP.i32_mul,
      OP.i32_add,
      OP.local_get, 6,
      OP.i32_store, 2, 0,

      OP.local_get, 6,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_add,
      OP.local_set, 6,
      OP.br, 0,
    OP.end,
    OP.end,

    // outer loop: for i = 1..=s1_len
    OP.i32_const, ...encodeLEB128(1, true),
    OP.local_set, 5, // i = 1
    OP.block, TYPE.void,
    OP.loop, TYPE.void,
      OP.local_get, 5,
      OP.local_get, 1,
      OP.i32_gt_u,
      OP.br_if, 1,

      // prev = i - 1
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_sub,
      OP.local_set, 7,

      // buf[0] = i
      OP.local_get, 4,
      OP.local_get, 5,
      OP.i32_store, 2, 0,

      // c1 = s1[i - 1]
      OP.local_get, 0,
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_sub,
      OP.i32_add,
      OP.i32_load8_u, 0, 0,
      OP.local_set, 10,

      // inner loop: for j = 1..=s2_len
      OP.i32_const, ...encodeLEB128(1, true),
      OP.local_set, 6, // j = 1
      OP.block, TYPE.void,
      OP.loop, TYPE.void,
        OP.local_get, 6,
        OP.local_get, 3,
        OP.i32_gt_u,
        OP.br_if, 1,

        // temp = buf[j * 4]
        OP.local_get, 4,
        OP.local_get, 6,
        OP.i32_const, ...encodeLEB128(4, true),
        OP.i32_mul,
        OP.i32_add,
        OP.i32_load, 2, 0,
        OP.local_set, 8,

        // c2 = s2[j - 1]
        OP.local_get, 2,
        OP.local_get, 6,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_sub,
        OP.i32_add,
        OP.i32_load8_u, 0, 0,
        OP.local_set, 11,

        // cost = (c1 == c2) ? 0 : 1
        OP.local_get, 10,
        OP.local_get, 11,
        OP.i32_eq,
        OP.if, TYPE.i32,
          OP.i32_const, ...encodeLEB128(0, true),
        OP.else,
          OP.i32_const, ...encodeLEB128(1, true),
        OP.end,
        OP.local_set, 9,

        // min_val = min(prev + cost, buf[j*4] + 1, buf[(j-1)*4] + 1)
        // 1. prev + cost (substitution)
        OP.local_get, 7,
        OP.local_get, 9,
        OP.i32_add,
        OP.local_set, 12,

        // 2. buf[j*4] + 1 (deletion) -> temp + 1
        OP.local_get, 8,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_add,
        OP.local_get, 12,
        OP.i32_lt_u,
        OP.if, TYPE.void,
          OP.local_get, 8,
          OP.i32_const, ...encodeLEB128(1, true),
          OP.i32_add,
          OP.local_set, 12,
        OP.end,

        // 3. buf[(j-1)*4] + 1 (insertion)
        OP.local_get, 4,
        OP.local_get, 6,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_sub,
        OP.i32_const, ...encodeLEB128(4, true),
        OP.i32_mul,
        OP.i32_add,
        OP.i32_load, 2, 0,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_add,
        OP.local_get, 12,
        OP.i32_lt_u,
        OP.if, TYPE.void,
          OP.local_get, 4,
          OP.local_get, 6,
          OP.i32_const, ...encodeLEB128(1, true),
          OP.i32_sub,
          OP.i32_const, ...encodeLEB128(4, true),
          OP.i32_mul,
          OP.i32_add,
          OP.i32_load, 2, 0,
          OP.i32_const, ...encodeLEB128(1, true),
          OP.i32_add,
          OP.local_set, 12,
        OP.end,

        // prev = temp
        OP.local_get, 8,
        OP.local_set, 7,

        // buf[j * 4] = min_val
        OP.local_get, 4,
        OP.local_get, 6,
        OP.i32_const, ...encodeLEB128(4, true),
        OP.i32_mul,
        OP.i32_add,
        OP.local_get, 12,
        OP.i32_store, 2, 0,

        // j++
        OP.local_get, 6,
        OP.i32_const, ...encodeLEB128(1, true),
        OP.i32_add,
        OP.local_set, 6,
        OP.br, 0,
      OP.end,
      OP.end,

      // i++
      OP.local_get, 5,
      OP.i32_const, ...encodeLEB128(1, true),
      OP.i32_add,
      OP.local_set, 5,
      OP.br, 0,
    OP.end,
    OP.end,

    // return buf[s2_len * 4]
    OP.local_get, 4,
    OP.local_get, 3,
    OP.i32_const, ...encodeLEB128(4, true),
    OP.i32_mul,
    OP.i32_add,
    OP.i32_load, 2, 0,
    OP.end
  ];

  return encodeFunctionBody(locals, body);
}

// 5. fuzzy_score(q_ptr, q_len, t_ptr, t_len) -> i32 (Score from 0 to 1000)
function buildFuzzyScoreCode() {
  const locals = [
    // 0: q_ptr, 1: q_len, 2: t_ptr, 3: t_len
    // 4: qi, 5: ti, 6: score, 7: consecutive, 8: qc, 9: tc, 10: prev_tc
    { count: 7, type: TYPE.i32 }
  ];

  const body = [
    // if q_len == 0 return 1000
    OP.local_get, 1,
    OP.i32_eqz,
    OP.if, TYPE.void,
      OP.i32_const, ...encodeLEB128(1000, true),
      OP.return,
    OP.end,

    // if q_len > t_len return 0
    OP.local_get, 1,
    OP.local_get, 3,
    OP.i32_gt_u,
    OP.if, TYPE.void,
      OP.i32_const, 0,
      OP.return,
    OP.end,

    // qi = 0, ti = 0, score = 0, consecutive = 0, prev_tc = 0
    OP.i32_const, 0,
    OP.local_set, 4,
    OP.i32_const, 0,
    OP.local_set, 5,
    OP.i32_const, 0,
    OP.local_set, 6,
    OP.i32_const, 0,
    OP.local_set, 7,
    OP.i32_const, 0,
    OP.local_set, 10,

    OP.block, TYPE.void,
      OP.loop, TYPE.void,
        // if qi >= q_len break outer block (target index 1)
        OP.local_get, 4,
        OP.local_get, 1,
        OP.i32_ge_u,
        OP.br_if, 1,

        // if ti >= t_len return 0 (not all query chars matched)
        OP.local_get, 5,
        OP.local_get, 3,
        OP.i32_ge_u,
        OP.if, TYPE.void,
          OP.i32_const, 0,
          OP.return,
        OP.end,

        // qc = mem[q_ptr + qi]
        OP.local_get, 0,
        OP.local_get, 4,
        OP.i32_add,
        OP.i32_load8_u, 0, 0,
        OP.local_set, 8,

        // tc = mem[t_ptr + ti]
        OP.local_get, 2,
        OP.local_get, 5,
        OP.i32_add,
        OP.i32_load8_u, 0, 0,
        OP.local_set, 9,

        // if qc == tc
        OP.local_get, 8,
        OP.local_get, 9,
        OP.i32_eq,
        OP.if, TYPE.void,
          // score += 10
          OP.local_get, 6,
          OP.i32_const, 10,
          OP.i32_add,
          OP.local_set, 6,

          // if ti == 0 (start bonus + 20)
          OP.local_get, 5,
          OP.i32_eqz,
          OP.if, TYPE.void,
            OP.local_get, 6,
            OP.i32_const, 20,
            OP.i32_add,
            OP.local_set, 6,
          OP.end,

          // score += consecutive * 5
          OP.local_get, 6,
          OP.local_get, 7,
          OP.i32_const, 5,
          OP.i32_mul,
          OP.i32_add,
          OP.local_set, 6,

          // consecutive += 1
          OP.local_get, 7,
          OP.i32_const, 1,
          OP.i32_add,
          OP.local_set, 7,

          // qi += 1
          OP.local_get, 4,
          OP.i32_const, 1,
          OP.i32_add,
          OP.local_set, 4,
        OP.else,
          // consecutive = 0
          OP.i32_const, 0,
          OP.local_set, 7,
        OP.end,

        // prev_tc = tc
        OP.local_get, 9,
        OP.local_set, 10,

        // ti += 1
        OP.local_get, 5,
        OP.i32_const, 1,
        OP.i32_add,
        OP.local_set, 5,

        OP.br, 0, // loop
      OP.end, // end loop
    OP.end, // end block

    // normalized score = (score * 100) / t_len
    OP.local_get, 6,
    OP.i32_const, 100,
    OP.i32_mul,
    OP.local_get, 3,
    OP.i32_div_u,
    OP.local_set, 6,

    // if score > 1000 score = 1000
    OP.local_get, 6,
    OP.i32_const, ...encodeLEB128(1000, true),
    OP.i32_gt_u,
    OP.if, TYPE.void,
      OP.i32_const, ...encodeLEB128(1000, true),
      OP.local_set, 6,
    OP.end,

    OP.local_get, 6,
    OP.end
  ];

  return encodeFunctionBody(locals, body);
}

function encodeFunctionBody(locals, body) {
  let localEntries = [];
  for (const loc of locals) {
    localEntries.push(...encodeLEB128(loc.count), loc.type);
  }
  const fullBody = [
    ...encodeLEB128(locals.length),
    ...localEntries,
    ...body
  ];
  return [...encodeLEB128(fullBody.length), ...fullBody];
}

// Build the complete WASM binary
function buildSkillEngineWasm() {
  const magic = [0x00, 0x61, 0x73, 0x6d];
  const version = [0x01, 0x00, 0x00, 0x00];

  // 1. Type Section
  // Types:
  // Type 0: (i32, i32) -> i32 [fnv1a_hash, estimate_tokens]
  // Type 1: (i32, i32, i32) -> i32 [normalize_alpha]
  // Type 2: (i32, i32, i32, i32, i32) -> i32 [levenshtein]
  // Type 3: (i32, i32, i32, i32) -> i32 [fuzzy_score]
  const types = [
    // Type 0: (i32, i32) -> i32
    TYPE.func, ...encodeLEB128(2), TYPE.i32, TYPE.i32, ...encodeLEB128(1), TYPE.i32,
    // Type 1: (i32, i32, i32) -> i32
    TYPE.func, ...encodeLEB128(3), TYPE.i32, TYPE.i32, TYPE.i32, ...encodeLEB128(1), TYPE.i32,
    // Type 2: (i32, i32, i32, i32, i32) -> i32
    TYPE.func, ...encodeLEB128(5), TYPE.i32, TYPE.i32, TYPE.i32, TYPE.i32, TYPE.i32, ...encodeLEB128(1), TYPE.i32,
    // Type 3: (i32, i32, i32, i32) -> i32
    TYPE.func, ...encodeLEB128(4), TYPE.i32, TYPE.i32, TYPE.i32, TYPE.i32, ...encodeLEB128(1), TYPE.i32,
  ];
  const typeSection = createSection(1, [...encodeLEB128(4), ...types]);

  // 2. Function Section: maps each function index to its type index
  // fn 0: hash_fnv1a -> type 0
  // fn 1: normalize_alpha -> type 1
  // fn 2: estimate_tokens -> type 0
  // fn 3: levenshtein -> type 2
  // fn 4: fuzzy_score -> type 3
  const funcSection = createSection(3, [
    ...encodeLEB128(5), // 5 functions
    0, 1, 0, 2, 3
  ]);

  // 3. Memory Section (1 page = 64KB, max 10 pages)
  const memorySection = createSection(5, [
    ...encodeLEB128(1), // 1 memory
    0x01, // flags: has maximum
    ...encodeLEB128(1), // initial 1 page (64KB)
    ...encodeLEB128(10) // max 10 pages
  ]);

  // 4. Export Section
  const exports = [
    // memory: export 0 (mem index 0)
    ...encodeString("memory"), 0x02, 0x00,
    // fn 0: hash_fnv1a
    ...encodeString("hash_fnv1a"), 0x00, 0x00,
    // fn 1: normalize_alpha
    ...encodeString("normalize_alpha"), 0x00, 0x01,
    // fn 2: estimate_tokens
    ...encodeString("estimate_tokens"), 0x00, 0x02,
    // fn 3: levenshtein
    ...encodeString("levenshtein"), 0x00, 0x03,
    // fn 4: fuzzy_score
    ...encodeString("fuzzy_score"), 0x00, 0x04
  ];
  const exportSection = createSection(7, [
    ...encodeLEB128(6), // 6 exports
    ...exports
  ]);

  // 5. Code Section
  const codeBodies = [
    ...buildHashFnv1aCode(),
    ...buildNormalizeAlphaCode(),
    ...buildEstimateTokensCode(),
    ...buildLevenshteinCode(),
    ...buildFuzzyScoreCode()
  ];
  const codeSection = createSection(10, [
    ...encodeLEB128(5), // 5 code entries
    ...codeBodies
  ]);

  const binary = new Uint8Array([
    ...magic,
    ...version,
    ...typeSection,
    ...funcSection,
    ...memorySection,
    ...exportSection,
    ...codeSection
  ]);

  return binary;
}

// Generate, verify and save
async function main() {
  console.log('Generating Skill Extractor WebAssembly Engine binary...');
  const wasmBuffer = buildSkillEngineWasm();
  console.log(`Generated binary size: ${wasmBuffer.length} bytes`);

  // Verify instantiation with Node WebAssembly
  console.log('Verifying WASM module with Node.js WebAssembly.instantiate...');
  const module = await WebAssembly.instantiate(wasmBuffer);
  const { memory, hash_fnv1a, normalize_alpha, estimate_tokens, levenshtein, fuzzy_score } = module.instance.exports;

  // Test 1: Hash FNV-1a
  const memView = new Uint8Array(memory.buffer);
  const testText = "skills.sh extractor wasm engine";
  for (let i = 0; i < testText.length; i++) {
    memView[i] = testText.charCodeAt(i);
  }
  const hashVal = hash_fnv1a(0, testText.length);
  console.log(`✓ Test 1: hash_fnv1a("${testText}") = ${hashVal >>> 0} (0x${(hashVal >>> 0).toString(16)})`);

  // Test 2: Normalize Alpha
  const rawName = "SVG Logo Designer v2.0!";
  for (let i = 0; i < rawName.length; i++) memView[i] = rawName.charCodeAt(i);
  const normLen = normalize_alpha(0, rawName.length, 100);
  let normStr = "";
  for (let i = 0; i < normLen; i++) normStr += String.fromCharCode(memView[100 + i]);
  console.log(`✓ Test 2: normalize_alpha("${rawName}") = "${normStr}"`);
  if (normStr !== "svglogodesignerv20") throw new Error("Normalize test failed!");

  // Test 3: Estimate Tokens
  const promptSample = "You are an AI assistant specialized in SVG logo creation. Output valid SVG vector tags.";
  for (let i = 0; i < promptSample.length; i++) memView[i] = promptSample.charCodeAt(i);
  const tokenCount = estimate_tokens(0, promptSample.length);
  console.log(`✓ Test 3: estimate_tokens("${promptSample.slice(0, 30)}...") = ${tokenCount} tokens`);

  // Test 4: Levenshtein Distance
  const s1 = "svg-logo-designer";
  const s2 = "svg_logo_designer";
  for (let i = 0; i < s1.length; i++) memView[i] = s1.charCodeAt(i);
  for (let i = 0; i < s2.length; i++) memView[100 + i] = s2.charCodeAt(i);
  const dist = levenshtein(0, s1.length, 100, s2.length, 500);
  console.log(`✓ Test 4: levenshtein("${s1}", "${s2}") = ${dist}`);
  if (dist !== 2) throw new Error(`Levenshtein test failed, got ${dist}`);

  // Test 5: Fuzzy Score
  const query = "svglogo";
  const target = "skills/svg-logo-designer";
  for (let i = 0; i < query.length; i++) memView[i] = query.charCodeAt(i);
  for (let i = 0; i < target.length; i++) memView[100 + i] = target.charCodeAt(i);
  const score = fuzzy_score(0, query.length, 100, target.length);
  console.log(`✓ Test 5: fuzzy_score("${query}", "${target}") = ${score}/1000`);

  // Ensure output directories exist
  const wasmDir = path.join(__dirname, '..', 'src', 'wasm');
  if (!fs.existsSync(wasmDir)) {
    fs.mkdirSync(wasmDir, { recursive: true });
  }

  // Save .wasm file
  const wasmPath = path.join(wasmDir, 'engine.wasm');
  fs.writeFileSync(wasmPath, wasmBuffer);
  console.log(`Saved WASM binary to: ${wasmPath}`);

  // Save embedded base64 JS file for instant zero-fetch loading in browser
  const base64 = Buffer.from(wasmBuffer).toString('base64');
  const jsContent = `// Auto-generated WASM engine embedded bytecode
export const WASM_BINARY_BASE64 = "${base64}";
export const WASM_BYTE_SIZE = ${wasmBuffer.length};
`;
  const jsPath = path.join(wasmDir, 'wasmBinary.js');
  fs.writeFileSync(jsPath, jsContent, 'utf8');
  console.log(`Saved WASM embedded module to: ${jsPath}`);
  console.log('WebAssembly Engine ready!');
}

main().catch(err => {
  console.error('Build WASM failed:', err);
  process.exit(1);
});
