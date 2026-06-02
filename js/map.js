/**
 * map.js
 */
APP.map=null; APP.curBM='carto'; APP.curKey=null; APP.curFeat=null; APP.curYear='2022';
APP.LG={}; APP.wfsCache={studyArea:null,nuts:null,cities:null}; APP.wfsDone=false;

APP.initMap = function () {
  APP.map = L.map('map',{zoomControl:false,center:[50,10],zoom:4});
  L.control.zoom({position:'topright'}).addTo(APP.map);
  L.control.scale({position:'bottomright',imperial:false}).addTo(APP.map);
  APP.TILES = {
    carto:L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'\u00a9 CartoDB',maxZoom:19}),
    osm:  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'\u00a9 OpenStreetMap',maxZoom:19}),
    esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'\u00a9 Esri',maxZoom:18}),
  };
  APP.TILES.carto.addTo(APP.map);
  document.querySelector('.bm-btn[data-bm="carto"]').classList.add('active');

  // Initialise all WMS layers
  APP.WMS = {};
  Object.entries(APP.WMS_CONFIG).forEach(([id,cfg]) => {
    APP.WMS[id] = L.tileLayer.wms(cfg.url, {
      layers:cfg.layer, format:cfg.opts.format||'image/png',
      transparent:true, ...cfg.opts,
    });
  });

  APP.map.on('click', APP._onMapClick);
  APP._loadAllWFS();
};

APP._loadAllWFS = async function () {
  try {
    const [sa, nuts, cities] = await Promise.all([
      fetch(APP.WFS.studyArea).then(r=>r.json()),
      fetch(APP.WFS.nuts).then(r=>r.json()),
      fetch(APP.WFS.cities).then(r=>r.json()),
    ]);
    APP.wfsCache.studyArea=sa; APP.wfsCache.nuts=nuts; APP.wfsCache.cities=cities;
    APP.wfsDone=true;
    console.log('[WFS] study_area props:', sa.features?.[0]?.properties);
    console.log('[WFS] civis_nuts props:', nuts.features?.[0]?.properties);
    console.log('[WFS] civis_cities props:', cities.features?.[0]?.properties);
    console.log('[WFS] civis_cities geom type:', cities.features?.[0]?.geometry?.type);
    APP._applyCityCenters(cities);
    if (APP.curKey) {
      ['nuts','study'].forEach(k=>{if(APP.LG[k]){APP.map.removeLayer(APP.LG[k]);delete APP.LG[k];}});
      APP._addReferenceLayers(APP.curKey,APP.CITIES[APP.curKey]);
    }
  } catch(e) { APP.wfsDone=true; console.warn('[WFS] Failed:',e.message); }
};

APP._applyCityCenters = function (citiesGeoJSON) {
  if (!citiesGeoJSON?.features?.length) { console.warn('[WFS] civis_cities returned no features'); return; }
  const NAME_MAP = {
    'Marseille':'marseille','Athen':'athens','Bukarest':'bucharest',
    'Bruxelles':'brussels','Glasgow':'glasgow','Lausanne':'lausanne',
    'Madrid':'madrid','Rom':'rome','Salzburg':'salzburg',
    'Stockholm':'stockholm','T\u00fcbingen':'tuebingen',
  };
  let updated=0;
  citiesGeoJSON.features.forEach(f => {
    const name=f.properties?.name, geom=f.geometry, key=NAME_MAP[name];
    if (!key||!geom) return;
    let lat,lng;
    if (geom.type==='Point') [lng,lat]=geom.coordinates;
    if (lat!=null&&lng!=null&&!isNaN(lat)&&!isNaN(lng)) {
      APP.CITIES[key].center=[lat,lng]; updated++;
      console.log('[WFS] City centre from GeoServer:',key,lat,lng);
    }
  });
  console.log('[WFS] Updated',updated,'of 11 city centres from GeoServer');
};

APP._findByNuts = function (col,nuts3) {
  if (!col?.features?.length) return null;
  const sample=col.features[0]?.properties||{};
  const key=['NUTS_ID','nuts_id','NUTSID','nuts3','NUTS3','nuts_code','id'].find(k=>k in sample);
  if (!key) return null;
  return col.features.find(f=>String(f.properties[key]).toUpperCase()===nuts3.toUpperCase())||null;
};

