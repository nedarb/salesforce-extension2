/* eslint-disable import/prefer-default-export */
export function byStringSelector<T>(selector:(obj:T)=> string) {
  return (a: T, b:T) => selector(a).localeCompare(selector(b));
}
