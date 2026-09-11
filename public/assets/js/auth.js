// =====================================================
// Auth logic — shared by register.html and login.html
// =====================================================
const el = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function showAlert(msg) {
  const box = el('auth-alert');
  box.textContent = msg;
  box.style.display = 'flex';
}
function hideAlert() { el('auth-alert').style.display = 'none'; }

// ---------------- Register ----------------
const registerForm = el('register-form');
if (registerForm) {
  el('reg-confirm').addEventListener('input', () => {
    const match = el('reg-password').value === el('reg-confirm').value;
    el('confirm-error').style.display = match || !el('reg-confirm').value ? 'none' : 'block';
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const password = el('reg-password').value;
    const confirm = el('reg-confirm').value;
    if (password !== confirm) { el('confirm-error').style.display = 'block'; return; }
    if (!el('reg-agree').checked) { showAlert('Please agree to the Terms of Service to continue.'); return; }

    const btn = el('register-submit');
    btn.disabled = true;
    btn.querySelector('.button-text').classList.add('hidden');
    btn.querySelector('.spinner').classList.remove('hidden');
    try {
      await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          username: el('reg-username').value.trim(),
          name: el('reg-name').value.trim(),
          email: el('reg-email').value.trim(),
          password,
          confirm_password: confirm,
          agree: true,
        }),
      });
      window.location.href = 'dashboard.html';
    } catch (err) {
      showAlert(err.message);
    } finally {
      btn.disabled = false;
      btn.querySelector('.button-text').classList.remove('hidden');
      btn.querySelector('.spinner').classList.add('hidden');
    }
  });
}

// ---------------- Login ----------------
const loginForm = el('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = el('login-submit');
    btn.disabled = true;
    btn.querySelector('.button-text').classList.add('hidden');
    btn.querySelector('.spinner').classList.remove('hidden');
    try {
      await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: el('login-identifier').value.trim(), password: el('login-password').value }),
      });
      window.location.href = 'dashboard.html';
    } catch (err) {
      showAlert(err.message);
    } finally {
      btn.disabled = false;
      btn.querySelector('.button-text').classList.remove('hidden');
      btn.querySelector('.spinner').classList.add('hidden');
    }
  });
}

// If already logged in, skip straight to the dashboard
api('/api/me').then(() => { window.location.href = 'dashboard.html'; }).catch(() => {});
