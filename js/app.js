/**
 * app.js - Init, UI toggles (desc, analytics, theme), exports, XML.
 */
APP.analyticsOpen = false;
APP.descOpen      = true;
APP.isLight       = false;

APP.init = function () {
  APP.initMap();
  // Force checkboxes to LV defaults (overrides browser persistence)
  Object.keys(APP.LV).forEach(k => { const el = document.getElementById('cb-'+k); if (el) el.checked = APP.LV[k]; });
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = '#2e2e2c';
  APP.loadWeather();
  console.log('[App] HotEurope SDI ready');
};

APP.toggleDesc = function () {
  APP.descOpen = !APP.descOpen;
  document.getElementById('desc-body').classList.toggle('hidden', !APP.descOpen);
  document.getElementById('desc-chevron').className = APP.descOpen ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
};

APP.toggleAnalytics = function () {
  APP.analyticsOpen = !APP.analyticsOpen;
  document.getElementById('a-drawer').classList.toggle('open', APP.analyticsOpen);
  document.getElementById('analytics-btn').classList.toggle('active', APP.analyticsOpen);
  setTimeout(() => {
    APP.map.invalidateSize();
    if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
  }, 310);
};

APP.toggleTheme = function () {
  APP.isLight = !APP.isLight;
  document.documentElement.classList.toggle('light', APP.isLight);
  document.getElementById('theme-btn').innerHTML = APP.isLight ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = APP.isLight ? '#e0ddd8' : '#2e2e2c';
  if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
};

APP.exportPDF = function () {
  if (!APP.analyticsOpen) {
    APP.analyticsOpen = true;
    document.getElementById('a-drawer').classList.add('open');
    if (APP.curKey) APP.renderCharts(APP.curKey);
    setTimeout(() => { APP.map.invalidateSize(); window.print(); }, 450);
  } else { window.print(); }
};

APP.exportGeoJSON = function () {
  if (!APP.curKey) { alert('Select a city first.'); return; }
  const c  = APP.CITIES[APP.curKey];
  const wx = APP.wxCache?.[c.wxCity] || {};
  const feat = APP.curFeat ? JSON.parse(JSON.stringify(APP.curFeat)) : { type:'Feature', geometry:null, properties:{} };
  feat.properties = { NUTS_ID:c.nuts3, city:c.label, LST_mean_C:c.lst, UHI_index:c.uhi, UTFVI_class:c.utfvi, green_pct:c.green, impervious_pct:c.imp, population:c.pop, live_temp_c:wx.temp_c||null, live_wind_kt:wx.wind_spd_kt||null, obs_time:wx.obs_time||null, source:'HotEurope Urban Heat Stress SDI', date:new Date().toISOString().slice(0,10) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({type:'FeatureCollection',features:[feat]},null,2)],{type:'application/json'}));
  a.download = 'UHS_SDI_'+APP.curKey+'_'+c.nuts3+'.geojson'; a.click();
};

APP.exportCSV = function () {
  const hdr  = ['City','NUTS3','LST_C','UHI','UTFVI','Green_pct','Imp_pct','Population','Live_temp_C','Live_wind_kt','Lat','Lng'];
  const rows = Object.entries(APP.CITIES).map(([k,c]) => { const wx=APP.wxCache?.[c.wxCity]||{}; return [c.label,c.nuts3,c.lst,c.uhi,c.utfvi,c.green,c.imp,c.pop,wx.temp_c||'',wx.wind_spd_kt||'',...c.center].join(','); });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv'}));
  a.download = 'UHS_SDI_CIVIS_cities.csv'; a.click();
};

APP.dlXML = function (id) {
  const m   = APP.XML_META[id] || { t:id, s:'HotEurope', a:'', crs:'EPSG:4326' };
  const day = new Date().toISOString().slice(0,10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">\n  <fileIdentifier><gco:CharacterString>UHS_SDI_${id}_CIVIS</gco:CharacterString></fileIdentifier>\n  <language><gco:CharacterString>eng</gco:CharacterString></language>\n  <dateStamp><gco:Date>${day}</gco:Date></dateStamp>\n  <identificationInfo>\n    <MD_DataIdentification>\n      <citation><CI_Citation>\n        <title><gco:CharacterString>${m.t}</gco:CharacterString></title>\n        <date><CI_Date><gco:Date>${day}</gco:Date><dateType><CI_DateTypeCode codeListValue="creation"/></dateType></CI_Date></date>\n      </CI_Citation></citation>\n      <abstract><gco:CharacterString>${m.a}</gco:CharacterString></abstract>\n      <credit><gco:CharacterString>Source: ${m.s}</gco:CharacterString></credit>\n      <language><gco:CharacterString>eng</gco:CharacterString></language>\n    </MD_DataIdentification>\n  </identificationInfo>\n  <referenceSystemInfo><MD_ReferenceSystem><referenceSystemIdentifier>\n    <RS_Identifier><gco:CharacterString>${m.crs}</gco:CharacterString></RS_Identifier>\n  </referenceSystemIdentifier></MD_ReferenceSystem></referenceSystemInfo>\n</MD_Metadata>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml],{type:'application/xml'}));
  a.download = 'UHS_SDI_metadata_'+id+'.xml'; a.click();
};

document.addEventListener('DOMContentLoaded', APP.init);
