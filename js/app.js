/**
 * app.js
 * Init, UI toggles, language (EN/DE), onboarding, theme, exports, XML.
 */

APP.analyticsOpen = false;
APP.descOpen      = true;
APP.isLight       = false;
APP.lang          = 'en';

// ── Init ───────────────────────────────────────────────────────────────
APP.init = function () {
  APP.initMap();
  Object.keys(APP.LV).forEach(k => { const el = document.getElementById('cb-'+k); if (el) el.checked = APP.LV[k]; });
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = '#2e2e2c';
  APP.loadWeather();
  APP.initOnboarding();
  console.log('[App] HotEurope SDI ready');
};

// ── Description toggle ─────────────────────────────────────────────────
APP.toggleDesc = function () {
  APP.descOpen = !APP.descOpen;
  document.getElementById('desc-body').classList.toggle('hidden', !APP.descOpen);
  document.getElementById('desc-chevron').className = APP.descOpen ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
};

// ── Analytics drawer ───────────────────────────────────────────────────
APP.toggleAnalytics = function () {
  APP.analyticsOpen = !APP.analyticsOpen;
  document.getElementById('a-drawer').classList.toggle('open', APP.analyticsOpen);
  document.getElementById('analytics-btn').classList.toggle('active', APP.analyticsOpen);
  setTimeout(() => {
    APP.map.invalidateSize();
    if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
  }, 310);
};

// ── Theme toggle ───────────────────────────────────────────────────────
APP.toggleTheme = function () {
  APP.isLight = !APP.isLight;
  document.documentElement.classList.toggle('light', APP.isLight);
  document.getElementById('theme-btn').innerHTML = APP.isLight ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = APP.isLight ? '#e0ddd8' : '#2e2e2c';
  if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
};

// ── Language toggle (EN / DE) ──────────────────────────────────────────
APP.toggleLang = function () {
  APP.lang = APP.lang === 'en' ? 'de' : 'en';
  const isDe = APP.lang === 'de';
  document.documentElement.classList.toggle('de', isDe);
  document.getElementById('lang-btn').textContent = isDe ? 'EN' : 'DE';
  // Update all elements with data-en / data-de attributes
  document.querySelectorAll('[data-en]').forEach(el => {
    el.textContent = isDe ? (el.dataset.de || el.dataset.en) : el.dataset.en;
  });
  if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
};

// ── Map helpers ────────────────────────────────────────────────────────
APP.showLoad = m => { document.getElementById('load-msg').textContent=m; document.getElementById('map-loading').className='show'; };
APP.hideLoad = ()  => { document.getElementById('map-loading').className=''; };
APP.closeInfo = () => { document.getElementById('info-panel').style.display='none'; document.getElementById('click-hint').style.display='block'; };

// ── PDF export ─────────────────────────────────────────────────────────
APP.exportPDF = function () {
  if (!APP.analyticsOpen) {
    APP.analyticsOpen = true;
    document.getElementById('a-drawer').classList.add('open');
    if (APP.curKey) APP.renderCharts(APP.curKey);
    setTimeout(() => { APP.map.invalidateSize(); window.print(); }, 500);
  } else { window.print(); }
};

// ── GeoJSON export ─────────────────────────────────────────────────────
APP.exportGeoJSON = function () {
  if (!APP.curKey) { alert('Select a city first.'); return; }
  const c  = APP.CITIES[APP.curKey];
  const wx = APP.wxCache?.[c.wxCity] || {};
  const feat = APP.curFeat ? JSON.parse(JSON.stringify(APP.curFeat)) : { type:'Feature', geometry:null, properties:{} };
  feat.properties = {
    NUTS_ID:c.nuts3, city:c.label, LST_mean_C:c.lst, UHI_index:c.uhi,
    UTFVI_class:c.utfvi, green_pct:c.green, impervious_pct:c.imp,
    population:c.pop, greenness_index:APP.GREENNESS[APP.curKey],
    live_temp_c:wx.temp_c||null, live_wind_kt:wx.wind_spd_kt||null,
    obs_time:wx.obs_time||null, source:'HotEurope Urban Heat Stress SDI',
    date:new Date().toISOString().slice(0,10),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({type:'FeatureCollection',features:[feat]},null,2)],{type:'application/json'}));
  a.download = 'UHS_SDI_'+APP.curKey+'_'+c.nuts3+'.geojson'; a.click();
};

