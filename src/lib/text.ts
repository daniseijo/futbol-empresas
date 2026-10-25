/**
 * Length of the longest word in a name. Names wrap between words, but a single
 * word must fit its column: headings pick a smaller size for a long one
 * ("Telecomunicaciones") instead of cutting it or breaking it mid-word.
 */
export function longestWord(text: string): number {
  return Math.max(0, ...text.split(/\s+/).map((word) => word.length));
}
