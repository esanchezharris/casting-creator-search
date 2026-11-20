/** Edit distance where swapping two neighbouring letters counts as one edit ("flordia" -> "florida"). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * The closest candidate to a probably-misspelled word, or null. Deliberately
 * strict so real words are not "corrected": words under five letters never
 * match, the first letter has to agree, and only one edit is allowed (two for
 * words of eight letters or more).
 */
export function closest(word: string, candidates: Iterable<string>): string | null {
  if (word.length < 5 || /\d/.test(word)) return null;
  const limit = word.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestD = limit + 1;
  for (const c of candidates) {
    if (c[0] !== word[0] || Math.abs(c.length - word.length) > limit) continue;
    const dist = editDistance(word, c);
    if (dist < bestD) { best = c; bestD = dist; }
  }
  return best;
}
