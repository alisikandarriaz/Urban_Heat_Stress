/**
 * charts.js
 * Chart 1: 24h temperature trend from Node-RED / PostgreSQL (no external fallback)
 * Chart 2: LST + Population dual-axis
 * Chart 3: Greenness index from GreenessData.xlsx
 */

APP.charts = { trend: null, lst: null, green: null };

APP._cOpts = (x={}) => ({
  responsive:true, maintainAspectRatio:true,
  animation:{duration:300}, plugins:{legend:{display:false}}, ...x
});
APP._showTrendMsg   = html => {
  document.getElementById('ch-trend').style.display='none';
  document.getElementById('trend-msg').style.display='flex';
  document.getElementById('trend-msg').innerHTML=html;
};
APP._showTrendChart = () => {
  document.getElementById('ch-trend').style.display='block';
  document.getElementById('trend-msg').style.display='none';
};

APP.renderCharts = function (key) {
  document.getElementById('chart-city').textContent = APP.CITIES[key].label;
  APP.renderTrendChart(key);
  APP.renderLSTChart(key);
  APP.renderGreenChart(key);
};

// ── Chart 1: 24h temperature trend (Node-RED / PostgreSQL only) ───────────
APP.renderTrendChart = async function (key) {
  const c = APP.CITIES[key];
  APP._showTrendMsg('Loading 24h data\u2026');
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000); // 10s timeout
    const r     = await fetch(APP.WEATHER_24H, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const all = await r.json();
    if (!Array.isArray(all) || all.length === 0) throw new Error('No data in database');

    const rows = all
      .filter(row => row.city === c.wxCity)
      .sort((a,b) => new Date(a.obs_time) - new Date(b.obs_time));

    if (rows.length === 0) {
      const avail = [...new Set(all.map(x=>x.city))].join(', ');
      APP._showTrendMsg(
        'No data for <strong>' + c.label.split(',')[0] + '</strong>.<br>' +
        '<small>Cities in DB: ' + (avail || 'none') + '</small>'
      );
      return;
    }

    APP._showTrendChart();

    // Parse timestamps safely — handles both Postgres "+00" and ISO formats
    const labels = rows.map(row => {
      const t = String(row.obs_time || '');
      // Try direct substring first (fast, no Date parsing needed)
      // Postgres: "2026-05-29 17:30:00+00"  -> index 11..16 = "17:30"
      // ISO:      "2026-05-29T17:30:00Z"    -> index 11..16 = "17:30"
      if (t.length >= 16) {
        const hhmm = t.slice(11, 16).replace('T','').trim();
        if (/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
      }
      const d = new Date(t);
      if (!isNaN(d)) return d.getUTCHours().toString().padStart(2,'0') + ':' + d.getUTCMinutes().toString().padStart(2,'0');
      return '--';
    });
    const temps = rows.map(row => parseFloat(row.temp_c));

    if (APP.charts.trend) APP.charts.trend.destroy();
    APP.charts.trend = new Chart(document.getElementById('ch-trend'), {
      type: 'line',
      data: { labels, datasets: [{
        data: temps,
        borderColor:'#60A5FA', backgroundColor:'rgba(96,165,250,0.10)',
        borderWidth:2, pointRadius:0, fill:true, tension:.4,
      }]},
      options: APP._cOpts({
        scales:{
          x:{ ticks:{font:{size:8},maxTicksLimit:12,maxRotation:0}, grid:{color:'var(--ch-grid)'} },
          y:{ ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, title:{display:true,text:'\u00b0C',font:{size:9}} },
        },
      }),
    });
  } catch (e) {
    APP._showTrendMsg(
      'Error loading 24h data: ' + e.message +
      '<br><small>Check Node-RED CORS settings or re-import flow</small>'
    );
  }
};

// ── Chart 2: LST + Population (dual Y-axis) ───────────────────────────────
APP.renderLSTChart = function (key) {
  if (APP.charts.lst) APP.charts.lst.destroy();

  const popVals = APP.CITY_KEYS.map(k => APP.CITIES[k].pop || null);

  APP.charts.lst = new Chart(document.getElementById('ch-lst'), {
    data: {
      labels: APP.CITY_LABELS,
      datasets: [
        {
          type: 'bar', label: 'LST \u00b0C',
          data: APP.CITY_KEYS.map(k => APP.CITIES[k].lst),
          backgroundColor: APP.CITY_KEYS.map(k => k === key ? '#EF4444' : '#F97316'),
          borderRadius:3, borderSkipped:false, yAxisID:'y',
        },
        {
          type: 'line', label: 'Population',
          data: popVals,
          borderColor:'#60A5FA', backgroundColor:'rgba(96,165,250,0.12)',
          borderWidth:2, pointRadius:3, pointBackgroundColor:'#60A5FA',
          tension:.3, fill:false, yAxisID:'y1', spanGaps:true,
        },
      ],
    },
    options: APP._cOpts({
      plugins:{ legend:{ display:true, labels:{ font:{size:9}, color:'#73726c', boxWidth:12 } } },
      scales:{
        x:{ ticks:{font:{size:8},maxRotation:45}, grid:{display:false} },
        y:{ ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, min:22,
            title:{display:true,text:'LST \u00b0C',font:{size:9}} },
        y1:{ position:'right', grid:{display:false},
             ticks:{ font:{size:8},
               callback: v => v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'K' : v },
             title:{display:true,text:'Population',font:{size:9}} },
      },
    }),
  });
};

// ── Chart 3: Greenness index (replaces UHI ranking) ───────────────────────
APP.renderGreenChart = function (key) {
  if (APP.charts.green) APP.charts.green.destroy();

  // Sort descending; null (no data) goes to bottom
  const sorted = APP.CITY_KEYS
    .map(k => ({ key:k, label:APP.CITIES[k].label.split(',')[0], val:APP.GREENNESS[k] }))
    .sort((a,b) => (b.val ?? -1) - (a.val ?? -1));

  APP.charts.green = new Chart(document.getElementById('ch-uhi'), {
    type:'bar',
    data:{
      labels: sorted.map(d => d.label),
      datasets:[{
        data: sorted.map(d => d.val ?? 0),
        backgroundColor: sorted.map(d =>
          d.val === null  ? '#3a3a38'   :
          d.key === key   ? '#4ADE80'   :
          d.val >= 0.4    ? '#16A34A'   :
          d.val >= 0.3    ? '#22C55E'   :
          d.val >= 0.2    ? '#86EFAC'   : '#BEF264'
        ),
        borderRadius:3, borderSkipped:false,
      }],
    },
    options: APP._cOpts({
      indexAxis:'y',
      scales:{
        x:{ ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, max:0.6,
            title:{display:true,text:'Average Greenness Index',font:{size:9}} },
        y:{ ticks:{font:{size:8}}, grid:{display:false} },
      },
    }),
  });
};