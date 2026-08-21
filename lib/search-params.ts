// A repeated query key arrives as an array (`?next=/a&next=/b`). Taking the
// first value keeps a duplicated key from widening a param's type at every
// call site.
export function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
