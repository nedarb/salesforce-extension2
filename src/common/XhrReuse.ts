export default class XhrReuse<T = Response> {
  private readonly ongoingCalls = new Map<string, Promise<T>>();

  public async fetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
    transformer: (response: Response) => PromiseLike<T>,
  ) {
    const cacheKey = JSON.stringify(input);
    const existing = this.ongoingCalls.get(cacheKey);
    if (existing) {
      console.warn('reusing existing', cacheKey);
      return existing;
    }

    const result = fetch(input, init).then(transformer);
    this.ongoingCalls.set(cacheKey, result);
    result.finally(() => this.ongoingCalls.delete(cacheKey));
    return result;
  }
}
