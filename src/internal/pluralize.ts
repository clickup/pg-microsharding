export function pluralize(
  n: number,
  noun: string,
  nounPlural?: string,
): string {
  return n + " " + (n === 1 ? noun : justPluralize(noun, nounPlural));
}

export function simplePluralize(
  n: number,
  noun: string,
  nounPlural?: string,
): string {
  return n === 1 ? noun : justPluralize(noun, nounPlural);
}

export function justPluralize(
  noun: string,
  nounPlural: string | undefined,
): string {
  if (nounPlural) {
    return nounPlural;
  } else {
    const suffix = noun.match(/(ch|sh|s|x|z)$/i) ? "es" : "s";
    return noun + suffix;
  }
}
