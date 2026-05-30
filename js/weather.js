/**
 * weather.js
 * Fetches ONLY from Node-RED / our PostgreSQL database.
 * No external fallback — data must come from our own DB.
 */

APP.wxCache = {};

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
    console.warn('[Weather] Node-RED /api/weather failed:', e.message);
    // No fallback — data must come from our database
  }
};

APP.get24h = async function () {
  const r = await fetch(APP.WEATHER_24H);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  const rows = Array.isArray(data) ? data : [];
  console.log('[Weather] 24h loaded:', rows.length, 'rows');
  return rows;
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
    ? new Date(wx.obs_time).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'UTC' }) + ' UTC'
    : '--';
  document.getElementById('wx-obs').textContent = utcTime;

  // Local city time
  try {
    const localTime = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone: c.tz });
    document.getElementById('wx-local').textContent = localTime + ' local';
  } catch(e) {
    document.getElementById('wx-local').textContent = '';
  }

  document.getElementById('wx-badge').classList.add('show');
};