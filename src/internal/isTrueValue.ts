/**
 * Checks whether a string value looks like true or false. If neither of those,
 * returns undefined.
 */
export function isTrueValue(value: unknown): boolean | undefined {
  return ["yes", "true", "1", "on"].includes(String(value).toLowerCase())
    ? true
    : ["no", "false", "0", "off"].includes(String(value).toLowerCase())
      ? false
      : undefined;
}
