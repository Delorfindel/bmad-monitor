/**
 * Runs `worker` over `items` with a bounded number of in-flight calls, keeping
 * results in input order. Bounded concurrency matters here because the GitHub
 * API punishes bursts far harder than it punishes latency.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) throw new RangeError('concurrency limit must be >= 1')
  const results = new Array<R>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index] as T, index)
    }
  })

  await Promise.all(runners)
  return results
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
