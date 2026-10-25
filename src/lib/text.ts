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
