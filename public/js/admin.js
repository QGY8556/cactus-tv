const $ = selector => document.querySelector(selector);
const els = {
  notice: $('#adminNotice'), toast: $('#toast'), providerForm: $('#providerForm'), providerOriginalId: $('#providerOriginalId'), providerId: $('#providerId'),
  providerName: $('#providerName'), providerUrl: $('#providerUrl'), providerPriority: $('#providerPriority'), providerHosts: $('#providerHosts'), providerHeaders: $('#providerHeaders'),
  providerEnabled: $('#providerEnabled'), providerProxy: $('#providerProxy'), providerReset: $('#providerReset'), providerList: $('#providerList'), testAll: $('#testAll'),
  settingsForm: $('#settingsForm'), siteName: $('#siteName'), homeNotice: $('#homeNotice'),
  subtitleForm: $('#subtitleForm'), subtitleItemKey: $('#subtitleItemKey'), subtitleName: $('#subtitleName'), subtitleLang: $('#subtitleLang'), subtitleFormat: $('#subtitleFormat'), subtitleUrl: $('#subtitleUrl'), subtitleList: $('#subtitleList'),
  refreshAll: $('#refreshAll'), forgetAdminKey: $('#forgetAdminKey'), adminKeyDialog: $('#adminKeyDialog'), adminKeyForm: $('#adminKeyForm'), adminKeyInput: $('#adminKeyInput'), adminKeyMessage: $('#adminKeyMessage'),
};

const TOKEN_KEY = 'cactus:admin-token';
let adminToken = sessionStorage.getItem(TOKEN_KEY) || '';
let providers = [];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}
function toast(message, kind = '') {
  els.toast.textContent = message;
  els.toast.className = `toast ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add('hidden'), 3000);
}
function notice(message = '', kind = '') {
  els.notice.textContent = message;
  els.notice.className = `notice ${message ? '' : 'hidden'} ${kind}`;
}
function openAdminKey(message = '') {
  els.adminKeyMessage.textContent = message;
  els.adminKeyInput.value = '';
  if (!els.adminKeyDialog.open) els.adminKeyDialog.showModal();
  setTimeout(() => els.adminKeyInput.focus(), 50);
}

async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (adminToken) headers.set('Authorization', `Bearer ${adminToken}`);
  const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.status = response.status;
    error.code = payload.code;
    if (response.status === 401) {
      adminToken = '';
      sessionStorage.removeItem(TOKEN_KEY);
    }
    throw error;
  }
  return payload;
}

function resetProvider() {
  els.providerForm.reset();
  els.providerOriginalId.value = '';
  els.providerPriority.value = '0';
  els.providerHeaders.value = '{}';
  els.providerEnabled.checked = true;
  els.providerProxy.checked = false;
  els.providerId.disabled = false;
}
function providerPayload() {
  let headers = {};
  try { headers = JSON.parse(els.providerHeaders.value || '{}'); }
  catch { throw new Error('请求头必须是合法 JSON'); }
  return {
    id: els.providerId.value.trim(), name: els.providerName.value.trim(), baseUrl: els.providerUrl.value.trim(),
    priority: Number(els.providerPriority.value || 0), mediaHosts: els.providerHosts.value.split(',').map(value => value.trim()).filter(Boolean),
    requestHeaders: headers, enabled: els.providerEnabled.checked, proxyEnabled: els.providerProxy.checked,
  };
}

async function loadProviders() {
  const payload = await request('/api/admin/providers');
  providers = payload.providers || [];
  els.providerList.innerHTML = providers.length ? providers.map(provider => {
    const health = provider.health;
    return `<div class="admin-item"><div><strong>${escapeHtml(provider.name)} <span class="${provider.enabled ? 'health-ok' : 'muted'}">${provider.enabled ? '启用' : '停用'}</span></strong><small>${escapeHtml(provider.id)} · ${escapeHtml(provider.baseUrl)}</small><small>优先级 ${provider.priority} · ${provider.proxyEnabled ? '代理已开' : '直连'} · ${(provider.mediaHosts || []).length} 个媒体域名</small><small class="${health?.ok ? 'health-ok' : health ? 'health-bad' : 'muted'}">${health ? health.ok ? `最近测速 ${health.latency_ms}ms` : `异常：${escapeHtml(health.last_error || '未知')}` : '尚未测速'}</small></div><div class="admin-actions"><button class="mini-button" data-test="${escapeHtml(provider.id)}">测速</button><button class="mini-button" data-edit="${escapeHtml(provider.id)}">编辑</button><button class="mini-button danger" data-delete="${escapeHtml(provider.id)}">删除</button></div></div>`;
  }).join('') : '<p class="muted">暂无数据源。</p>';
  els.providerList.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editProvider(button.dataset.edit)));
  els.providerList.querySelectorAll('[data-test]').forEach(button => button.addEventListener('click', () => testProviders(button.dataset.test)));
  els.providerList.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteProvider(button.dataset.delete)));
}
function editProvider(id) {
  const provider = providers.find(item => item.id === id);
  if (!provider) return;
  els.providerOriginalId.value = provider.id;
  els.providerId.value = provider.id;
  els.providerId.disabled = true;
  els.providerName.value = provider.name;
  els.providerUrl.value = provider.baseUrl;
  els.providerPriority.value = provider.priority;
  els.providerHosts.value = (provider.mediaHosts || []).join(', ');
  els.providerHeaders.value = JSON.stringify(provider.requestHeaders || {}, null, 2);
  els.providerEnabled.checked = provider.enabled;
  els.providerProxy.checked = provider.proxyEnabled;
  scrollTo({ top: 0, behavior: 'smooth' });
}
async function deleteProvider(id) {
  if (!confirm(`删除数据源 ${id}？`)) return;
  try {
    await request(`/api/admin/providers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('已删除');
    await loadProviders();
  } catch (error) { handleError(error); }
}
async function testProviders(providerId) {
  try {
    toast('正在测速…');
    const payload = await request('/api/admin/health', { method: 'POST', body: JSON.stringify(providerId ? { providerId } : {}) });
    const failed = payload.results.filter(result => !result.ok);
    toast(failed.length ? `${failed.length} 个源不可用` : '测速完成', failed.length ? 'error' : '');
    await loadProviders();
  } catch (error) { handleError(error); }
}

