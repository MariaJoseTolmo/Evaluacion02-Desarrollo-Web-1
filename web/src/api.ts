const TOKEN_KEY = 'eva02.token';

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (value: string) => localStorage.setItem(TOKEN_KEY, value),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Thrown for any non-2xx response, carrying the API's message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const jwt = token.get();
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    // Nest sends `message` as a string, or an array when validation fails.
    const message = Array.isArray(payload?.message)
      ? payload.message.join('. ')
      : (payload?.message ?? `Error ${response.status}`);
    throw new ApiError(message, response.status);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}
