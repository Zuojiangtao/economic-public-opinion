import type {
  ContentItem,
  ContentSearchParams,
  ContentStats,
  PaginatedResponse,
  MonitoringProject,
  MonitoringProjectInput,
  Alert,
  AlertHandleInput,
  AlertRule,
  AlertRuleInput,
  LexiconEntry,
  LexiconEntryInput,
  LexiconCategory,
  LoginRequest,
  LoginResponse,
  User,
  AlertStatus,
  RiskLevel,
} from './types';

const BASE_URL = '/api/v1';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<User>('/auth/me'),
};

export const contentsApi = {
  search: (params: ContentSearchParams) =>
    request<PaginatedResponse<ContentItem>>(`/contents${toQuery(params as Record<string, unknown>)}`),
  getById: (id: string) =>
    request<ContentItem>(`/contents/${id}`),
  getStats: (params?: { startDate?: string; endDate?: string; monitoringProjectId?: string }) =>
    request<ContentStats>(`/contents/stats${toQuery((params || {}) as Record<string, unknown>)}`),
};

export const monitoringApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    request<PaginatedResponse<MonitoringProject>>(`/monitoring-projects${toQuery((params || {}) as Record<string, unknown>)}`),
  getById: (id: string) =>
    request<MonitoringProject>(`/monitoring-projects/${id}`),
  create: (data: MonitoringProjectInput) =>
    request<MonitoringProject>('/monitoring-projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: MonitoringProjectInput) =>
    request<MonitoringProject>(`/monitoring-projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/monitoring-projects/${id}`, { method: 'DELETE' }),
};

export const alertsApi = {
  list: (params?: { status?: AlertStatus; riskLevel?: RiskLevel; page?: number; pageSize?: number }) =>
    request<PaginatedResponse<Alert>>(`/alerts${toQuery((params || {}) as Record<string, unknown>)}`),
  getById: (id: string) =>
    request<Alert>(`/alerts/${id}`),
  handle: (id: string, data: AlertHandleInput) =>
    request<Alert>(`/alerts/${id}/handle`, { method: 'POST', body: JSON.stringify(data) }),
};

export const alertRulesApi = {
  list: () => request<AlertRule[]>('/alert-rules'),
  create: (data: AlertRuleInput) =>
    request<AlertRule>('/alert-rules', { method: 'POST', body: JSON.stringify(data) }),
};

export const lexiconsApi = {
  list: (category?: LexiconCategory) =>
    request<LexiconEntry[]>(`/lexicons${category ? `?category=${category}` : ''}`),
  create: (data: LexiconEntryInput) =>
    request<LexiconEntry>('/lexicons', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/lexicons/${id}`, { method: 'DELETE' }),
};
