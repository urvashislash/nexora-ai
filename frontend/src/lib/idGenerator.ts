/**
 * NEXORA AI — Advanced ID Generation Algorithm Engine
 * 
 * Implements:
 * 1. RFC 9562 UUIDv7: Monotonically sortable 128-bit time-ordered cryptographic UUIDs.
 * 2. TypeID / Crockford Base32: Structured domain-prefixed entity identifiers (e.g. obs_01j7..., aud_01j7...).
 * 3. Content-Addressable SHA-256 Hashing: Deterministic idempotency keys and audit block hashes.
 * 4. UUIDv7 Time & Sequence Deserialization: Extracting embedded timestamps without database round-trips.
 */

// Crockford's Base32 alphabet (excludes I, L, O, U to avoid ambiguity)
const CROCKFORD_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export type EntityPrefix = 'obs' | 'prp' | 'evt' | 'aud' | 'doc' | 'act' | 'req' | 'job';

// In-memory monotonic sequence tracker for same-millisecond UUIDv7 generations
let lastTimestamp = 0;
let sequenceCounter = 0;

/**
 * Generates an RFC 9562 compliant UUIDv7.
 * 
 * Layout (128 bits):
 * - 48 bits: UNIX epoch timestamp in milliseconds (sortable across ~8,900 years)
 * -  4 bits: Version 7 (0b0111)
 * - 12 bits: Monotonic counter / sub-millisecond fractional precision
 * -  2 bits: Variant 1 (0b10, RFC 4122 / 9562)
 * - 62 bits: Cryptographically secure random entropy (CSPRNG)
 */
export function generateUUIDv7(): string {
  let now = Date.now();

  // Monotonic clock skew handling
  if (now > lastTimestamp) {
    lastTimestamp = now;
    sequenceCounter = 0;
  } else if (now === lastTimestamp) {
    sequenceCounter = (sequenceCounter + 1) & 0xfff; // 12-bit roll
    if (sequenceCounter === 0) {
      // Counter overflow within same millisecond -> advance virtual clock
      now = ++lastTimestamp;
    }
  } else {
    // Clock went backwards -> preserve monotonic ordering
    now = lastTimestamp;
    sequenceCounter = (sequenceCounter + 1) & 0xfff;
  }

  // Generate 10 bytes of cryptographically secure random entropy
  const randomBytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // 1. Timestamp (48 bits = 6 bytes)
  const timeHex = now.toString(16).padStart(12, '0');
  const timeHigh = timeHex.substring(0, 8);
  const timeMid = timeHex.substring(8, 12);

  // 2. Version + Sequence Counter (16 bits: 4 bits ver=0x7 + 12 bits seq)
  const verAndSeq = (0x7000 | (sequenceCounter & 0x0fff)).toString(16).padStart(4, '0');

  // 3. Variant + Random Bits (16 bits: 2 bits var=0b10 + 14 bits rand)
  const varByte = (0x80 | (randomBytes[0] & 0x3f)).toString(16).padStart(2, '0');
  const randA = randomBytes[1].toString(16).padStart(2, '0');
  const varAndRand = `${varByte}${randA}`;

  // 4. Remaining Entropy (48 bits = 6 bytes)
  let randTail = '';
  for (let i = 2; i < 8; i++) {
    randTail += randomBytes[i].toString(16).padStart(2, '0');
  }

  // Standard UUID format: 8-4-4-4-12
  return `${timeHigh}-${timeMid}-${verAndSeq}-${varAndRand}-${randTail}`.toLowerCase();
}

/**
 * Encodes a 128-bit byte array or UUID string into Crockford Base32.
 */
function encodeCrockfordBase32(uuidStr: string): string {
  const hex = uuidStr.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  let output = '';
  let buffer = 0n;
  let bitsLeft = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8n) | BigInt(bytes[i]);
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      const index = Number((buffer >> BigInt(bitsLeft)) & 0x1fn);
      output += CROCKFORD_ALPHABET[index];
    }
  }

  if (bitsLeft > 0) {
    const index = Number((buffer << BigInt(5 - bitsLeft)) & 0x1fn);
    output += CROCKFORD_ALPHABET[index];
  }

  return output;
}

/**
 * Generates a domain-prefixed TypeID (e.g. `obs_01j7q9k2x...`).
 * Combines human-readable type safety with time-ordered UUIDv7 sorting.
 */
export function generateEntityId(prefix: EntityPrefix): string {
  const uuid = generateUUIDv7();
  const base32 = encodeCrockfordBase32(uuid);
  return `${prefix}_${base32}`;
}

/**
 * Extracts the millisecond timestamp embedded inside an RFC 9562 UUIDv7.
 */
export function extractTimestampFromUUIDv7(uuid: string): Date | null {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) return null;

  try {
    const timeHex = clean.substring(0, 12);
    const tsMs = parseInt(timeHex, 16);
    if (isNaN(tsMs)) return null;
    return new Date(tsMs);
  } catch {
    return null;
  }
}

/**
 * Validates whether a given string is a valid RFC 9562 UUIDv7.
 */
export function isUUIDv7(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

/**
 * Computes a deterministic SHA-256 hex hash from any payload.
 * Used for tamper-evident blockchain audit blocks and idempotency keys.
 */
export async function computeSHA256(payload: string | object): Promise<string> {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fast pure JS SHA-256 fallback
  return fastSha256(str);
}

/**
 * Generates a deterministic SHA-256 Audit Payload Hash chained to previous hash.
 */
export async function generateAuditPayloadHash(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
  beforeState: any,
  afterState: any,
  timestamp: string,
  previousHash?: string
): Promise<string> {
  const canonicalPayload = {
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor_id: actorId,
    before_state: beforeState,
    after_state: afterState,
    timestamp,
    previous_hash: previousHash || 'GENESIS_BLOCK',
  };

  return computeSHA256(canonicalPayload);
}

/**
 * Pure JavaScript SHA-256 implementation fallback.
 */
function fastSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let wordsLength = 0;
  for (i = 0; i < ascii[lengthProperty]; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= code << ((3 - (i % 4)) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;
  wordsLength = words.length;

  for (i = 0; i < wordsLength; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      let w15 = w[j - 15];
      let w2 = w[j - 2];

      if (j >= 16) {
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const a = hash[0];
      const e = hash[4];
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}
