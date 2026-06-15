// LPIS XYZ tile proxy
// Converts /tiles/{z}/{x}/{y}.png requests into eagri.cz LPIS WMS GetMap calls
// and returns a transparent PNG with the green DPB (LPIS) parcel outlines.
//
// Use in QGroundControl as a Custom URL map provider:
//   https://<your-deployed-url>/tiles/{z}/{x}/{y}.png

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Earth radius for Web Mercator (EPSG:3857)
const R = 6378137;
const ORIGIN_SHIFT = Math.PI * R; // 20037508.342789244

// Convert XYZ tile coords to EPSG:3857 bounding box
function tileToBBox(x, y, z) {
  const tileSize = (2 * ORIGIN_SHIFT) / Math.pow(2, z);
  const minX = -ORIGIN_SHIFT + x * tileSize;
  const maxX = -ORIGIN_SHIFT + (x + 1) * tileSize;
  const maxY = ORIGIN_SHIFT - y * tileSize;
  const minY = ORIGIN_SHIFT - (y + 1) * tileSize;
  return [minX, minY, maxX, maxY];
}

app.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;
  const [minX, minY, maxX, maxY] = tileToBBox(Number(x), Number(y), Number(z));

  // LPIS WMS layer: LPIS_FB4 = effective DPB outlines (green lines)
  const wmsUrl =
    'https://eagri.cz/public/app/wms/plpis.fcgi' +
    '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap' +
    '&LAYERS=LPIS_FB4&STYLES=' +
    '&FORMAT=image/png&TRANSPARENT=TRUE' +
    '&SRS=EPSG:3857' +
    `&BBOX=${minX},${minY},${maxX},${maxY}` +
    '&WIDTH=256&HEIGHT=256';

  try {
    const r = await fetch(wmsUrl);
    if (!r.ok) {
      return res.status(502).send('Upstream WMS error: ' + r.status);
    }
    const buf = await r.buffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

app.get('/', (req, res) => {
  res.send(
    'LPIS tile proxy is running. Use this URL pattern in QGroundControl Custom Map:<br>' +
    `<code>${req.protocol}://${req.get('host')}/tiles/{z}/{x}/{y}.png</code>`
  );
});

app.listen(PORT, () => console.log(`LPIS proxy listening on port ${PORT}`));