APP.toggleL = function (id, on) {
  APP.LV[id]=on;

  // Heat analysis — real GeoServer WMS (year-dependent)
  if (APP.YEAR_LAYERS[id]) {
    if (on) {
      const wmsId=APP.YEAR_LAYERS[id][APP.curYear];
      if (!APP.map.hasLayer(APP.WMS[wmsId])) APP.WMS[wmsId].addTo(APP.map);
    } else {
      Object.values(APP.YEAR_LAYERS[id]).forEach(yid=>{
        if (APP.map.hasLayer(APP.WMS[yid])) APP.map.removeLayer(APP.WMS[yid]);
      });
    }
    return;
  }

  // Other WMS layers
  if (['lu','trees','imp'].includes(id)) {
    on ? APP.WMS[id].addTo(APP.map) : APP.map.removeLayer(APP.WMS[id]);
    return;
  }

  // Vector placeholder layers (biodiversity)
  if (!APP.LG[id]) return;
  on ? APP.LG[id].addTo(APP.map) : APP.map.removeLayer(APP.LG[id]);
};

APP.setYear = function (year) {
  APP.curYear=year;
  document.querySelectorAll('.yr-btn').forEach(b=>b.classList.toggle('active',b.dataset.yr===year));

  // Switch active heat layers to new year
  Object.keys(APP.YEAR_LAYERS).forEach(id => {
    if (!APP.LV[id]) return;
    // Remove old year
    Object.values(APP.YEAR_LAYERS[id]).forEach(yid=>{
      if (APP.map.hasLayer(APP.WMS[yid])) APP.map.removeLayer(APP.WMS[yid]);
    });
    // Add new year
    APP.WMS[APP.YEAR_LAYERS[id][year]].addTo(APP.map);
  });
};

APP.setBM = function (bm) {
  APP.map.removeLayer(APP.TILES[APP.curBM]);
  APP.TILES[bm].addTo(APP.map); APP.TILES[bm].bringToBack(); APP.curBM=bm;
  document.querySelectorAll('.bm-btn').forEach(b=>b.classList.toggle('active',b.dataset.bm===bm));
};

APP.setCity = async function (key) {
  if (!key) return;
  APP.curKey=key; const c=APP.CITIES[key];
  APP._clearCityLayers(); APP.closeInfo();
  APP.map.flyTo(c.center,c.zoom,{duration:1.3});

  // Build biodiversity placeholder layers (LST/UHI/UTFVI now come from real WMS)
  APP._buildBioLayers(c.center);

  APP.showLoad('Loading\u2026');
  if (!APP.wfsDone) await new Promise(r=>{const t=setInterval(()=>{if(APP.wfsDone){clearInterval(t);r();}},150);});
  APP._addReferenceLayers(key,c);
  APP.hideLoad();

  // Add active heat analysis WMS for current year
  Object.keys(APP.YEAR_LAYERS).forEach(id=>{
    if (APP.LV[id]) {
      const wmsId=APP.YEAR_LAYERS[id][APP.curYear];
      if (!APP.map.hasLayer(APP.WMS[wmsId])) APP.WMS[wmsId].addTo(APP.map);
    }
  });

  // Other WMS layers
  ['lu','trees','imp'].forEach(id=>{
    if (APP.LV[id]&&!APP.map.hasLayer(APP.WMS[id])) APP.WMS[id].addTo(APP.map);
    if (!APP.LV[id]&&APP.map.hasLayer(APP.WMS[id])) APP.map.removeLayer(APP.WMS[id]);
  });

  // Stats pills
  const bar=document.getElementById('stats-bar'); if(bar)bar.className='stats-bar show';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('sb-lst',c.lst+'\u00b0C'); set('sb-uhi','+'+c.uhi); set('sb-green',c.green+'%');
  APP.loadWeather();
  if (APP.analyticsOpen) APP.renderCharts(key);
};

APP._addReferenceLayers = function (key,c) {
  const nS={color:'#6B7280',weight:2,fill:false,dashArray:'8 5'};
  const sS={color:'#F97316',weight:2,fill:false,dashArray:'10 6'};
  const nf=APP._findByNuts(APP.wfsCache.nuts,c.nuts3);
  const sf=APP._findByNuts(APP.wfsCache.studyArea,c.nuts3);
  APP.LG.nuts  = nf ? L.geoJSON(nf,{style:nS}) : L.rectangle(APP._fb(key),nS);
  if (nf) APP.curFeat=nf;
  const fb=APP._fb(key),buf=0.03;
  APP.LG.study = sf ? L.geoJSON(sf,{style:sS}) : L.rectangle([[fb[0][0]-buf,fb[0][1]-buf],[fb[1][0]+buf,fb[1][1]+buf]],sS);
  if (APP.LV.nuts)  APP.LG.nuts.addTo(APP.map);
  if (APP.LV.study) APP.LG.study.addTo(APP.map);
};

