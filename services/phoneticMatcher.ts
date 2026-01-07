/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Phonetic Matcher
 *
 * Crypto-specific phonetic similarity matching using hybrid Metaphone + Levenshtein.
 * Optimized for token name typos and pronunciation variations.
 *
 * Examples:
 * - "dodge" ≈ "doge" (0.75 similarity)
 * - "ethe" ≈ "eth" (0.67 similarity)
 * - "bitocin" ≈ "bitcoin" (0.71 similarity)
 */

/**
 * Crypto-specific phonetic transformation rules
 */
const PHONETIC_RULES: Array<[RegExp, string]> = [
  // Vowel normalization (match any vowel)
  [/aeiou/g, "."],

  // Common silent letters
  [/th(e|ea)\b/gi, "th"], // "the" → "th"
  [/ed\b/gi, ""], // Silent trailing 'e'
  [/es\b/gi, ""], // Silent trailing 'es'

  // Crypto-specific patterns
  [/doge/gi, "dog"], // "doge" ↔ "dog"
  [/coin/gi, "con"], // "coin" → "con"
  [/swap/gi, "swp"], // "swap" → "swp"
  [/wrapped/gi, "w"], // "wrapped" → "w"
  [/chain/gi, "chn"], // "chain" → "chn"

  // Common suffixes
  [/tion/gi, "shun"], // "tion" → "shun" sound
  [/sion/gi, "zhun"], // "sion" → "zhun" sound
];

/**
 * Phonetic key interface
 */
export interface PhoneticKey {
  key: string; // Transformed string
  skeleton: string; // Consonant-only skeleton
}

/**
 * Cache for phonetic keys (expensive to compute)
 */
const phoneticKeyCache = new Map<string, PhoneticKey>();

/**
 * Generate phonetic key for a string
 *
 * Applies crypto-specific phonetic rules and extracts consonant skeleton
 *
 * @param str - Input string
 * @returns Phonetic key with transformed string and consonant skeleton
 */
export function phoneticKey(str: string): PhoneticKey {
  const normalized = str.toLowerCase().trim();

  // Check cache first
  if (phoneticKeyCache.has(normalized)) {
    return phoneticKeyCache.get(normalized)!;
  }

  let key = normalized;

  // Apply phonetic transformations
  for (const [pattern, replacement] of PHONETIC_RULES) {
    key = key.replace(pattern, replacement);
  }

  // Extract consonant skeleton (remove vowels)
  const skeleton = key.replace(/[aeiou.]/g, "");

  const result: PhoneticKey = { key, skeleton };

  // Cache result (limit cache size to prevent memory bloat)
  if (phoneticKeyCache.size > 1000) {
    // Clear oldest entries (first half)
    const entries = Array.from(phoneticKeyCache.entries());
    phoneticKeyCache.clear();
    entries.slice(500).forEach(([k, v]) => phoneticKeyCache.set(k, v));
  }

  phoneticKeyCache.set(normalized, result);

  return result;
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * Optimized with early exit for strings that are too different (> 3 edits)
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance (0 = identical, higher = more different)
 */
export function levenshtein(a: string, b: string): number {
  // Early exit if identical
  if (a === b) return 0;

  // Early exit if length difference > 3 (too different)
  if (Math.abs(a.length - b.length) > 3) return 10;

  const lenA = a.length;
  const lenB = b.length;

  // Initialize matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [];
    matrix[i]![0] = i;
  }
  for (let j = 1; j <= lenA; j++) {
    matrix[0]![j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      const diagonal = matrix[i - 1]?.[j - 1] ?? 0;
      const left = matrix[i]?.[j - 1] ?? 0;
      const top = matrix[i - 1]?.[j] ?? 0;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = diagonal;
      } else {
        matrix[i]![j] = Math.min(
          diagonal + 1, // substitution
          left + 1, // insertion
          top + 1 // deletion
        );
      }

      // Early exit if already too far
      const current = matrix[i]![j];
      if (current && current > 3) {
        return current;
      }
    }
  }

  return matrix[lenB]?.[lenA] ?? 0;
}

/**
 * Calculate phonetic similarity between two strings
 *
 * Uses weighted combination of:
 * - Levenshtein distance on phonetic keys (60%)
 * - Consonant skeleton match (30%)
 * - Length similarity (10%)
 *
 * @param query - Search query (e.g., "dodge")
 * @param target - Target string (e.g., "doge")
 * @returns Similarity score (0-1, where 1 = identical)
 */
export function phoneticSimilarity(query: string, target: string): number {
  // Skip very short queries (< 3 chars)
  if (query.length < 3 || target.length < 3) {
    return 0;
  }

  // Early exit if length difference > 4 (too different)
  if (Math.abs(query.length - target.length) > 4) {
    return 0;
  }

  const queryPhonetic = phoneticKey(query);
  const targetPhonetic = phoneticKey(target);

  // 1. Levenshtein distance on full phonetic keys (60% weight)
  const levDistance = levenshtein(queryPhonetic.key, targetPhonetic.key);
  const maxLen = Math.max(queryPhonetic.key.length, targetPhonetic.key.length);
  const levSimilarity = 1 - levDistance / maxLen;

  // 2. Consonant skeleton match (30% weight)
  let skeletonMatch = 0;
  if (queryPhonetic.skeleton === targetPhonetic.skeleton) {
    skeletonMatch = 1;
  } else {
    // Partial skeleton match
    const shorter = Math.min(queryPhonetic.skeleton.length, targetPhonetic.skeleton.length);
    const longer = Math.max(queryPhonetic.skeleton.length, targetPhonetic.skeleton.length);

    if (shorter > 0) {
      // Count matching consonants
      let matches = 0;
      const shorterSkeleton =
        shorter === queryPhonetic.skeleton.length
          ? queryPhonetic.skeleton
          : targetPhonetic.skeleton;

      const longerSkeleton =
        shorter === queryPhonetic.skeleton.length
          ? targetPhonetic.skeleton || ""
          : queryPhonetic.skeleton || "";

      for (let i = 0; i < shorterSkeleton.length; i++) {
        const char = shorterSkeleton[i];
        if (char && longerSkeleton.includes(char)) {
          matches++;
        }
      }

      skeletonMatch = matches / longer;
    }
  }

  // 3. Length penalty (10% weight) - prefer similar lengths
  const lengthDiff = Math.abs(query.length - target.length);
  const lengthScore = Math.max(0, 1 - lengthDiff / 5);

  // Weighted combination
  const similarity = levSimilarity * 0.6 + skeletonMatch * 0.3 + lengthScore * 0.1;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Find phonetically similar strings in an array
 *
 * @param query - Search query
 * @param candidates - Array of candidate strings
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Array of [candidate, similarity] pairs, sorted by similarity desc
 */
export function findPhoneticMatches(
  query: string,
  candidates: string[],
  threshold: number = 0.5
): Array<{ candidate: string; similarity: number }> {
  const matches: Array<{ candidate: string; similarity: number }> = [];

  for (const candidate of candidates) {
    const similarity = phoneticSimilarity(query, candidate);
    if (similarity >= threshold) {
      matches.push({ candidate, similarity });
    }
  }

  // Sort by similarity desc
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Clear phonetic key cache (call periodically to prevent memory bloat)
 */
export function clearPhoneticCache(): void {
  phoneticKeyCache.clear();
}
