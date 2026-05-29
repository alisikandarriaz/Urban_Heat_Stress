/**
 * map.js - Leaflet map, WFS loading, layer toggling, city selection.
 */

APP.map     = null;
APP.curBM   = 'carto';
APP.curKey  = null;
APP.curFeat = null;
APP.LG      = {};
APP.wfsCache = { studyArea: null, nuts: null };
APP.wfsDone  = false;

APP.initMap = function () {
  APP.map = L.map('map', { zoomControl: false, center: [50, 10], zoom: 4 });
  L.control.zoom({ position: 'topright' }).addTo(APP.map);
  L.control.scale({ position: 'bottomright', imperial: false }).addTo(APP.map);

  APP.TILES = {
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '\u00a9 CartoDB', maxZoom: 19 }),
    osm:   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',            { attribution: '\u00a9 OpenStreetMap', maxZoom: 19 }),
    esri:  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '\u00a9 Esri', maxZoom: 18 }),
  };
  APP.TILES.carto.addTo(APP.map);
  document.querySelector('.bm-btn[data-bm="carto"]').classList.add('active');

  APP.WMS = {};
  Object.entries(APP.WMS_CONFIG).forEach(([id, cfg]) => {
    APP.WMS[id] = L.tileLayer.wms(cfg.url, {
      layers: cfg.layer, format: 'image/png', transparent: true,
      attribution: '\u00a9 Copernicus', ...cfg.opts,
    });
  });

  APP.map.on('click', APP._onMapClick);
  APP._loadAllWFS();
};

APP._loadAllWFS = async function () {
  try {
    const [sa, nuts] = await Promise.all([
      fetch(APP.WFS.studyArea).then(r => r.json()),
      fetch(APP.WFS.nuts).then(r => r.json()),
    ]);
    APP.wfsCache.studyArea = sa;
    APP.wfsCache.nuts = nuts;
    APP.wfsDone = true;
    console.log('[WFS] study_area:', sa.features?.length, 'nuts:', nuts.features?.length);
    console.log('[WFS] NUTS props sample:', nuts.features?.[0]?.properties);
    // Refresh reference layers if city already selected
    if (APP.curKey) {
      ['nuts','study'].forEach(k => { if (APP.LG[k]) { APP.map.removeLayer(APP.LG[k]); delete APP.LG[k]; } });
      APP._addReferenceLayers(APP.curKey, APP.CITIES[APP.curKey]);
    }
  } catch (e) {
    APP.wfsDone = true;
    console.warn('[WFS] Failed:', e.message);
  }
};

APP._findByNuts = function (collection, nuts3) {
  if (!collection?.features?.length) return null;
  const sample = collection.features[0]?.properties || {};
  const keys = ['NUTS_ID','nuts_id','NUTSID','nuts3','NUTS3','nuts3_id','nuts_code','id'];
  const key  = keys.find(k => k in sample);
  if (!key) { console.warn('[WFS] No NUTS_ID-like prop found. Available:', Object.keys(sample)); return null; }
  return collection.features.find(f => String(f.properties[key]).toUpperCase() === nuts3.toUpperCase()) || null;
};

APP.toggleL = function (id, on) {
  APP.LV[id] = on;
  if (['lu','trees','imp'].includes(id)) { on ? APP.WMS[id].addTo(APP.map) : APP.map.removeLayer(APP.WMS[id]); return; }
  if (!APP.LG[id]) return;
  on ? APP.LG[id].addTo(APP.map) : APP.map.removeLayer(APP.LG[id]);
};

APP.setBM = function (bm) {
  APP.map.removeLayer(APP.TILES[APP.curBM]);
  APP.TILES[bm].addTo(APP.map); APP.TILES[bm].bringToBack(); APP.curBM = bm;
  document.querySelectorAll('.bm-btn').forEach(b => b.classList.toggle('active', b.dataset.bm === bm));
};

