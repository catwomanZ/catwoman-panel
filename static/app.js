(() => {
  'use strict';

  const ready = (callback) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  };

  const showToast = (message) => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2300);
  };

  const setupDrawer = () => {
    const sidebar = document.getElementById('sidebar');
    const toggles = document.querySelectorAll('[data-menu-toggle]');
    if (!sidebar || !toggles.length) return;
    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggles.forEach((button) => button.setAttribute('aria-expanded', String(open)));
    };
    toggles.forEach((button) => button.addEventListener('click', () => setOpen(!sidebar.classList.contains('open'))));
    document.querySelectorAll('[data-menu-close]').forEach((button) => button.addEventListener('click', () => setOpen(false)));
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) setOpen(false); }, { passive: true });
  };

  const setupConfirmations = () => {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-confirm]');
      if (target && !window.confirm(target.dataset.confirm)) event.preventDefault();
    });
    document.querySelectorAll('[data-restore-form]').forEach((form) => form.addEventListener('submit', (event) => {
      if (!window.confirm('دیتابیس فعلی با فایل انتخاب‌شده جایگزین شود؟')) event.preventDefault();
    }));
  };

  const setupPasswordToggles = () => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.setAttribute('aria-label', reveal ? 'پنهان‌کردن رمز' : 'نمایش رمز');
      });
    });
  };

  const setupUserDirectory = () => {
    const rows = [...document.querySelectorAll('[data-user-row]')];
    if (!rows.length) return;
    const search = document.getElementById('userSearch');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const empty = document.getElementById('filteredEmpty');
    const count = document.getElementById('visibleUserCount');
    let filter = 'all';
    const apply = () => {
      const query = (search?.value || '').trim().toLocaleLowerCase('fa');
      let visible = 0;
      rows.forEach((row) => {
        const textMatch = !query || row.dataset.search.includes(query);
        const status = row.dataset.status;
        const filterMatch = filter === 'all' || (filter === 'online' && row.dataset.online === 'true') || (filter === 'active' && status === 'active') || (filter === 'disabled' && status !== 'active');
        const show = textMatch && filterMatch;
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (empty) empty.classList.toggle('show', visible === 0);
      if (count) count.textContent = String(visible);
    };
    search?.addEventListener('input', apply);
    buttons.forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle('active', item === button));
      apply();
    }));
    document.querySelectorAll('[data-refresh-users]').forEach((button) => button.addEventListener('click', () => {
      button.classList.add('is-loading');
      window.location.reload();
    }));
    apply();
  };

  const refreshOnlineCount = async () => {
    const target = document.getElementById('onlineMetric');
    if (!target) return;
    try {
      const response = await fetch('/api/online-count', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      target.textContent = String(data.count ?? 0);
    } catch (_) { /* Network status is intentionally silent. */ }
  };

  const setupFormPreview = () => {
    const form = document.getElementById('userForm');
    if (!form) return;
    const update = () => {
      const name = form.querySelector('[data-preview-name]')?.value.trim() || 'کاربر جدید';
      const protocol = form.querySelector('[data-preview-protocol]')?.value.toUpperCase() || 'VLESS';
      const volume = Number(form.querySelector('[data-preview-volume]')?.value || 0);
      const days = Number(form.querySelector('[data-preview-days]')?.value || 0);
      const ip = Number(form.querySelector('[data-preview-ip]')?.value || 0);
      const setText = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
      setText('[data-preview-output-name]', name);
      setText('[data-preview-output-protocol]', protocol);
      setText('[data-preview-output-volume]', volume > 0 ? `${volume} GB` : 'نامحدود');
      setText('[data-preview-output-days]', days > 0 ? `${days} روز` : 'نامحدود');
      setText('[data-preview-output-ip]', ip > 0 ? String(ip) : 'نامحدود');
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', () => {
      const submit = form.querySelector('button[type="submit"]');
      if (submit) { submit.disabled = true; submit.classList.add('is-loading'); }
    });
    update();
  };

  const parseChartData = (canvas) => {
    try {
      const labels = JSON.parse(canvas.dataset.labels || '[]');
      const values = JSON.parse(canvas.dataset.values || '[]').map((value) => Number(value) || 0);
      return { labels, values };
    } catch (_) { return { labels: [], values: [] }; }
  };

  const drawChart = (canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const parent = canvas.parentElement;
    const width = Math.max(280, Math.floor(parent?.clientWidth || canvas.clientWidth || 600));
    const height = Math.max(150, Math.floor(parent?.clientHeight || canvas.clientHeight || 220));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    let { labels, values } = parseChartData(canvas);
    if (!values.length) { labels = ['بدون داده']; values = [0]; }
    const padding = { top: 18, right: 14, bottom: 25, left: 14 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(102,177,246,.09)';
    for (let index = 0; index <= 4; index += 1) {
      const y = padding.top + (chartHeight * index / 4);
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
    }
    const maximum = Math.max(...values, 1);
    const points = values.map((value, index) => ({
      x: padding.left + (values.length === 1 ? chartWidth / 2 : chartWidth * index / (values.length - 1)),
      y: padding.top + chartHeight - (value / maximum) * (chartHeight * .88),
    }));
    const area = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    area.addColorStop(0, 'rgba(38,140,255,.28)'); area.addColorStop(1, 'rgba(38,140,255,0)');
    context.beginPath(); context.moveTo(points[0].x, height - padding.bottom); points.forEach((point) => context.lineTo(point.x, point.y)); context.lineTo(points.at(-1).x, height - padding.bottom); context.closePath(); context.fillStyle = area; context.fill();
    const line = context.createLinearGradient(padding.left, 0, width - padding.right, 0);
    line.addColorStop(0, '#268cff'); line.addColorStop(1, '#86d2ff');
    context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.strokeStyle = line; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round'; context.shadowColor = 'rgba(38,140,255,.6)'; context.shadowBlur = 9; context.stroke(); context.shadowBlur = 0;
    points.forEach((point) => { context.beginPath(); context.arc(point.x, point.y, 3.5, 0, Math.PI * 2); context.fillStyle = '#061422'; context.fill(); context.strokeStyle = '#75c8ff'; context.lineWidth = 2; context.stroke(); });
    context.font = '9px VazirmatnLocal, sans-serif'; context.fillStyle = '#45667e'; context.textAlign = 'center';
    labels.forEach((label, index) => { if (labels.length > 7 && index % Math.ceil(labels.length / 7)) return; const x = padding.left + (labels.length === 1 ? chartWidth / 2 : chartWidth * index / (labels.length - 1)); context.fillText(String(label).slice(5), x, height - 6); });
  };

  const setupCharts = () => {
    const canvases = [...document.querySelectorAll('canvas.local-chart')];
    if (!canvases.length) return;
    const drawAll = () => canvases.forEach(drawChart);
    drawAll();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => window.requestAnimationFrame(drawAll));
      canvases.forEach((canvas) => observer.observe(canvas.parentElement));
    } else window.addEventListener('resize', drawAll, { passive: true });
  };

  const setupSettingsTabs = () => {
    const buttons = [...document.querySelectorAll('[data-settings-tab]')];
    const panes = [...document.querySelectorAll('[data-settings-pane]')];
    if (!buttons.length) return;
    const activate = (name) => {
      buttons.forEach((button) => button.classList.toggle('active', button.dataset.settingsTab === name));
      panes.forEach((pane) => pane.classList.toggle('active', pane.dataset.settingsPane === name));
    };
    buttons.forEach((button) => button.addEventListener('click', () => activate(button.dataset.settingsTab)));
    if (location.hash.startsWith('#settings-')) {
      const name = location.hash.replace('#settings-', '');
      if (buttons.some((button) => button.dataset.settingsTab === name)) activate(name);
    }
  };

  const setupFiles = () => {
    document.querySelectorAll('[data-file-input]').forEach((input) => input.addEventListener('change', () => {
      const label = input.closest('label')?.querySelector('[data-file-label]');
      if (label) label.textContent = input.files?.[0]?.name || 'انتخاب فایل پشتیبان';
    }));
  };

  const setupTrafficExport = () => {
    document.querySelectorAll('[data-export-traffic]').forEach((button) => button.addEventListener('click', () => {
      const canvas = document.querySelector('canvas[data-large]');
      if (!canvas) return;
      const { labels, values } = parseChartData(canvas);
      const rows = [['date', 'traffic_gb'], ...labels.map((label, index) => [label, values[index] ?? 0])];
      const csv = rows.map((row) => row.join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'catwoman-traffic.csv'; link.click(); URL.revokeObjectURL(url);
      showToast('گزارش ترافیک آماده شد');
    }));
  };

  ready(() => {
    setupDrawer();
    setupConfirmations();
    setupPasswordToggles();
    setupUserDirectory();
    setupFormPreview();
    setupCharts();
    setupSettingsTabs();
    setupFiles();
    setupTrafficExport();
    refreshOnlineCount();
    if (document.getElementById('onlineMetric')) window.setInterval(refreshOnlineCount, 15000);
  });

  window.CatWomanUI = { showToast };
})();
