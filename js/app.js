/**
 * app.js — init, language, theme, analytics, about modal, onboarding, exports
 */
APP.analyticsOpen = false;
APP.descOpen      = true;
APP.isLight       = false;
APP.lang          = 'en';

APP.init = function () {
  APP.initMap();
  Object.keys(APP.LV).forEach(k=>{const el=document.getElementById('cb-'+k);if(el)el.checked=APP.LV[k];});
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = '#2e2e2c';
  APP.loadWeather();
  APP.startClock();
  APP.initOnboarding();
  console.log('[App] HotEurope SDI ready');
};

// ── Language ───────────────────────────────────────────────────────────
APP.setLang = function (lang) {
  APP.lang = lang;
  const t = APP.I18N[lang] || APP.I18N.en;
  const en = APP.I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t[key] || en[key] || key;
  });
  const hasDesc = !!document.querySelector('.lang-block[data-lang="'+lang+'"]');
  document.querySelectorAll('.lang-block').forEach(el => {
    el.style.display = (el.dataset.lang===lang || (!hasDesc && el.dataset.lang==='en')) ? 'block' : 'none';
  });
  document.documentElement.lang = lang;
  if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
};

// ── Description toggle ─────────────────────────────────────────────────
APP.toggleDesc = function () {
  APP.descOpen = !APP.descOpen;
  document.getElementById('desc-body').classList.toggle('hidden', !APP.descOpen);
  document.getElementById('desc-chevron').className = APP.descOpen ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
};

// ── Analytics ──────────────────────────────────────────────────────────
APP.toggleAnalytics = function () {
  APP.analyticsOpen = !APP.analyticsOpen;
  document.getElementById('a-drawer').classList.toggle('open', APP.analyticsOpen);
  document.getElementById('analytics-btn').classList.toggle('active', APP.analyticsOpen);
  setTimeout(() => { APP.map.invalidateSize(); if(APP.analyticsOpen&&APP.curKey) APP.renderCharts(APP.curKey); }, 310);
};

// ── Theme ──────────────────────────────────────────────────────────────
APP.toggleTheme = function () {
  APP.isLight = !APP.isLight;
  document.documentElement.classList.toggle('light', APP.isLight);
  document.getElementById('theme-btn').innerHTML = APP.isLight ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
  Chart.defaults.color       = '#73726c';
  Chart.defaults.borderColor = APP.isLight ? '#e0ddd8' : '#2e2e2c';
  if (APP.analyticsOpen && APP.curKey) APP.renderCharts(APP.curKey);
};

// ── About modal ────────────────────────────────────────────────────────
APP.showAbout = function () {
  document.getElementById('about-modal').classList.remove('hidden');
  APP.switchTab('about');
};
APP.closeAbout = function () {
  document.getElementById('about-modal').classList.add('hidden');
};
APP.switchTab = function (tab) {
  document.querySelectorAll('.mtab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));
};

// ── Map helpers ────────────────────────────────────────────────────────
APP.showLoad=m=>{document.getElementById('load-msg').textContent=m;document.getElementById('map-loading').className='show';};
APP.hideLoad=()=>{document.getElementById('map-loading').className='';};
APP.closeInfo=()=>{const ip=document.getElementById('info-panel');const ch=document.getElementById('click-hint');if(ip)ip.style.display='none';if(ch)ch.style.display='block';};
//APP.closeInfo=()=>{document.getElementById('info-panel').style.display='none';document.getElementById('click-hint').style.display='block';}; diable info panel on click

// ── PDF export ─────────────────────────────────────────────────────────
APP.exportPDF = function () {
  if (!APP.analyticsOpen) {
    APP.analyticsOpen = true;
    document.getElementById('a-drawer').classList.add('open');
    if (APP.curKey) APP.renderCharts(APP.curKey);
    setTimeout(() => { APP.map.invalidateSize(); window.print(); }, 600);
  } else { window.print(); }
};

// ── GeoJSON export ─────────────────────────────────────────────────────
APP.exportGeoJSON = function () {
  if (!APP.curKey) { alert('Select a city first.'); return; }
  const c=APP.CITIES[APP.curKey], wx=APP.wxCache?.[c.wxCity]||{};
  const feat = APP.curFeat ? JSON.parse(JSON.stringify(APP.curFeat)) : {type:'Feature',geometry:null,properties:{}};
  feat.properties = { NUTS_ID:c.nuts3, city:c.label, LST_mean_C:c.lst, UHI_index:c.uhi, UTFVI_class:c.utfvi, green_pct:c.green, imp_pct:c.imp, population:c.pop, greenness:APP.GREENNESS[APP.curKey], live_temp_c:wx.temp_c||null, live_wind_kt:wx.wind_spd_kt||null, obs_time:wx.obs_time||null, source:'HotEurope Urban Heat Stress SDI v1.0', date:new Date().toISOString().slice(0,10) };
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({type:'FeatureCollection',features:[feat]},null,2)],{type:'application/json'}));
  a.download='UHS_SDI_'+APP.curKey+'_'+c.nuts3+'.geojson'; a.click();
};

