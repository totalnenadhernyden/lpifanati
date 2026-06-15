// LPIS XYZ tile proxy
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const TILE_SIZE = 256;

function tileToLonLatBBox(x, y, z) {
  const n = Math.pow(2, z);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  function tile2lat(yTile) {
    const nRad = Math.PI - (2 * Math.PI * yTile) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(nRad) - Math.exp(-nRad)));
  }
  const latMax = tile2lat(y);
  const latMin = tile2lat(y + 1);
  return { lonMin, lonMax, latMin, latMax };
}

function buildWmsUrl(lonMin, latMin, lonMax, latMax) {
  return 'https://eagri.cz/public/app/wms/public_DPB_PB_OPV.fcgi' +
    '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap' +
    '&LAYERS=DPB_PB,KN' +
    '&STYLES=,' +
    '&FORMAT=image/png&TRANSPARENT=TRUE' +
    '&SRS=EPSG:4326' +
    `&BBOX=${lonMin},${latMin},${lonMax},${latMax}` +
    `&WIDTH=${TILE_SIZE}&HEIGHT=${TILE_SIZE}`;
}

app.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const { lonMin, lonMax, latMin, latMax } = tileToLonLatBBox(x, y, z);
  const wmsUrl = buildWmsUrl(lonMin, latMin, lonMax, latMax);

  try {
    const r = await fetch(wmsUrl);
    const contentType = r.headers.get('content-type') || '';
    if (!r.ok || !contentType.includes('image')) {
      console.error(`WMS error ${z}/${x}/${y}: status=${r.status} ct=${contentType}`);
      return res.status(204).end();
    }
    const buf = await r.buffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    console.error(`Proxy error ${z}/${x}/${y}:`, err.message);
    res.status(204).end();
  }
});

app.get('/debug/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const { lonMin, lonMax, latMin, latMax } = tileToLonLatBBox(x, y, z);
  const wmsUrl = buildWmsUrl(lonMin, latMin, lonMax, latMax);

  try {
    const r = await fetch(wmsUrl);
    const contentType = r.headers.get('content-type') || '';
    const text = await r.text();
    res.set('Content-Type', 'text/plain');
    res.send(`Request URL:\n${wmsUrl}\n\nStatus: ${r.status}\nContent-Type: ${contentType}\n\nBody (first 1000 chars, only meaningful if not an image):\n${text.slice(0, 1000)}`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.get('/caps', async (req, res) => {
  try {
    const r = await fetch('https://eagri.cz/public/app/wms/public_DPB_PB_OPV.fcgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities');
    const text = await r.text();
    res.set('Content-Type', 'text/plain');
    res.send(text);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.get('/', (req, res) => {
  res.send(
    'LPIS tile proxy v4 running.<br>' +
    `Tile URL: <code>${req.protocol}://${req.get('host')}/tiles/{z}/{x}/{y}.png</code><br>` +
    `Debug: <code>${req.protocol}://${req.get('host')}/debug/15/17545/11149</code><br>` +
    `Capabilities: <code>${req.protocol}://${req.get('host')}/caps</code>`
  );
});

app.listen(PORT, () => console.log(`LPIS proxy v4 listening on port ${PORT}`));
