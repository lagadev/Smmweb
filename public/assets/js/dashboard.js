// =====================================================
// Dashboard logic (v9)
// =====================================================
const el = (id) => document.getElementById(id);
function escapeHTML(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function money(n){ return (Number(n) || 0).toFixed(2); }
function money8(n){ return (Number(n) || 0).toFixed(8); }
function emptyState(icon, text){ return `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${escapeHTML(text)}</p></div>`; }

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let state = {
  user: null,
  settings: {},
  platforms: [],
  categories: [],
  services: [],
  visibleServices: [],
  selectedPlatform: null,
  selectedCategory: null,
  selectedService: null,
};

// ---------------- Drawer (mobile sidebar) ----------------
function openDrawer(){ el('dash-sidebar').classList.add('open'); el('dash-overlay').classList.add('show'); }
function closeDrawer(){ el('dash-sidebar').classList.remove('open'); el('dash-overlay').classList.remove('show'); }

// ---------------- View switching ----------------
const VIEW_TITLES = {
  'new-order': 'New Order', 'bulk-order': 'Bulk Order', 'orders-history': 'Orders History',
  'services': 'Services', 'add-funds': 'Add Funds', 'api': 'API Access',
};
function switchView(name){
  document.querySelectorAll('.dash-view').forEach(v => v.classList.add('hidden'));
  el('view-' + name).classList.remove('hidden');
  document.querySelectorAll('.dash-nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  el('view-title').textContent = VIEW_TITLES[name] || 'Dashboard';
  closeDrawer();
  if (name === 'orders-history') renderOrdersHistory();
  if (name === 'services') renderCatalog();
  if (name === 'add-funds') renderDepositRequests();
  if (name === 'api') renderDocs();
}

// ---------------- Auth guard ----------------
async function guardAndInit(){
  try{
    const { user } = await api('/api/me');
    state.user = user;
  }catch(e){
    window.location.href = 'login.html';
    return;
  }
  await boot();
}

function updateProfileUI(){
  const u = state.user;
  el('dash-username').textContent = u.username;
  el('dash-avatar').textContent = (u.name || u.username || 'U').charAt(0).toUpperCase();
}
function updateBalanceUI(){
  el('topbar-balance').textContent = money(state.user.balance);
}

async function loadSettings(){
  const { settings } = await api('/api/settings/public');
  state.settings = settings;
  const sym = settings.currency_symbol || '৳';
  el('topbar-currency').textContent = sym;
  el('funds-currency-sym').textContent = sym;
}

async function loadStats(){
  try{
    const { stats } = await api('/api/user/stats');
    const sym = state.settings.currency_symbol || '$';
    el('stat-orders').textContent = stats.total_orders;
    el('stat-spent').textContent = sym + money(stats.total_spent);
    el('stat-earned').textContent = sym + money(stats.total_earned);
  }catch(e){}
}

// ---------------- New Order: platform grid ----------------
function renderPlatformGrid(){
  const grid = el('platform-grid');
  grid.innerHTML = state.platforms.map(p => `
    <button type="button" class="platform-item" data-id="${p.id}" title="${escapeHTML(p.name)}">
      <i class="${escapeHTML(p.icon || 'fa-solid fa-star')}"></i>
    </button>`).join('');
  grid.querySelectorAll('.platform-item').forEach(btn => btn.addEventListener('click', () => selectPlatform(Number(btn.dataset.id))));
}

async function selectPlatform(platformId){
  state.selectedPlatform = state.platforms.find(p => p.id === platformId) || null;
  document.querySelectorAll('.platform-item').forEach(b => b.classList.toggle('selected', Number(b.dataset.id) === platformId));

  const { categories } = await api(`/api/categories?platform_id=${platformId}`);
  state.categories = categories;
  state.selectedCategory = null; state.selectedService = null;
  el('category-dd-header').disabled = false;
  setDropdownHeader('category', null);
  setDropdownHeader('service', null, 'Select a category first');
  el('service-dd-header').disabled = true;
  renderCategoryDropdownList();
  el('service-detail-card').classList.add('hidden');
  clearOrderFields();
}

function toggleDropdown(name, forceState){
  const dd = el(name + '-dd'); const list = el(name + '-dd-list');
  const isOpen = forceState != null ? forceState : list.classList.contains('hidden');
  document.querySelectorAll('.dd-list').forEach(l => { if (l !== list) l.classList.add('hidden'); });
  document.querySelectorAll('.dd').forEach(d => { if (d !== dd) d.classList.remove('open'); });
  list.classList.toggle('hidden', !isOpen);
  dd.classList.toggle('open', isOpen);
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dd')) { document.querySelectorAll('.dd-list').forEach(l => l.classList.add('hidden')); document.querySelectorAll('.dd').forEach(d => d.classList.remove('open')); }
});
function setDropdownHeader(name, html, placeholder){
  el(name + '-dd-header').querySelector('.dd-header-content').innerHTML = html || `<span class="dd-placeholder">${escapeHTML(placeholder || 'Select an option')}</span>`;
}
function renderCategoryDropdownList(){
  const list = el('category-dd-list');
  list.innerHTML = state.categories.length ? state.categories.map(c => `
    <div class="dd-item" data-id="${c.id}">
      <div class="dd-icon"><i class="${escapeHTML(c.icon || state.selectedPlatform.icon)}"></i></div>
      <div class="dd-item-text">${escapeHTML(c.name)}</div>
      ${c.tag ? `<span class="dd-tag">${escapeHTML(c.tag)}</span>` : ''}
    </div>`).join('') : `<div class="dd-empty">No categories for this platform yet</div>`;
  list.querySelectorAll('.dd-item').forEach(item => item.addEventListener('click', () => selectCategory(Number(item.dataset.id))));
  el('category-dd-header').onclick = () => toggleDropdown('category');
}
async function selectCategory(categoryId){
  state.selectedCategory = state.categories.find(c => c.id === categoryId) || null;
  toggleDropdown('category', false);
  const c = state.selectedCategory;
  setDropdownHeader('category', `<div class="dd-icon"><i class="${escapeHTML(c.icon || state.selectedPlatform.icon)}"></i></div><span class="dd-text">${escapeHTML(c.name)}</span>`);
  const { services } = await api(`/api/services?category_id=${categoryId}`);
  state.visibleServices = services;
  state.selectedService = null;
  el('service-dd-header').disabled = false;
  setDropdownHeader('service', null);
  renderServiceDropdownList(services);
  el('service-detail-card').classList.add('hidden');
  clearOrderFields();
}
function renderServiceDropdownList(services){
  const list = el('service-dd-list');
  const sym = state.settings.currency_symbol || '$';
  list.innerHTML = services.length ? services.map(s => `
    <div class="dd-item" data-id="${s.public_id}">
      <span class="dd-badge">${s.public_id}</span>
      <div class="dd-item-text">${escapeHTML(s.name)} ~ ${sym}${money8(s.rate)}/1000</div>
    </div>`).join('') : `<div class="dd-empty">No services in this category yet</div>`;
  list.querySelectorAll('.dd-item').forEach(item => item.addEventListener('click', () => selectService(item.dataset.id)));
  el('service-dd-header').onclick = () => toggleDropdown('service');
}
function selectService(publicId){
  const pool = state.visibleServices.length ? state.visibleServices : state.services;
  state.selectedService = pool.find(s => String(s.public_id) === String(publicId)) || null;
  toggleDropdown('service', false);
  const s = state.selectedService; const card = el('service-detail-card'); const sym = state.settings.currency_symbol || '$';
  if (s){
    setDropdownHeader('service', `<span class="dd-badge">${s.public_id}</span><span class="dd-text">${escapeHTML(s.name)}</span>`);
    el('qty-hint').textContent = `Min: ${s.min_qty.toLocaleString()} - Max: ${s.max_qty.toLocaleString()}`;
    el('order-qty').placeholder = `Between ${s.min_qty} and ${s.max_qty}`;
    el('order-avgtime').value = s.avg_time || '—';
    const refillText = s.refill_days > 0 ? `${s.refill_days} Days` : 'No Refill';
    el('sdc-id').textContent = '#' + s.public_id;
    el('sdc-title').textContent = `${s.public_id} - ${s.name} ~ Max ${s.max_qty.toLocaleString()} ~ ${s.speed_info || ''} ~ ${s.start_type || ''} ~ ${refillText} ~ ${sym}${money8(s.rate)} per 1000`;
    el('sdc-link-type').textContent = s.link_type || '—';
    el('sdc-start').textContent = s.start_type || '—';
    el('sdc-speed').textContent = s.speed_info || '—';
    el('sdc-refill').textContent = refillText;
    el('sdc-desc').textContent = s.description || '—';
    el('sdc-desc-row').classList.toggle('hidden', !s.description);
    card.classList.remove('hidden');
  } else { el('qty-hint').textContent = 'Min: — · Max: —'; el('order-avgtime').value = '—'; card.classList.add('hidden'); }
  recomputeCharge();
}

async function loadAllServicesForSearch(){ const { services } = await api('/api/services'); state.services = services; }
function handleSearch(){
  const q = el('service-search').value.trim().toLowerCase();
  if (!q) return;
  const filtered = state.services.filter(s => s.name.toLowerCase().includes(q) || String(s.public_id).includes(q));
  el('service-dd-header').disabled = false;
  state.visibleServices = filtered;
  renderServiceDropdownList(filtered);
  toggleDropdown('service', true);
}

function recomputeCharge(){
  const s = state.selectedService;
  const qty = parseInt(el('order-qty').value, 10);
  const link = el('order-link').value.trim();
  const sym = state.settings.currency_symbol || '$';
  if (!s){ el('order-charge-field').value = ''; el('confirm-order-button').disabled = true; return; }
  let charge = 0, valid = false;
  if (Number.isFinite(qty) && qty >= s.min_qty && qty <= s.max_qty && /^https?:\/\//i.test(link)) { charge = Math.round((s.rate * qty / 1000) * 1e8) / 1e8; valid = true; }
  el('order-charge-field').value = valid ? `${sym}${charge.toFixed(8)}` : '';
  el('confirm-order-button').disabled = !valid;
}
function clearOrderFields(){
  el('order-link').value = ''; el('order-qty').value = '';
  el('qty-hint').textContent = 'Min: — · Max: —'; el('order-avgtime').value = '—'; el('order-charge-field').value = '';
  el('confirm-order-button').disabled = true;
}
async function confirmOrder(){
  const btn = el('confirm-order-button'); const s = state.selectedService;
  if (!s) return;
  const link = el('order-link').value.trim(); const qty = parseInt(el('order-qty').value, 10);
  btn.disabled = true; btn.querySelector('.button-text').classList.add('hidden'); btn.querySelector('.spinner').classList.remove('hidden');
  try{
    const { order, balance } = await api('/api/order', { method: 'POST', body: JSON.stringify({ service: s.public_id, link, quantity: qty }) });
    state.user.balance = balance; updateBalanceUI(); loadStats();
    alert(`Order #${order.id} placed! ${state.settings.currency_symbol}${money8(order.charge)} deducted from your wallet.`);
    clearOrderFields(); el('service-detail-card').classList.add('hidden');
  }catch(e){ alert(e.message); }
  finally{ btn.disabled = false; btn.querySelector('.button-text').classList.remove('hidden'); btn.querySelector('.spinner').classList.add('hidden'); }
}

// ---------------- Bulk Order ----------------
async function submitBulkOrder(){
  const lines = el('bulk-lines').value.trim();
  if (!lines) return alert('Add at least one line');
  const btn = el('bulk-submit-button');
  btn.disabled = true; btn.querySelector('.button-text').classList.add('hidden'); btn.querySelector('.spinner').classList.remove('hidden');
  try{
    const { results, balance } = await api('/api/order/bulk', { method: 'POST', body: JSON.stringify({ lines }) });
    state.user.balance = balance; updateBalanceUI(); loadStats();
    el('bulk-results-card').classList.remove('hidden');
    el('bulk-results').innerHTML = results.map(r => `
      <div class="bulk-result-row ${r.ok ? 'ok' : 'fail'}">
        <span>${escapeHTML(r.line)}</span>
        <span>${r.ok ? `<i class="fa-solid fa-check" style="color:var(--success);"></i> Order #${r.order_id}` : `<i class="fa-solid fa-xmark" style="color:var(--danger);"></i> ${escapeHTML(r.error)}`}</span>
      </div>`).join('');
  }catch(e){ alert(e.message); }
  finally{ btn.disabled = false; btn.querySelector('.button-text').classList.remove('hidden'); btn.querySelector('.spinner').classList.add('hidden'); }
}

// ---------------- Orders History ----------------
let allOrders = []; let orderStatusFilter = 'all';
async function renderOrdersHistory(){
  try{ const { orders } = await api('/api/orders'); allOrders = orders; renderFilteredOrders(); }catch(e){}
}
function statusClass(s){ return (s || 'pending').toLowerCase(); }
function renderFilteredOrders(){
  const q = (el('order-search-input').value || '').trim().toLowerCase();
  let list = allOrders;
  if (orderStatusFilter !== 'all') list = list.filter(o => o.status === orderStatusFilter);
  if (q) list = list.filter(o => String(o.id).includes(q) || o.service_name.toLowerCase().includes(q) || String(o.service_public_id || '').includes(q));
  const wrap = el('orders-history');
  if (!list.length){ wrap.innerHTML = emptyState('fa-bag-shopping', allOrders.length ? 'No orders match your search' : 'No orders yet'); return; }
  wrap.innerHTML = list.map(o => {
    let refillHtml = '';
    if (o.refill_available) {
      if (o.refill_status === 'Pending') refillHtml = `<span class="status-badge processing">Refill Pending</span>`;
      else if (o.refill_status === 'Completed') refillHtml = `<span class="status-badge completed">Refill Completed</span>`;
      else if (o.status === 'Completed') refillHtml = `<button class="btn btn-sm btn-outline" onclick="requestRefill(${o.id})">Refill</button>`;
    }
    return `
    <div class="order-card">
      <div class="order-card-top">
        <span class="order-card-service">#${o.service_public_id || '—'} ${escapeHTML(o.service_name)}</span>
        <span class="status-badge ${statusClass(o.status)}">${escapeHTML(o.status)}</span>
      </div>
      <div class="order-card-grid">
        <div class="ocg-field"><span class="ocg-label">Order ID</span><span class="ocg-value">#${o.id}</span></div>
        <div class="ocg-field"><span class="ocg-label">Date</span><span class="ocg-value">${new Date(o.created_at).toLocaleDateString()}</span></div>
        <div class="ocg-field"><span class="ocg-label">Quantity</span><span class="ocg-value">${o.quantity.toLocaleString()}</span></div>
        <div class="ocg-field"><span class="ocg-label">Charge</span><span class="ocg-value">${state.settings.currency_symbol}${money8(o.charge)}</span></div>
        <div class="ocg-field"><span class="ocg-label">Start Count</span><span class="ocg-value">${o.start_count ?? '-'}</span></div>
        <div class="ocg-field"><span class="ocg-label">Remains</span><span class="ocg-value">${o.remains ?? '-'}</span></div>
      </div>
      <div class="ocg-field"><span class="ocg-label">Link</span><span class="ocg-value ocg-link-value">${escapeHTML(o.link)}</span></div>
      ${refillHtml ? `<div class="order-card-actions">${refillHtml}</div>` : ''}
    </div>`;
  }).join('');
}
async function requestRefill(orderId){
  try{ await api('/api/order/refill', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }); alert('Refill requested!'); renderOrdersHistory(); }
  catch(e){ alert(e.message); }
}

// ---------------- Services catalog ----------------
function renderCatalog(){
  const q = (el('catalog-search').value || '').trim().toLowerCase();
  let list = state.services;
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.public_id).includes(q));
  const wrap = el('catalog-list');
  const sym = state.settings.currency_symbol || '$';
  if (!list.length){ wrap.innerHTML = emptyState('fa-server', 'No services found'); return; }
  wrap.innerHTML = list.slice(0, 300).map(s => `
    <div class="history-item">
      <div class="history-details">
        <span class="name">#${s.public_id} — ${escapeHTML(s.name)}</span>
        <span class="meta">${escapeHTML(s.platform_name || '')} · ${escapeHTML(s.category_name || '')} · Min ${s.min_qty.toLocaleString()} / Max ${s.max_qty.toLocaleString()}</span>
      </div>
      <div class="history-amount"><div class="amt">${sym}${money8(s.rate)}<span style="font-size:11px;color:var(--text-faint);font-weight:600;">/1000</span></div></div>
    </div>`).join('');
}

// ---------------- Add Funds (UglyPay) ----------------
function renderFundsChips(){
  const amounts = state.settings.deposit_quick_amounts && state.settings.deposit_quick_amounts.length ? state.settings.deposit_quick_amounts : [500, 1000, 2000, 5000, 10000];
  const sym = state.settings.currency_symbol || '৳';
  el('funds-amount-chips').innerHTML = amounts.map(a => `<button type="button" class="amount-chip" data-amt="${a}">${sym}${a}</button>`).join('');
  el('funds-amount-chips').querySelectorAll('.amount-chip').forEach(chip => chip.addEventListener('click', () => { el('funds-amount-input').value = chip.dataset.amt; onFundsAmountInput(); }));
}
function onFundsAmountInput(){
  const val = parseFloat(el('funds-amount-input').value);
  el('funds-pay-button').disabled = !(Number.isFinite(val) && val > 0);
  document.querySelectorAll('.amount-chip').forEach(c => c.classList.toggle('active', Number(c.dataset.amt) === val));
}
async function payNow(){
  const amount = parseFloat(el('funds-amount-input').value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  const btn = el('funds-pay-button');
  btn.disabled = true; btn.querySelector('.button-text').classList.add('hidden'); btn.querySelector('.spinner').classList.remove('hidden');
  try{
    const { pay_url } = await api('/api/deposit/request', { method: 'POST', body: JSON.stringify({ amount }) });
    window.location.href = pay_url;
  }catch(e){
    alert(e.message);
    btn.disabled = false; btn.querySelector('.button-text').classList.remove('hidden'); btn.querySelector('.spinner').classList.add('hidden');
  }
}
async function renderDepositRequests(){
  try{
    const { requests } = await api('/api/deposit/requests');
    const wrap = el('deposit-requests-list');
    if (!requests.length){ wrap.innerHTML = emptyState('fa-sack-dollar', 'No deposit requests yet'); return; }
    const sym = state.settings.currency_symbol || '৳';
    wrap.innerHTML = requests.map(r => `
      <div class="history-item">
        <div class="history-details"><span class="name">${escapeHTML(r.reference_code)}</span><span class="meta">${new Date(r.created_at).toLocaleString()}</span></div>
        <div class="history-amount"><div class="amt">${sym}${Number(r.amount).toLocaleString()}</div><span class="status-badge ${r.status.toLowerCase()}">${escapeHTML(r.status)}</span></div>
      </div>`).join('');
  }catch(e){}
}

// ---------------- API / docs ----------------
function updateTokenUI(){
  const token = state.user.api_token || '';
  el('api-token-display').textContent = token ? token.slice(0, 10) + '••••••••••••••••' : '—';
}
function copyToken(){
  navigator.clipboard.writeText(state.user.api_token || '').then(() => alert('API key copied!')).catch(() => {});
}
async function regenerateToken(){
  if (!confirm('Regenerate your API key? The old key will stop working immediately.')) return;
  try{ const { api_token } = await api('/api/user/regenerate-token', { method: 'POST' }); state.user.api_token = api_token; updateTokenUI(); alert('New API key generated.'); }
  catch(e){ alert(e.message); }
}
function renderDocs(){
  const base = window.location.origin + '/api/v2';
  el('docs-content').innerHTML = `
    <h3 class="card-title">API Documentation</h3>
    <div class="toc"><a href="#api">API</a><a href="#services">Services</a><a href="#add">Add</a><a href="#status">Status</a><a href="#refill">Refill</a><a href="#cancel">Cancel</a><a href="#balance">Balance</a></div>
    <h2 class="section-title" id="api"><i class="fa-solid fa-plug"></i> API</h2>
    <table class="doc-table"><tr><th>Method</th><td>POST</td></tr><tr><th>URL</th><td>${escapeHTML(base)}</td></tr><tr><th>Key</th><td>Shown above</td></tr></table>
    <h2 class="section-title" id="services"><i class="fa-solid fa-list"></i> Service List</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>key</td><td>Your API key</td></tr><tr><td>action</td><td>services</td></tr></table>
    <h2 class="section-title" id="add"><i class="fa-solid fa-bolt"></i> Add Order</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>key</td><td>Your API key</td></tr><tr><td>action</td><td>add</td></tr><tr><td>service</td><td>Service ID</td></tr><tr><td>link</td><td>Link</td></tr><tr><td>quantity</td><td>Quantity</td></tr></table>
    <div class="code-block">{ <span class="k">"order"</span>: 23501 }</div>
    <h2 class="section-title" id="status"><i class="fa-solid fa-magnifying-glass"></i> Status</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>action</td><td>status</td></tr><tr><td>order / orders</td><td>Single or comma-separated</td></tr></table>
    <h2 class="section-title" id="refill"><i class="fa-solid fa-rotate"></i> Refill</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>action</td><td>refill / refill_status</td></tr><tr><td>order / orders</td><td>Single or comma-separated</td></tr></table>
    <h2 class="section-title" id="cancel"><i class="fa-solid fa-ban"></i> Cancel</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>action</td><td>cancel</td></tr><tr><td>orders</td><td>Comma-separated IDs</td></tr></table>
    <h2 class="section-title" id="balance"><i class="fa-solid fa-wallet"></i> Balance</h2>
    <table class="doc-table"><tr><th>Parameter</th><th>Description</th></tr><tr><td>action</td><td>balance</td></tr></table>
    <p class="doc-note">All errors return <code>{"error": "message"}</code> with HTTP 200, matching common SMM-panel API conventions.</p>`;
}

// ---------------- Init ----------------
async function boot(){
  updateProfileUI();
  await loadSettings();
  updateBalanceUI();
  loadStats();

  const { platforms } = await api('/api/platforms');
  state.platforms = platforms;
  renderPlatformGrid();
  await loadAllServicesForSearch();
  renderFundsChips();
  updateTokenUI();

  document.querySelectorAll('.dash-nav-item[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  el('logout-btn').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); window.location.href = 'login.html'; });

  el('service-search').addEventListener('input', handleSearch);
  el('order-link').addEventListener('input', recomputeCharge);
  el('order-qty').addEventListener('input', recomputeCharge);
  el('confirm-order-button').addEventListener('click', confirmOrder);
  el('bulk-submit-button').addEventListener('click', submitBulkOrder);

  el('order-search-input').addEventListener('input', renderFilteredOrders);
  document.querySelectorAll('#order-status-filter .pill').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#order-status-filter .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); orderStatusFilter = btn.dataset.status; renderFilteredOrders();
  }));

  el('catalog-search').addEventListener('input', renderCatalog);
  el('funds-amount-input').addEventListener('input', onFundsAmountInput);
  el('funds-pay-button').addEventListener('click', payNow);
  el('copy-token-btn').addEventListener('click', copyToken);
  el('regen-token-btn').addEventListener('click', regenerateToken);
}

guardAndInit();
