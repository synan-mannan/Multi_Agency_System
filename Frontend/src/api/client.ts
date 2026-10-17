export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const SESSION_KEY = 'agencydesk.session';

function authHeader(): Record<string, string> {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return {};
  try {
    const session: { token?: string } = JSON.parse(stored);
    return session.token ? { Authorization: `Bearer ${session.token}` } : {};
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return {};
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed';
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      const detail = body.detail;
      message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    }
  } catch {
    // Non-JSON error responses retain the HTTP status text.
  }
  return new ApiError(response.status, response.status === 403 ? "You don't have permission" : message);
}

async function handleFailure(response: Response): Promise<never> {
  const error = await parseError(response);
  if (response.status === 401) {
    sessionStorage.removeItem(SESSION_KEY);
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }
  throw error;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(authHeader())) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Can't reach server");
  }
  if (!response.ok) return handleFailure(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    for (const [key, value] of Object.entries(authHeader())) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(0, "Can't reach server"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') ?? '' },
        });
        void handleFailure(response).catch(reject);
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch {
        reject(new ApiError(xhr.status, 'Invalid server response'));
      }
    };
    xhr.send(form);
  });
}

export async function downloadFile(id: string): Promise<void> {
  const headers = new Headers(authHeader());
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}/download`, { headers });
  } catch {
    throw new ApiError(0, "Can't reach server");
  }
  if (!response.ok) return handleFailure(response);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'download';
  link.click();
  URL.revokeObjectURL(objectUrl);
}
