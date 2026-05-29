/**
 * config.js - Edit here to update cities, endpoints, or layer metadata.
 */
const APP = {};

APP.WEATHER_API = 'https://zgis185.geo.sbg.ac.at/group04/api/weather';
APP.WEATHER_24H = 'https://zgis185.geo.sbg.ac.at/group04/api/weather/24h';

APP.WFS = {
  studyArea: 'https://geoserver22s.zgis.at/geoserver/ipsdi_st26/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ipsdi_st26:study_area&outputFormat=application/json',
  nuts:      'https://geoserver22s.zgis.at/geoserver/ipsdi_st26/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ipsdi_st26:civis_nuts&outputFormat=application/json',
};

APP.WMS_CONFIG = {
  lu:    { url: 'https://image.discomap.eea.europa.eu/arcgis/services/UrbanAtlas/UA_UrbanAtlas_2018/MapServer/WMSServer', layer: 'Land_Use_vector52160',  opts: { version: '1.3.0' } },
  trees: { url: 'https://image.discomap.eea.europa.eu/arcgis/services/UrbanAtlas/UA_StreetTreeLayer_2018/MapServer/WMSServer', layer: 'STL_2018_Vector43148', opts: { version: '1.3.0', uppercase: true } },
  imp:   { url: 'https://geoserver.geoville.com/geoserver/nvlcc/ows', layer: 'HRL_NVLCC_IMD_10m', opts: { version: '1.3.0', crs: L.CRS.EPSG3857 } },
};

APP.CITIES = {
  marseille: { label:'Aix-en-Provence & Marseille, FR', wxCity:'Marseille', nuts3:'FRL06', tz:'Europe/Paris',    center:[43.2965,5.3698],  zoom:11, lst:35.8, uhi:2.4, utfvi:'Strong',   land:'Discontinuous urban', green:22, imp:50, pop:860000  },
  athens:    { label:'Athens, GR',                      wxCity:'Athens',    nuts3:'EL303', tz:'Europe/Athens',   center:[37.9838,23.7275], zoom:12, lst:39.2, uhi:4.1, utfvi:'Extreme',   land:'Continuous urban',    green:12, imp:68, pop:3150000 },
  bucharest: { label:'Bucharest, RO',                   wxCity:'Bucharest', nuts3:'RO321', tz:'Europe/Bucharest',center:[44.4268,26.1025], zoom:11, lst:36.2, uhi:2.6, utfvi:'Strong',    land:'Urban fabric',        green:18, imp:58, pop:1800000 },
  brussels:  { label:'Brussels, BE',                    wxCity:'Brussels',  nuts3:'BE100', tz:'Europe/Brussels', center:[50.8503,4.3517],  zoom:12, lst:31.4, uhi:1.9, utfvi:'Moderate',  land:'Continuous urban',    green:24, imp:52, pop:1200000 },
  glasgow:   { label:'Glasgow, UK',                     wxCity:'Glasgow',   nuts3:'UKM82', tz:'Europe/London',   center:[55.8642,-4.2518], zoom:11, lst:28.6, uhi:1.4, utfvi:'Moderate',  land:'Discontinuous urban', green:32, imp:38, pop:640000  },
  lausanne:  { label:'Lausanne, CH',                    wxCity:'Geneva',    nuts3:'CH013', tz:'Europe/Zurich',   center:[46.5197,6.6323],  zoom:12, lst:29.8, uhi:1.6, utfvi:'Moderate',  land:'Discontinuous urban', green:38, imp:35, pop:140000  },
  madrid:    { label:'Madrid, ES',                      wxCity:'Madrid',    nuts3:'ES300', tz:'Europe/Madrid',   center:[40.4168,-3.7038], zoom:10, lst:37.1, uhi:3.4, utfvi:'Extreme',   land:'Continuous urban',    green:15, imp:62, pop:3220000 },
  rome:      { label:'Rome, IT',                        wxCity:'Rome',      nuts3:'ITI43', tz:'Europe/Rome',     center:[41.9028,12.4964], zoom:11, lst:38.5, uhi:3.1, utfvi:'Strong',    land:'Continuous urban',    green:20, imp:55, pop:2870000 },
  salzburg:  { label:'Salzburg, AT',                    wxCity:'Salzburg',  nuts3:'AT323', tz:'Europe/Vienna',   center:[47.8095,13.0550], zoom:12, lst:30.2, uhi:1.5, utfvi:'Moderate',  land:'Discontinuous urban', green:40, imp:32, pop:155000  },
  stockholm: { label:'Stockholm, SE',                   wxCity:'Stockholm', nuts3:'SE110', tz:'Europe/Stockholm',center:[59.3293,18.0686], zoom:11, lst:26.8, uhi:1.2, utfvi:'Weak',      land:'Discontinuous urban', green:45, imp:30, pop:975000  },
  tuebingen: { label:'Tubingen, DE',                    wxCity:'Stuttgart', nuts3:'DE141', tz:'Europe/Berlin',   center:[48.5216,9.0576],  zoom:12, lst:32.4, uhi:1.7, utfvi:'Moderate',  land:'Discontinuous urban', green:36, imp:36, pop:92000   },
};