// Biodiversity still placeholder — real layers pending
APP._buildBioLayers = function (ct) {
  const [la,lo]=ct;
  const b={
    n2k:[[la-.15,lo-.25],[la+.15,lo+.25]],
    gbif:[[la+.055,lo-.09],[la-.075,lo+.11],[la+.085,lo+.07],[la-.04,lo-.13]],
    green:[[la+.04,lo-.07],[la-.05,lo+.09],[la+.01,lo+.13]],
  };
  APP.LG.n2k   = L.rectangle(b.n2k,{color:'#16A34A',weight:1.5,fill:false,dashArray:'6 4'});
  APP.LG.gbif  = L.layerGroup(b.gbif.map((p,i)=>L.circle(p,{radius:[700,550,620,480][i],color:'none',fillColor:'#86EFAC',fillOpacity:.48})));
  APP.LG.green = L.layerGroup(b.green.map((p,i)=>{const d=[.012,.015,.009][i];return L.rectangle([[p[0]-d,p[1]-d*1.5],[p[0]+d,p[1]+d*1.5]],{color:'#16A34A',weight:.5,fillColor:'#4ADE80',fillOpacity:.36});}));
  const skip=new Set(['lu','trees','imp','nuts','study','lst','uhi','utfvi']);
  Object.keys(APP.LG).forEach(k=>{if(!skip.has(k)&&APP.LV[k])APP.LG[k].addTo(APP.map);});
};

APP._clearCityLayers = function () {
  // Only clear vector layers — WMS layers (heat analysis) stay persistent
  const skip=new Set(['lu','trees','imp','lst2022','lst2025','uhi2022','uhi2025','utfvi2022','utfvi2025']);
  Object.entries(APP.LG).forEach(([k,l])=>{if(!skip.has(k)&&l){APP.map.removeLayer(l);delete APP.LG[k];}});
  APP.curFeat=null;
};

APP._fb = function (key) {
  const FB={
    marseille:[[43.17,5.21],[43.43,5.58]],athens:[[37.86,23.59],[38.08,23.84]],
    bucharest:[[44.33,25.94],[44.57,26.27]],brussels:[[50.79,4.24],[50.93,4.48]],
    glasgow:[[55.78,-4.50],[55.96,-3.97]],lausanne:[[46.44,6.54],[46.60,6.73]],
    madrid:[[40.28,-3.89],[40.64,-3.52]],rome:[[41.79,12.29],[42.06,12.67]],
    salzburg:[[47.73,12.98],[47.88,13.14]],stockholm:[[59.21,17.74],[59.45,18.42]],
    tuebingen:[[48.46,8.92],[48.59,9.20]],
  };
  return FB[key]||[[0,0],[1,1]];
};

APP._onMapClick = function () {
  if (!APP.curKey) return;
  const c=APP.CITIES[APP.curKey],wx=APP.wxCache?.[c.wxCity]||{};
  document.getElementById('ip-lst').textContent   = c.lst+' \u00b0C';
  document.getElementById('ip-uhi').textContent   = '+'+c.uhi;
  document.getElementById('ip-utfvi').textContent = c.utfvi;
  document.getElementById('ip-lu').textContent    = c.land;
  document.getElementById('ip-nuts').textContent  = c.nuts3;
  document.getElementById('ip-temp').textContent  = wx.temp_c!=null?parseFloat(wx.temp_c).toFixed(1)+' \u00b0C':'--';
  document.getElementById('ip-dewp').textContent  = wx.dewp_c!=null?parseFloat(wx.dewp_c).toFixed(1)+' \u00b0C':'--';
  document.getElementById('ip-wind').textContent  = wx.wind_spd_kt!=null?wx.wind_spd_kt+' kt'+(wx.wind_dir_deg?' @ '+wx.wind_dir_deg+'\u00b0':''):'--';
  const obs=wx.obs_time?new Date(wx.obs_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' UTC':'--';
  document.getElementById('ip-obs').textContent=obs;
  document.getElementById('info-panel').style.display='block';
  document.getElementById('click-hint').style.display='none';
};

APP.showLoad=m=>{document.getElementById('load-msg').textContent=m;document.getElementById('map-loading').className='show';};
APP.hideLoad=()=>{document.getElementById('map-loading').className='';};
APP.closeInfo=()=>{document.getElementById('info-panel').style.display='none';document.getElementById('click-hint').style.display='block';};