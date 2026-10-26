/**
 * Length of the longest word in a name. Names wrap between words, but a single
 * word must fit its column.
 */
export function longestWord(text: string): number {
  return Math.max(0, ...text.split(/\s+/).map((word) => word.length));
}

/**
 * A font size that keeps a name at its normal size and only shrinks it when
 * its longest word would not fit the width: `var(--base)` at most, never
 * below `var(--min)`. The width is `var(--fit-width)`, or the nearest
 * container's (an element with Tailwind's `@container`). `emPerChar` is the
 * typeface's average letter width (about 0.43 for uppercase Barlow Condensed,
 * 0.6 for Inter bold), on the generous side so a wide word still fits.
 */
export function fitFontSize(text: string, emPerChar: number): string {
  const ems = Math.max(1, longestWord(text)) * emPerChar;
  return `clamp(var(--min), calc(var(--fit-width, 100cqi) / ${Number(ems.toFixed(2))}), var(--base))`;
}

/** Lines `text` takes when wrapped between words in `chars` letters per line. */
function linesAt(text: string, chars: number): number {
  let lines = 1;
  let used = -1;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (used >= 0 && used + 1 + word.length > chars) {
      lines += 1;
      used = word.length;
    } else {
      used += 1 + word.length;
    }
  }
  return lines;
}

/**
 * The same idea in pixels, for the share images (Satori has no container
 * queries): `base` unless the longest word would not fit `width` or the name
 * would need more than `maxLines` lines, then the largest size that fits,
 * never below `min`.
 */
export function fitPixelSize(text: string, { width, base, min, maxLines, emPerChar }: { width: number; base: number; min: number; maxLines: number; emPerChar: number }): number {
  for (let size = base; size > min; size -= 2) {
    const chars = Math.floor(width / (size * emPerChar));
    if (longestWord(text) <= chars && linesAt(text, chars) <= maxLines) return size;
  }
  return min;
}