APP.setCity = async function (key) {
  if (!key) return;
  APP.curKey = key;
  const c = APP.CITIES[key];
  APP._clearCityLayers(); APP.closeInfo();
  APP.map.flyTo(c.center, c.zoom, { duration: 1.3 });
  APP._buildDummyLayers(c.center);
  APP.showLoad('Loading layers\u2026');
  if (!APP.wfsDone) await new Promise(r => { const t = setInterval(() => { if (APP.wfsDone) { clearInterval(t); r(); } }, 150); });
  APP._addReferenceLayers(key, c);
  APP.hideLoad();
  ['lu','trees','imp'].forEach(id => {
    if (APP.LV[id] && !APP.map.hasLayer(APP.WMS[id])) APP.WMS[id].addTo(APP.map);
    if (!APP.LV[id] && APP.map.hasLayer(APP.WMS[id])) APP.map.removeLayer(APP.WMS[id]);
  });
  // Map stats pills
  const bar = document.getElementById('stats-bar');
  if (bar) bar.className = 'stats-bar show';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sb-lst',   c.lst + '\u00b0C');
  set('sb-uhi',   '+' + c.uhi);
  set('sb-green', c.green + '%');
  // Weather (load + update badge including sb-wx)
  APP.loadWeather();
  if (APP.analyticsOpen) APP.renderCharts(key);
};

APP._addReferenceLayers = function (key, c) {
  const nutsStyle  = { color: '#6B7280', weight: 2, fill: false, dashArray: '8 5' };
  const studyStyle = { color: '#F97316', weight: 2, fill: false, dashArray: '10 6' };
  const nf  = APP._findByNuts(APP.wfsCache.nuts, c.nuts3);
  const sf  = APP._findByNuts(APP.wfsCache.studyArea, c.nuts3);
  APP.LG.nuts  = nf  ? L.geoJSON(nf,  { style: nutsStyle  }) : L.rectangle(APP._fb(key), nutsStyle);
  if (nf) APP.curFeat = nf;
  const fb = APP._fb(key), buf = 0.03;
  APP.LG.study = sf  ? L.geoJSON(sf,  { style: studyStyle }) : L.rectangle([[fb[0][0]-buf,fb[0][1]-buf],[fb[1][0]+buf,fb[1][1]+buf]], studyStyle);
  if (APP.LV.nuts)  APP.LG.nuts.addTo(APP.map);
  if (APP.LV.study) APP.LG.study.addTo(APP.map);
};

APP._buildDummyLayers = function (ct) {
  const [la, lo] = ct;
  const b = {
    ho:[[la-.10,lo-.18],[la+.10,lo+.18]], hm:[[la-.055,lo-.10],[la+.055,lo+.10]], hi:[[la-.022,lo-.04],[la+.022,lo+.04]],
    n2k:[[la-.15,lo-.25],[la+.15,lo+.25]],
    gbif:[[la+.055,lo-.09],[la-.075,lo+.11],[la+.085,lo+.07],[la-.04,lo-.13]],
    green:[[la+.04,lo-.07],[la-.05,lo+.09],[la+.01,lo+.13]],
  };
  APP.LG.lst   = L.layerGroup([L.rectangle(b.ho,{color:'none',fillColor:'#FDBA74',fillOpacity:.18,weight:0}),L.rectangle(b.hm,{color:'none',fillColor:'#F97316',fillOpacity:.25,weight:0}),L.rectangle(b.hi,{color:'none',fillColor:'#DC2626',fillOpacity:.36,weight:0})]);
  APP.LG.uhi   = L.layerGroup([L.rectangle(b.ho,{color:'none',fillColor:'#C4B5FD',fillOpacity:.18,weight:0}),L.rectangle(b.hm,{color:'none',fillColor:'#A78BFA',fillOpacity:.25,weight:0}),L.rectangle(b.hi,{color:'none',fillColor:'#6D28D9',fillOpacity:.36,weight:0})]);
  APP.LG.utfvi = L.layerGroup([L.rectangle(b.ho,{color:'none',fillColor:'#6EE7B7',fillOpacity:.16,weight:0}),L.rectangle(b.hm,{color:'none',fillColor:'#F97316',fillOpacity:.22,weight:0}),L.rectangle(b.hi,{color:'none',fillColor:'#B45309',fillOpacity:.30,weight:0})]);
  APP.LG.n2k   = L.rectangle(b.n2k,  { color:'#16A34A', weight:1.5, fill:false, dashArray:'6 4' });
  APP.LG.gbif  = L.layerGroup(b.gbif.map((p,i) => L.circle(p, { radius:[700,550,620,480][i], color:'none', fillColor:'#86EFAC', fillOpacity:.48 })));
  APP.LG.green = L.layerGroup(b.green.map((p,i) => { const d=[.012,.015,.009][i]; return L.rectangle([[p[0]-d,p[1]-d*1.5],[p[0]+d,p[1]+d*1.5]],{color:'#16A34A',weight:.5,fillColor:'#4ADE80',fillOpacity:.36}); }));
  const skip = new Set(['lu','trees','imp','nuts','study']);
  Object.keys(APP.LG).forEach(k => { if (!skip.has(k) && APP.LV[k]) APP.LG[k].addTo(APP.map); });
};

