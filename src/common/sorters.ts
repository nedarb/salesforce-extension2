/* eslint-disable import/prefer-default-export */

type Sorter<T> = (a: T, b: T) => number;
export function byStringSelector<T>(selector:(obj:T)=> string): Sorter<T> {
  return (a: T, b:T) => selector(a).localeCompare(selector(b));
}

export function reverse<T>(sorter: Sorter<T>): Sorter<T> {
  return (a: T, b:T) => -sorter(a, b);
}