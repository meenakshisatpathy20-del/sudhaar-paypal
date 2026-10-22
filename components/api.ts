/** JSON request to our own API. `timeoutMs` stops waiting and throws instead of hanging forever. */
export async function api<T = unknown>(url: string, body?: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = opts.timeoutMs ? new AbortController() : undefined;
  const timer = ctrl && setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: ctrl?.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("This is taking too long. Please try again.");
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const money = (n: number) => `$${n.toFixed(2)}`;
