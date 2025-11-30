const statusEl = document.querySelector('[data-status]');
const healthEl = document.querySelector('[data-health]');
const refreshBtn = document.querySelector('#refresh');

let apiBaseUrl = '';

async function loadConfig() {
  const config = await window.fgdDesktop.getConfig();
  apiBaseUrl = config.apiBaseUrl;
  return config;
}

async function fetchHealth() {
  if (!apiBaseUrl) return;
  statusEl.textContent = 'Checking…';
  try {
    const res = await fetch(`${apiBaseUrl}/api/health`);
    const payload = await res.json();
    const ok = res.ok && payload?.status !== 'error';

    statusEl.textContent = ok ? 'Backend online' : 'Backend error';
    statusEl.classList.toggle('pill--bad', !ok);
    healthEl.textContent = JSON.stringify(payload, null, 2);
  } catch (err) {
    statusEl.textContent = 'Backend offline';
    statusEl.classList.add('pill--bad');
    healthEl.textContent = err.message;
  }
}

async function init() {
  await loadConfig();
  refreshBtn?.addEventListener('click', fetchHealth);
  await fetchHealth();
}

window.fgdDesktop.onBackendExit(({ reason }) => {
  statusEl.textContent = `Backend stopped (${reason ?? 'unknown'})`;
  statusEl.classList.add('pill--bad');
});

init();
