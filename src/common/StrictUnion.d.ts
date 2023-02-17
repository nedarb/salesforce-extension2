type UnionKeys<T> = T extends T ? keyof T : never;
type StrictUnionHelper<T, TAll> = T extends any
  ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, undefined>>
  : never;
/**
 * This allows union types that are "strict" or exclusive - making all extra properties never'ed.
 *
 * @example
 * type NonStrictUnion = { id: string } | { ns: string };
 * const ok: NonStrictUnion = { id: '123', ns: 'something' }; // VALID but unexpected because it's ambiguous as to which of the union types it is.
 * type Strict = StrictUnion<{ id: string } | { ns: string }>;
 * const err: Strict = { id: '123', ns: 'something' }; // ERROR
 */
export type StrictUnion<T> = StrictUnionHelper<T, T>;