// ── CSV export ─────────────────────────────────────────────────────────
APP.exportCSV = function () {
  const hdr  = ['City','NUTS3','LST_C','UHI','UTFVI','Green_pct','Imp_pct','Population','Greenness_Index','Live_temp_C','Live_wind_kt','Lat','Lng'];
  const rows = Object.entries(APP.CITIES).map(([k,c]) => {
    const wx = APP.wxCache?.[c.wxCity] || {};
    return [c.label,c.nuts3,c.lst,c.uhi,c.utfvi,c.green,c.imp,c.pop||'',APP.GREENNESS[k]??'',wx.temp_c||'',wx.wind_spd_kt||'',...c.center].join(',');
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv'}));
  a.download = 'UHS_SDI_CIVIS_cities.csv'; a.click();
};

// ── XML metadata download ──────────────────────────────────────────────
APP.dlXML = function (id) {
  const m   = APP.XML_META[id] || { t:id, s:'HotEurope', a:'', crs:'EPSG:4326' };
  const day = new Date().toISOString().slice(0,10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">\n  <fileIdentifier><gco:CharacterString>UHS_SDI_${id}_CIVIS</gco:CharacterString></fileIdentifier>\n  <language><gco:CharacterString>eng</gco:CharacterString></language>\n  <dateStamp><gco:Date>${day}</gco:Date></dateStamp>\n  <identificationInfo><MD_DataIdentification>\n    <citation><CI_Citation>\n      <title><gco:CharacterString>${m.t}</gco:CharacterString></title>\n      <date><CI_Date><gco:Date>${day}</gco:Date><dateType><CI_DateTypeCode codeListValue="creation"/></dateType></CI_Date></date>\n    </CI_Citation></citation>\n    <abstract><gco:CharacterString>${m.a}</gco:CharacterString></abstract>\n    <credit><gco:CharacterString>Source: ${m.s}</gco:CharacterString></credit>\n  </MD_DataIdentification></identificationInfo>\n  <referenceSystemInfo><MD_ReferenceSystem><referenceSystemIdentifier>\n    <RS_Identifier><gco:CharacterString>${m.crs}</gco:CharacterString></RS_Identifier>\n  </referenceSystemIdentifier></MD_ReferenceSystem></referenceSystemInfo>\n</MD_Metadata>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml],{type:'application/xml'}));
  a.download = 'UHS_SDI_metadata_'+id+'.xml'; a.click();
};

// ── Onboarding ─────────────────────────────────────────────────────────
APP.obStep   = 1;
APP.OB_TOTAL = 5;

APP.initOnboarding = function () {
  if (localStorage.getItem('hoteurope_onboarded')) return;
  const dotsEl = document.getElementById('ob-dots');
  if (!dotsEl) return;
  for (let i = 1; i <= APP.OB_TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'ob-dot' + (i === 1 ? ' active' : '');
    d.onclick   = () => APP.obGoTo(i);
    dotsEl.appendChild(d);
  }
  document.getElementById('ob-overlay').classList.remove('hidden');
  APP._obRefresh();
};

APP._obRefresh = function () {
  document.querySelectorAll('.ob-step').forEach(el => el.classList.remove('active'));
  const step = document.querySelector('.ob-step[data-step="' + APP.obStep + '"]');
  if (step) step.classList.add('active');
  document.querySelectorAll('.ob-dot').forEach((d,i) => d.classList.toggle('active', i+1 === APP.obStep));
  const prevBtn = document.getElementById('ob-prev');
  if (prevBtn) prevBtn.disabled = APP.obStep === 1;
  const nextLbl = document.getElementById('ob-next-lbl');
  if (nextLbl) {
    const isLast = APP.obStep === APP.OB_TOTAL;
    nextLbl.dataset.en = isLast ? 'Get started' : 'Next';
    nextLbl.dataset.de = isLast ? 'Loslegen'    : 'Weiter';
    nextLbl.textContent = APP.lang === 'de' ? nextLbl.dataset.de : nextLbl.dataset.en;
  }
};

APP.obNext = function () {
  if (APP.obStep < APP.OB_TOTAL) { APP.obStep++; APP._obRefresh(); }
  else APP.closeOnboarding();
};
APP.obPrev = function () {
  if (APP.obStep > 1) { APP.obStep--; APP._obRefresh(); }
};
APP.obGoTo = function (n) { APP.obStep = n; APP._obRefresh(); };
APP.closeOnboarding = function () {
  const ov = document.getElementById('ob-overlay');
  if (ov) ov.classList.add('hidden');
  localStorage.setItem('hoteurope_onboarded','1');
};

document.addEventListener('DOMContentLoaded', APP.init);