APP._clearCityLayers = function () {
  const skip = new Set(['lu','trees','imp']);
  Object.entries(APP.LG).forEach(([k,l]) => { if (!skip.has(k) && l) { APP.map.removeLayer(l); delete APP.LG[k]; } });
  APP.curFeat = null;
};

APP._fb = function (key) {
  const FB = {
    marseille:[[43.17,5.21],[43.43,5.58]], athens:[[37.86,23.59],[38.08,23.84]],
    bucharest:[[44.33,25.94],[44.57,26.27]],brussels:[[50.79,4.24],[50.93,4.48]],
    glasgow:[[55.78,-4.50],[55.96,-3.97]],lausanne:[[46.44,6.54],[46.60,6.73]],
    madrid:[[40.28,-3.89],[40.64,-3.52]],rome:[[41.79,12.29],[42.06,12.67]],
    salzburg:[[47.73,12.98],[47.88,13.14]],stockholm:[[59.21,17.74],[59.45,18.42]],
    tuebingen:[[48.46,8.92],[48.59,9.20]],
  };
  return FB[key] || [[0,0],[1,1]];
};

APP._onMapClick = function () {
  if (!APP.curKey) return;
  const c  = APP.CITIES[APP.curKey];
  const wx = APP.wxCache?.[c.wxCity] || {};
  document.getElementById('ip-lst').textContent   = c.lst + ' \u00b0C';
  document.getElementById('ip-uhi').textContent   = '+' + c.uhi;
  document.getElementById('ip-utfvi').textContent = c.utfvi;
  document.getElementById('ip-lu').textContent    = c.land;
  document.getElementById('ip-nuts').textContent  = c.nuts3;
  document.getElementById('ip-temp').textContent  = wx.temp_c  != null ? parseFloat(wx.temp_c).toFixed(1) + ' \u00b0C' : '--';
  document.getElementById('ip-dewp').textContent  = wx.dewp_c  != null ? parseFloat(wx.dewp_c).toFixed(1) + ' \u00b0C' : '--';
  document.getElementById('ip-wind').textContent  = wx.wind_spd_kt != null ? wx.wind_spd_kt + ' kt' + (wx.wind_dir_deg ? ' @ ' + wx.wind_dir_deg + '\u00b0' : '') : '--';
  const obs = wx.obs_time ? new Date(wx.obs_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' UTC' : '--';
  document.getElementById('ip-obs').textContent = obs;
  document.getElementById('info-panel').style.display = 'block';
  document.getElementById('click-hint').style.display  = 'none';
};

APP.showLoad = m => { document.getElementById('load-msg').textContent = m; document.getElementById('map-loading').className = 'show'; };
APP.hideLoad = ()  => { document.getElementById('map-loading').className = ''; };
APP.closeInfo = () => { document.getElementById('info-panel').style.display='none'; document.getElementById('click-hint').style.display='block'; };
