/**
 * weather.js
 * Tries Node-RED API first, falls back to Open-Meteo.
 * Shows local city time alongside UTC in the header badge.
 */

APP.wxCache    = {};
APP.wx24hCache = null;

APP.loadWeather = async function () {
  try {
    const r = await fetch(APP.WEATHER_API);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty response');
    rows.forEach(row => { APP.wxCache[row.city] = row; });
    if (APP.curKey) APP.updateWxBadge(APP.curKey);
    console.log('[Weather] Node-RED OK:', rows.length, 'cities');
  } catch (e) {
    console.warn('[Weather] Node-RED failed (' + e.message + '), falling back to Open-Meteo');
    if (APP.curKey) APP._loadOpenMeteo(APP.curKey);
  }
};

APP._loadOpenMeteo = async function (key) {
  const c = APP.CITIES[key];
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.center[0]}&longitude=${c.center[1]}&current_weather=true&timezone=auto`;
    const d   = await (await fetch(url)).json();
    const w   = d.current_weather;
    APP.wxCache[c.wxCity] = {
      city: c.wxCity, temp_c: w.temperature.toFixed(1), dewp_c: null,
      wind_spd_kt: Math.round(w.windspeed / 1.852),
      wind_dir_deg: w.winddirection,
      obs_time: new Date().toISOString(),
    };
    APP.updateWxBadge(key);
    console.log('[Weather] Open-Meteo OK for', c.label);
  } catch (e2) {
    console.warn('[Weather] Open-Meteo also failed:', e2.message);
  }
};

APP.get24h = async function () {
  if (APP.wx24hCache) return APP.wx24hCache;
  const r = await fetch(APP.WEATHER_24H);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  APP.wx24hCache = Array.isArray(data) ? data : [];
  console.log('[Weather] 24h loaded:', APP.wx24hCache.length, 'rows');
  return APP.wx24hCache;
};

APP.updateWxBadge = function (key) {
  const c  = APP.CITIES[key];
  const wx = APP.wxCache[c.wxCity];
  if (!wx) return;

  const temp = parseFloat(wx.temp_c);
  const wind = wx.wind_spd_kt || 0;
  let icon = 'ti-cloud-sun', color = '#F59E0B';
  if (temp >= 28)    { icon = 'ti-sun';       color = '#F97316'; }
  else if (temp < 10){ icon = 'ti-snowflake'; color = '#60A5FA'; }
  else if (wind > 20){ icon = 'ti-wind';      color = '#818CF8'; }

  document.getElementById('wx-icon').className   = 'ti ' + icon;
  document.getElementById('wx-icon').style.color = color;
  document.getElementById('wx-temp').textContent = temp.toFixed(1) + '\u00b0C';
  document.getElementById('wx-wind').textContent = wind + ' kt';

  // UTC observation time
  const utcTime = wx.obs_time
    ? new Date(wx.obs_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
    : '--';
  document.getElementById('wx-obs').textContent = utcTime;

  // Local city time (current time, not obs_time, to always be fresh)
  try {
    const localTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.tz });
    document.getElementById('wx-local').textContent = localTime + ' local';
  } catch (e) {
    document.getElementById('wx-local').textContent = '';
  }

  document.getElementById('wx-badge').classList.add('show');

  // Update map stats pill
  const sbWx = document.getElementById('sb-wx');
  if (sbWx) sbWx.textContent = temp.toFixed(1) + '\u00b0C';
};