// ── CSV export ─────────────────────────────────────────────────────────
APP.exportCSV = function () {
  const hdr=['City','NUTS3','LST_C','UHI','UTFVI','Green_pct','Imp_pct','Population','Greenness_Index','Live_temp_C','Live_wind_kt','Lat','Lng'];
  const rows=Object.entries(APP.CITIES).map(([k,c])=>{const wx=APP.wxCache?.[c.wxCity]||{};return [c.label,c.nuts3,c.lst,c.uhi,c.utfvi,c.green,c.imp,c.pop||'',APP.GREENNESS[k]??'',wx.temp_c||'',wx.wind_spd_kt||'',...c.center].join(',');});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv'}));
  a.download='UHS_SDI_CIVIS_cities.csv'; a.click();
};

// ── XML metadata ───────────────────────────────────────────────────────
APP.dlXML = function (id) {
  const yr = APP.curYear || '2022';
  const FILE_MAP = {
    lst:   'metadata/LST'   + yr + '_metadata.xml',
    uhi:   'metadata/UHI'   + yr + '_metadata.xml',
    utfvi: 'metadata/UTFVI' + yr + '_metadata.xml',
    nuts:  'metadata/NUTS2024_metadata.xml',
    study: 'metadata/studyarea_metadata.xml',
    lu:    'metadata/urbanatlas2018_metadata.xml',
    trees: 'metadata/streettrees2018_metadata.xml',
    imp:   'metadata/impervioussurfaces2021_metadata.xml',
    gbif:  'metadata/gbif_metadata.xml',
  };
  const file = FILE_MAP[id];
  if (file) {
    const a = document.createElement('a');
    a.href = file;
    a.download = file.split('/').pop();
    a.click();
    return;
  }
  const m = APP.XML_META[id] || {t:id, s:'HotEurope SDI', a:'', crs:'EPSG:4326'};
  const day = new Date().toISOString().slice(0,10);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">\n  <fileIdentifier><gco:CharacterString>UHS_SDI_' + id + '</gco:CharacterString></fileIdentifier>\n  <dateStamp><gco:Date>' + day + '</gco:Date></dateStamp>\n  <identificationInfo><MD_DataIdentification>\n    <citation><CI_Citation><title><gco:CharacterString>' + m.t + '</gco:CharacterString></title></CI_Citation></citation>\n    <abstract><gco:CharacterString>' + m.a + '</gco:CharacterString></abstract>\n    <credit><gco:CharacterString>Source: ' + m.s + '</gco:CharacterString></credit>\n  </MD_DataIdentification></identificationInfo>\n</MD_Metadata>';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml], {type:'application/xml'}));
  a.download = 'UHS_SDI_metadata_' + id + '.xml';
  a.click();
};
// ── Onboarding ─────────────────────────────────────────────────────────
APP.obStep=1; APP.OB_TOTAL=5;

APP.initOnboarding = function () {
  if (localStorage.getItem('hoteurope_onboarded')) return;
  const dotsEl=document.getElementById('ob-dots'); if(!dotsEl) return;
  for (let i=1;i<=APP.OB_TOTAL;i++) {
    const d=document.createElement('div'); d.className='ob-dot'+(i===1?' active':'');
    d.onclick=()=>APP.obGoTo(i); dotsEl.appendChild(d);
  }
  document.getElementById('ob-overlay').classList.remove('hidden');
  APP._obRefresh();
};
APP._obRefresh = function () {
  document.querySelectorAll('.ob-step').forEach(el=>el.classList.remove('active'));
  const s=document.querySelector('.ob-step[data-step="'+APP.obStep+'"]'); if(s)s.classList.add('active');
  document.querySelectorAll('.ob-dot').forEach((d,i)=>d.classList.toggle('active',i+1===APP.obStep));
  const pb=document.getElementById('ob-prev'); if(pb)pb.disabled=APP.obStep===1;
  APP.setLang(APP.lang);
};
APP.obNext=function(){if(APP.obStep<APP.OB_TOTAL){APP.obStep++;APP._obRefresh();}else APP.closeOnboarding();};
APP.obPrev=function(){if(APP.obStep>1){APP.obStep--;APP._obRefresh();}};
APP.obGoTo=function(n){APP.obStep=n;APP._obRefresh();};
APP.closeOnboarding=function(){const ov=document.getElementById('ob-overlay');if(ov)ov.classList.add('hidden');localStorage.setItem('hoteurope_onboarded','1');};
APP.restartOnboarding=function(){localStorage.removeItem('hoteurope_onboarded');APP.obStep=1;document.getElementById('ob-dots').innerHTML='';document.getElementById('ob-overlay').classList.remove('hidden');APP.initOnboarding();APP.closeAbout();};

document.addEventListener('DOMContentLoaded', APP.init);