/** API contracts use the backend's field names so requests need no translation. */
export type Role = 'plaintiff' | 'attorney' | 'paralegal' | 'admin';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  firm_id: string | null;
}
export interface LoginRequest {
  email: string;
  password: string;
}
interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Shared transport for JSON and PDFs. Callers decide how to read the response. */
export async function requestResponse(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // The browser adds the multipart boundary for uploads; setting it here would break them.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers });
  } catch (error) {
    // Cancellation is normal when leaving a page, so keep it distinct from an outage.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'Unable to reach the server. Please try again.');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    const message = typeof detail === 'string' ? detail : 'The request could not be completed.';
    throw new ApiError(response.status, message);
  }
  return response;
}

/** T describes the expected DTO; validation and access checks still happen on the API. */
export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await requestResponse(path, options, token);
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function login(data: LoginRequest): Promise<LoginResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
}

export function getUser(token: string, signal?: AbortSignal): Promise<User> {
  return request('/auth/me', { signal }, token);
}
