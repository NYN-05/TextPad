const DEFAULT_TIMEOUT = 8000;

export class Transport {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { "Content-Type": "application/json", ...(extra ?? {}) };
  }

  async fetch(input: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: unknown }> {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT);
      const url = input.startsWith("http") ? input : `${this.baseUrl}${input}`;
      const res = await fetch(url, {
        ...init,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: ctrl.signal,
      });
      clearTimeout(id);
      let data: unknown;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      }
      if (!res.ok) {
        console.warn(`[transport] ${init?.method || "GET"} ${url} -> ${res.status}`);
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.warn(`[transport] ${init?.method || "GET"} ${input} failed:`, err instanceof Error ? err.message : err);
      return { ok: false, status: 0 };
    }
  }

  async post(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<{ ok: boolean; status: number; data?: unknown }> {
    return this.fetch(path, {
      method: "POST",
      headers: this.headers(extraHeaders),
      body: JSON.stringify(body),
    });
  }

  async get(path: string, extraHeaders?: Record<string, string>): Promise<{ ok: boolean; status: number; data?: unknown }> {
    return this.fetch(path, { headers: this.headers(extraHeaders) });
  }

  async del(path: string, extraHeaders?: Record<string, string>): Promise<{ ok: boolean; status: number; data?: unknown }> {
    return this.fetch(path, { method: "DELETE", headers: this.headers(extraHeaders) });
  }
}
