/**
 * weather.js — Primary: Node-RED/PostgreSQL. Fallback: Open-Meteo.
 */
APP.wxCache = {};

APP.loadWeather = async function () {
  try {
    const r = await fetch(APP.WEATHER_API, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty');
    rows.forEach(row => { APP.wxCache[row.city] = row; });
    if (APP.curKey) APP.updateWxBadge(APP.curKey);
    console.log('[Weather] Node-RED OK:', rows.length, 'cities');
  } catch (e) {
    console.warn('[Weather] Node-RED failed (' + e.message + '), using Open-Meteo fallback');
    if (APP.curKey) APP._openMeteoLive(APP.curKey);
  }
};

APP._openMeteoLive = async function (key) {
  const c = APP.CITIES[key];
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.center[0] + '&longitude=' + c.center[1] + '&current_weather=true&timezone=auto';
    const d = await (await fetch(url)).json();
    const w = d.current_weather;
    APP.wxCache[c.wxCity] = { city:c.wxCity, temp_c:w.temperature.toFixed(1), dewp_c:null, wind_spd_kt:Math.round(w.windspeed/1.852), wind_dir_deg:w.winddirection, obs_time:new Date().toISOString() };
    APP.updateWxBadge(key);
  } catch(e2) { console.warn('[Weather] Open-Meteo failed:', e2.message); }
};

APP.get24h = async function () {
  try {
    const r = await fetch(APP.WEATHER_24H, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      console.log('[Weather] 24h from Node-RED:', data.length, 'rows');
      return data;
    }
    throw new Error('empty');
  } catch(e) {
    console.warn('[Weather] 24h Node-RED failed (' + e.message + '), using Open-Meteo');
    return null;
  }
};

// ── Live local-time clock (ticks every second) ──
APP.startClock = function () {
  APP._tickClock();
  setInterval(APP._tickClock, 1000);
};

APP._tickClock = function () {
  if (!APP.curKey) return;
  const c = APP.CITIES[APP.curKey];
  const el = document.getElementById('wx-local');
  if (!el) return;
  try {
    el.textContent = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: c.tz
    }) + ' local';
  } catch(e) { /* invalid tz, ignore */ }
};

APP.updateWxBadge = function (key) {
  const c = APP.CITIES[key];
  const wx = APP.wxCache[c.wxCity];
  if (!wx) return;
  const temp = parseFloat(wx.temp_c);
  const wind = wx.wind_spd_kt || 0;
  let icon = 'ti-cloud-sun', color = '#F59E0B';
  if (temp >= 28)     { icon = 'ti-sun';       color = '#F97316'; }
  else if (temp < 10) { icon = 'ti-snowflake'; color = '#60A5FA'; }
  else if (wind > 20) { icon = 'ti-wind';      color = '#818CF8'; }
  document.getElementById('wx-icon').className   = 'ti ' + icon;
  document.getElementById('wx-icon').style.color = color;
  document.getElementById('wx-temp').textContent = temp.toFixed(1) + '°C';
  document.getElementById('wx-wind').textContent = wind + ' kt';
  const utcTime = wx.obs_time ? new Date(wx.obs_time).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }) + ' UTC' : '--';
  document.getElementById('wx-obs').textContent = utcTime;
  document.getElementById('wx-badge').classList.add('show');
  const sb = document.getElementById('sb-wx');
  if (sb) sb.textContent = temp.toFixed(1) + '°C';
};