async function loadSettings() {
  const payload = await request('/api/admin/settings');
  const settings = payload.settings || {};
  els.siteName.value = settings.site_name || 'Cactus TV';
  els.homeNotice.value = settings.home_notice || '';
}
async function loadSubtitles() {
  const payload = await request('/api/admin/subtitles');
  els.subtitleList.innerHTML = (payload.subtitles || []).map(subtitle => `<div class="admin-item"><div><strong>${escapeHtml(subtitle.name)}</strong><small>${escapeHtml(subtitle.item_key)} · ${escapeHtml(subtitle.lang)} · ${escapeHtml(subtitle.format)}</small><small>${escapeHtml(subtitle.url)}</small></div><button class="mini-button danger" data-delete-subtitle="${subtitle.id}">删除</button></div>`).join('') || '<p class="muted">暂无字幕。</p>';
  els.subtitleList.querySelectorAll('[data-delete-subtitle]').forEach(button => button.addEventListener('click', async () => {
    try {
      await request(`/api/admin/subtitles/${button.dataset.deleteSubtitle}`, { method: 'DELETE' });
      toast('字幕已删除');
      await loadSubtitles();
    } catch (error) { handleError(error); }
  }));
}

function handleError(error) {
  if (error.status === 401) {
    openAdminKey('管理密钥无效，请重新输入。');
    return;
  }
  notice(error.message, 'error');
  toast(error.message, 'error');
}
async function loadAll() {
  notice('');
  try {
    await Promise.all([loadProviders(), loadSettings(), loadSubtitles()]);
  } catch (error) { handleError(error); }
}

els.adminKeyForm.addEventListener('submit', async event => {
  event.preventDefault();
  const token = els.adminKeyInput.value.trim();
  if (token.length < 16) {
    els.adminKeyMessage.textContent = '管理密钥至少需要 16 个字符。';
    return;
  }
  adminToken = token;
  try {
    await request('/api/admin/settings');
    sessionStorage.setItem(TOKEN_KEY, adminToken);
    els.adminKeyDialog.close();
    els.adminKeyMessage.textContent = '';
    await loadAll();
  } catch (error) {
    adminToken = '';
    sessionStorage.removeItem(TOKEN_KEY);
    els.adminKeyMessage.textContent = error.message;
  }
});
els.forgetAdminKey.addEventListener('click', () => {
  adminToken = '';
  sessionStorage.removeItem(TOKEN_KEY);
  openAdminKey('管理密钥已从当前标签页清除。');
});

document.querySelectorAll('.admin-tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${tab.dataset.panel}`));
}));
els.providerForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const payload = providerPayload();
    const existing = els.providerOriginalId.value;
    if (existing) await request(`/api/admin/providers/${encodeURIComponent(existing)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    else await request('/api/admin/providers', { method: 'POST', body: JSON.stringify(payload) });
    toast('数据源已保存');
    resetProvider();
    await loadProviders();
  } catch (error) { handleError(error); }
});
els.providerReset.addEventListener('click', resetProvider);
els.testAll.addEventListener('click', () => testProviders());
els.settingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await request('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ site_name: els.siteName.value.trim(), home_notice: els.homeNotice.value.trim() }) });
    toast('设置已保存');
  } catch (error) { handleError(error); }
});
els.subtitleForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await request('/api/admin/subtitles', { method: 'POST', body: JSON.stringify({ itemKey: els.subtitleItemKey.value.trim(), name: els.subtitleName.value.trim(), lang: els.subtitleLang.value.trim(), format: els.subtitleFormat.value, url: els.subtitleUrl.value.trim() }) });
    els.subtitleForm.reset();
    els.subtitleLang.value = 'zh';
    toast('字幕已添加');
    await loadSubtitles();
  } catch (error) { handleError(error); }
});
els.refreshAll.addEventListener('click', loadAll);
window.addEventListener('unhandledrejection', event => handleError(event.reason instanceof Error ? event.reason : new Error('后台发生错误')));

(async () => {
  if (!adminToken) {
    openAdminKey();
    return;
  }
  await loadAll();
})();
