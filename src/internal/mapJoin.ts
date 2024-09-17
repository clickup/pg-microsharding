/**
 * A syntax sugar for Promise.all().
 */
export async function mapJoin<TElem, TRet>(
  arr: readonly TElem[] | Promise<readonly TElem[]>,
  func: (e: TElem, idx: number) => PromiseLike<TRet> | TRet,
): Promise<TRet[]> {
  return Promise.all((await arr).map((e, idx) => func(e, idx)));
}
