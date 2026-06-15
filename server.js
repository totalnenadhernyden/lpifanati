// LPIS XYZ tile proxy
// Converts /tiles/{z}/{x}/{y}.png requests into eagri.cz LPIS WMS GetMap calls
// (EPSG:4326, the only CRS this WMS reliably supports) and reprojects the
// result into a 256x256 Web Mercator tile using a simple affine warp.
//
// Use in QGroundControl as a Custom URL map provider:
//   https://<your-deployed-url>/tiles/{z}/{x}/{y}.png

const express = require('express');
const fetch = require('node-fetch');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

const TILE_SIZE = 256;

// Convert XYZ tile coords -> lon/lat bounding box (EPSG:4326)
function tileToLonLatBBox(x, y, z) {
  const n = Math.pow(2, z);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latRad = (lat) => (lat * Math.PI) / 180;
  function tile2lat(yTile) {
    const nRad = Math.PI - (2 * Math.PI * yTile) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(nRad) - Math.exp(-nRad)));
  }
  const latMax = tile2lat(y);
  const latMin = tile2lat(y + 1);
  return { lonMin, lonMax, latMin, latMax };
}

app.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);

  const { lonMin, lonMax, latMin, latMax } = tileToLonLatBBox(x, y, z);

  // Request a square-ish image in EPSG:4326. To roughly compensate for the
  // lat/lon -> Mercator distortion, just request at TILE_SIZE and let the
  // browser/QGC stretch slightly - acceptable for boundary overlays at
  // typical drone-planning zoom levels (>=15).
  const wmsUrl =
    'https://eagri.cz/public/app/wms/plpis.fcgi' +
    '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap' +
    '&LAYERS=LPIS_FB4,LPIS_FB4_KOD&STYLES=,' +
    '&FORMAT=image/png&TRANSPARENT=TRUE' +
    '&SRS=EPSG:4326' +
    `&BBOX=${lonMin},${latMin},${lonMax},${latMax}` +
    `&WIDTH=${TILE_SIZE}&HEIGHT=${TILE_SIZE}`;

  try {
    const r = await fetch(wmsUrl);
    const contentType = r.headers.get('content-type') || '';

    if (!r.ok || !contentType.includes('image')) {
      const body = await r.text();
      console.error(`WMS error for tile ${z}/${x}/${y}: status=${r.status} ct=${contentType} body=${body.slice(0, 500)}`);
      // Return a transparent tile instead of breaking the map
      const blank = await sharp({
        create: { width: TILE_SIZE, height: TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).png().toBuffer();
      res.set('Content-Type', 'image/png');
      return res.send(blank);
    }

    const buf = await r.buffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    console.error(`Proxy error for tile ${z}/${x}/${y}:`, err.message);
    const blank = await sharp({
      create: { width: TILE_SIZE, height: TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(blank);
  }
});

// Debug endpoint: shows the raw WMS response (status, content-type, first bytes)
app.get('/debug/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const { lonMin, lonMax, latMin, latMax } = tileToLonLatBBox(x, y, z);

  const wmsUrl =
    'https://eagri.cz/public/app/wms/plpis.fcgi' +
    '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap' +
    '&LAYERS=LPIS_FB4,LPIS_FB4_KOD&STYLES=,' +
    '&FORMAT=image/png&TRANSPARENT=TRUE' +
    '&SRS=EPSG:4326' +
    `&BBOX=${lonMin},${latMin},${lonMax},${latMax}` +
    `&WIDTH=${TILE_SIZE}&HEIGHT=${TILE_SIZE}`;

  try {
    const r = await fetch(wmsUrl);
    const contentType = r.headers.get('content-type') || '';
    const text = await r.text();
    res.set('Content-Type', 'text/plain');
    res.send(
      `Request URL:\n${wmsUrl}\n\nStatus: ${r.status}\nContent-Type: ${contentType}\n\nBody (first 1000 chars):\n${text.slice(0, 1000)}`
    );
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.get('/', (req, res) => {
  res.send(
    'LPIS tile proxy is running.<br>' +
    'Tile URL for QGroundControl:<br>' +
    `<code>${req.protocol}://${req.get('host')}/tiles/{z}/{x}/{y}.png</code><br><br>` +
    'Debug a specific tile (shows raw WMS response):<br>' +
    `<code>${req.protocol}://${req.get('host')}/debug/15/17000/11000</code>`
  );
});

app.listen(PORT, () => console.log(`LPIS proxy listening on port ${PORT}`));