APP.CITY_KEYS   = Object.keys(APP.CITIES);
APP.CITY_LABELS = APP.CITY_KEYS.map(k => APP.CITIES[k].label.split(',')[0]);

APP.LV = {
  lst:true, uhi:false, utfvi:false,
  n2k:false, gbif:false, trees:false, green:false,
  lu:false, imp:false,
  study:true, nuts:true,
};

APP.XML_META = {
  lst:   { t:'Land Surface Temperature (LST)',       s:'Landsat 8 Band 10 - Google Earth Engine',         a:'Mean LST for summer months (May-September). Resolution 30m.',                                      crs:'EPSG:4326' },
  uhi:   { t:'Urban Heat Island Index (UHI)',         s:'Derived from LST',                                a:'UHI = (LST - LST_mean) / LST_std.',                                                               crs:'EPSG:4326' },
  utfvi: { t:'Urban Thermal Field Variance Index',   s:'Derived from LST',                                a:'UTFVI = (LST - LST_mean) / LST.',                                                                 crs:'EPSG:4326' },
  n2k:   { t:'Natura 2000 Protected Areas',          s:'European Environment Agency (EEA)',               a:'Natura 2000 network under the Birds and Habitats Directives.',                                     crs:'EPSG:4326' },
  gbif:  { t:'Species Occurrence Density',           s:'GBIF / Haus der Natur Salzburg',                  a:'Biodiversity observations including Plantae from Haus der Natur Salzburg.',                        crs:'EPSG:4326' },
  trees: { t:'Urban Street Trees 2018',              s:'Copernicus - Urban Atlas Street Tree Layer',      a:'DOI: 10.2909/205691b3-7ae9-41dd-abf1-1fbf60d72c8c',                                               crs:'EPSG:3035' },
  green: { t:'Urban Green Spaces',                   s:'Copernicus Urban Atlas 2018',                     a:'Green space coverage from Urban Atlas land use categories.',                                        crs:'EPSG:4326' },
  lu:    { t:'Urban Atlas Land Use 2018',            s:'Copernicus - Urban Atlas',                        a:'DOI: 10.2909/fb4dffa1-6ceb-4cc0-8372-1ed354c285e6',                                               crs:'EPSG:3035' },
  imp:   { t:'Imperviousness Density 2021 (10m)',    s:'Copernicus - HRL Imperviousness',                 a:'DOI: 10.2909/34ef6334-d432-4041-a3da-67e156d6501d',                                               crs:'EPSG:3035' },
  study: { t:'Study Area Boundaries',               s:'GeoServer: ipsdi_st26:study_area',                a:'Study area boundaries per CIVIS city.',                                                             crs:'EPSG:4326' },
  nuts:  { t:'NUTS3 Administrative Boundaries 2021', s:'GeoServer: ipsdi_st26:civis_nuts',               a:'NUTS Level 3 boundaries for the 11 CIVIS alliance cities.',                                         crs:'EPSG:4326' },
};
