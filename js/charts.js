/**
 * charts.js
 * Chart 1: 24h temperature (Node-RED primary, Open-Meteo fallback)
 * Chart 2: Population bar chart
 * Chart 3: Greenness index
 */
APP.charts = { trend: null, pop: null, green: null };

APP._cOpts = (x={}) => ({
  responsive:true, maintainAspectRatio:true, animation:{duration:300},
  plugins:{legend:{display:false}}, ...x
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
  const t = APP.I18N[APP.lang] || APP.I18N.en;
  document.getElementById('chart-city').textContent = APP.CITIES[key].label;
  document.querySelectorAll('[data-i18n="ch_trend"]').forEach(el => el.textContent = t.ch_trend || el.textContent);
  document.querySelectorAll('[data-i18n="ch_pop"]').forEach(el => el.textContent = t.ch_pop || el.textContent);
  document.querySelectorAll('[data-i18n="ch_green"]').forEach(el => el.textContent = t.ch_green || el.textContent);
  APP.renderTrendChart(key);
  APP.renderPopChart(key);
  APP.renderGreenChart(key);
};

// ── Chart 1: 24h temperature trend ────────────────────────────────────
APP.renderTrendChart = async function (key) {
  const c = APP.CITIES[key];
  APP._showTrendMsg('Loading\u2026');
  let rows = [];

  // Try Node-RED
  const data = await APP.get24h();
  if (data) {
    rows = data.filter(r => r.city === c.wxCity)
               .sort((a,b) => new Date(a.obs_time)-new Date(b.obs_time));
  }

  // Fallback: Open-Meteo hourly
  if (rows.length === 0) {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.center[0]
        + '&longitude=' + c.center[1] + '&hourly=temperature_2m&past_hours=24&forecast_hours=0&timezone=UTC';
      const d2 = await (await fetch(url)).json();
      const times = d2.hourly?.time || [];
      const temps = d2.hourly?.temperature_2m || [];
      rows = times.map((t,i) => ({ city:c.wxCity, obs_time:t+'Z', temp_c:String(temps[i]??'') }))
                  .filter(r => r.temp_c !== '' && r.temp_c !== 'null');
      if (rows.length) console.log('[24h] Open-Meteo fallback:', rows.length, 'hours');
    } catch(e2) {
      APP._showTrendMsg('Error: ' + e2.message + '<br><small>Check Node-RED CORS or network</small>');
      return;
    }
  }

  if (rows.length === 0) {
    APP._showTrendMsg('No 24h data for ' + c.label.split(',')[0]);
    return;
  }

  APP._showTrendChart();
  const labels = rows.map(r => {
    const t = String(r.obs_time || '');
    const d = new Date(t);
    if (!isNaN(d)) return d.getUTCHours().toString().padStart(2,'0')+':'+d.getUTCMinutes().toString().padStart(2,'0');
    return t.slice(11,16) || '--';
  });
  const temps = rows.map(r => parseFloat(r.temp_c));
  if (APP.charts.trend) APP.charts.trend.destroy();
  APP.charts.trend = new Chart(document.getElementById('ch-trend'), {
    type:'line',
    data:{ labels, datasets:[{ data:temps, borderColor:'#60A5FA', backgroundColor:'rgba(96,165,250,0.10)', borderWidth:2, pointRadius:0, fill:true, tension:.4 }] },
    options:APP._cOpts({ scales:{ x:{ticks:{font:{size:8},maxTicksLimit:12,maxRotation:0},grid:{color:'var(--ch-grid)'}}, y:{ticks:{font:{size:9}},grid:{color:'var(--ch-grid)'},title:{display:true,text:'\u00b0C',font:{size:9}}} } }),
  });
};

// ── Chart 2: Population bar chart ─────────────────────────────────────
APP.renderPopChart = function (key) {
  if (APP.charts.pop) APP.charts.pop.destroy();
  // Sort by population descending, null at bottom
  const sorted = APP.CITY_KEYS
    .map(k => ({ key:k, label:APP.CITIES[k].label.split(',')[0], val:APP.CITIES[k].pop }))
    .sort((a,b) => (b.val??-1)-(a.val??-1));
  APP.charts.pop = new Chart(document.getElementById('ch-lst'), {
    type:'bar',
    data:{
      labels:sorted.map(d=>d.label),
      datasets:[{
        data:sorted.map(d=>d.val??0),
        backgroundColor:sorted.map(d =>
          d.val===null?'#3a3a38': d.key===key?'#60A5FA':'#3B82F6'),
        borderRadius:3, borderSkipped:false,
      }],
    },
    options:APP._cOpts({
      indexAxis:'y',
      scales:{
        x:{ ticks:{font:{size:8},callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v},
            grid:{color:'var(--ch-grid)'}, title:{display:true,text:'Population',font:{size:9}} },
        y:{ ticks:{font:{size:8}}, grid:{display:false} },
      },
    }),
  });
};

// ── Chart 3: Greenness index ───────────────────────────────────────────
APP.renderGreenChart = function (key) {
  if (APP.charts.green) APP.charts.green.destroy();
  const sorted = APP.CITY_KEYS
    .map(k=>({key:k,label:APP.CITIES[k].label.split(',')[0],val:APP.GREENNESS[k]}))
    .sort((a,b)=>(b.val??-1)-(a.val??-1));
  APP.charts.green = new Chart(document.getElementById('ch-uhi'), {
    type:'bar',
    data:{
      labels:sorted.map(d=>d.label),
      datasets:[{
        data:sorted.map(d=>d.val??0),
        backgroundColor:sorted.map(d=>
          d.val===null?'#3a3a38':d.key===key?'#4ADE80':d.val>=0.4?'#16A34A':d.val>=0.3?'#22C55E':d.val>=0.2?'#86EFAC':'#BEF264'),
        borderRadius:3, borderSkipped:false,
      }],
    },
    options:APP._cOpts({
      indexAxis:'y',
      scales:{
        x:{ ticks:{font:{size:9}}, grid:{color:'var(--ch-grid)'}, max:0.6,
            title:{display:true,text:'Average Greenness Index',font:{size:9}} },
        y:{ ticks:{font:{size:8}}, grid:{display:false} },
      },
    }),
  });
};