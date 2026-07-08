async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.code = payload.code;
    error.status = response.status;
    error.requestId = payload.requestId;
    throw error;
  }
  return payload;
}

export const api = {
  health: () => request('/api/health'),
  home: () => request('/api/home'),
  search: query => request(`/api/search?q=${encodeURIComponent(query)}`),
  detail: (provider, id) => request(`/api/detail?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}`),
};
