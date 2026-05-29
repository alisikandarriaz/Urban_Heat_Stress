/**
 * charts.js
 * Three charts: 24h temperature trend, LST comparison, UHI ranking.
 * 24h trend tries Node-RED first, falls back to Open-Meteo automatically.
 */
APP.charts = { trend: null, lst: null, uhi: null };

APP._cOpts = (x={}) => ({
  responsive:true, maintainAspectRatio:true,
  animation:{duration:300}, plugins:{legend:{display:false}}, ...x
});

APP._showTrendMsg   = html => {
  document.getElementById('ch-trend').style.display = 'none';
  document.getElementById('trend-msg').style.display = 'flex';
  document.getElementById('trend-msg').innerHTML = html;
};
APP._showTrendChart = () => {
  document.getElementById('ch-trend').style.display = 'block';
  document.getElementById('trend-msg').style.display = 'none';
};

APP.renderCharts = function (key) {
  document.getElementById('chart-city').textContent = APP.CITIES[key].label;
  APP.renderTrendChart(key);
  APP.renderLSTChart(key);
  APP.renderUHIChart(key);
};

// ── 24h temperature trend ──────────────────────────────────────────────
// Tries Node-RED endpoint first. Falls back to Open-Meteo if blocked/slow.
APP.renderTrendChart = async function (key) {
  const c = APP.CITIES[key];
  APP._showTrendMsg('Loading 24h data\u2026');

  let rows = [];

  // 1. Try Node-RED (our real METAR data)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // 5s timeout
    const r = await fetch(APP.WEATHER_24H, { signal: ctrl.signal });
    clearTimeout(timer);
    if (r.ok) {
      const all = await r.json();
      if (Array.isArray(all) && all.length > 0) {
        rows = all
          .filter(row => row.city === c.wxCity)
          .sort((a, b) => new Date(a.obs_time) - new Date(b.obs_time));
        if (rows.length > 0) console.log('[24h] Node-RED:', rows.length, 'rows for', c.wxCity);
      }
    }
  } catch (e) {
    console.warn('[24h] Node-RED unavailable (' + e.message + '), trying Open-Meteo');
  }

  // 2. Fall back to Open-Meteo hourly temperature (free, no CORS issues)
  if (rows.length === 0) {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?'
        + 'latitude=' + c.center[0]
        + '&longitude=' + c.center[1]
        + '&hourly=temperature_2m&past_hours=24&forecast_hours=0&timezone=UTC';
      const r2 = await fetch(url);
      const d2 = await r2.json();
      const times = d2.hourly?.time || [];
      const temps = d2.hourly?.temperature_2m || [];
      rows = times.map((t, i) => ({
        city: c.wxCity,
        obs_time: t + ':00+00',
        temp_c: String(temps[i] ?? ''),
      })).filter(row => row.temp_c !== '');
      console.log('[24h] Open-Meteo fallback:', rows.length, 'hours for', c.label);
    } catch (e2) {
      APP._showTrendMsg('Error loading 24h data: ' + e2.message);
      return;
    }
  }

  if (rows.length === 0) {
    APP._showTrendMsg('No 24h data available for ' + c.label.split(',')[0]);
    return;
  }

  // Render line chart
  APP._showTrendChart();
  const labels = rows.map(row => {
    const d = new Date(row.obs_time);
    return d.getUTCHours().toString().padStart(2,'0') + ':' + d.getUTCMinutes().toString().padStart(2,'0');
  });
  const temps = rows.map(row => parseFloat(row.temp_c));

  if (APP.charts.trend) APP.charts.trend.destroy();
  APP.charts.trend = new Chart(document.getElementById('ch-trend'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: temps,
        borderColor: '#60A5FA',
        backgroundColor: 'rgba(96,165,250,0.10)',
        borderWidth: 2, pointRadius: 0, fill: true, tension: .4,
      }],
    },
    options: APP._cOpts({
      scales: {
        x: { ticks: { font:{size:8}, maxTicksLimit:12, maxRotation:0 }, grid:{color:'var(--ch-grid)'} },
        y: { ticks: { font:{size:9} }, grid:{color:'var(--ch-grid)'}, title:{display:true,text:'\u00b0C',font:{size:9}} },
      },
    }),
  });
};

// ── LST comparison ─────────────────────────────────────────────────────
APP.renderLSTChart = function (key) {
  if (APP.charts.lst) APP.charts.lst.destroy();
  APP.charts.lst = new Chart(document.getElementById('ch-lst'), {
    type: 'bar',
    data: {
      labels: APP.CITY_LABELS,
      datasets: [{
        data: APP.CITY_KEYS.map(k => APP.CITIES[k].lst),
        backgroundColor: APP.CITY_KEYS.map(k => k === key ? '#EF4444' : '#F97316'),
        borderRadius: 3, borderSkipped: false,
      }],
    },
    options: APP._cOpts({
      scales: {
        x: { ticks:{font:{size:8},maxRotation:45}, grid:{display:false} },
        y: { ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, min:22, title:{display:true,text:'\u00b0C',font:{size:9}} },
      },
    }),
  });
};

// ── UHI ranking ────────────────────────────────────────────────────────
APP.renderUHIChart = function (key) {
  const si = APP.CITY_KEYS.map((_,i) => i)
    .sort((a,b) => APP.CITIES[APP.CITY_KEYS[b]].uhi - APP.CITIES[APP.CITY_KEYS[a]].uhi);
  if (APP.charts.uhi) APP.charts.uhi.destroy();
  APP.charts.uhi = new Chart(document.getElementById('ch-uhi'), {
    type: 'bar',
    data: {
      labels: si.map(i => APP.CITY_LABELS[i]),
      datasets: [{
        data: si.map(i => APP.CITIES[APP.CITY_KEYS[i]].uhi),
        backgroundColor: si.map(i => APP.CITY_KEYS[i] === key ? '#A78BFA' : '#4B3B7A'),
        borderRadius: 3, borderSkipped: false,
      }],
    },
    options: APP._cOpts({
      indexAxis: 'y',
      scales: {
        x: { ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, title:{display:true,text:'UHI index',font:{size:9}} },
        y: { ticks:{font:{size:8}}, grid:{display:false} },
      },
    }),
  });
};
