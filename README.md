# LPIS XYZ Tile Proxy for QGroundControl

This tiny server converts standard XYZ tile requests (`/tiles/{z}/{x}/{y}.png`)
into LPIS WMS GetMap requests to eagri.cz, returning transparent PNG tiles
showing the official Czech LPIS field boundary lines (DPB - "díly půdních bloků").

## Deploy in ~3 minutes (Render.com, free)

1. Go to https://render.com and sign up (free, no credit card needed for this tier).
2. Click "New +" -> "Web Service".
3. Choose "Build and deploy from a Git repository" -> or use "Public Git Repository"
   and paste a repo URL if you push these files to GitHub first. Easiest:
   - Create a new GitHub repo (e.g. "lpis-proxy"), upload server.js and package.json.
   - In Render, connect that repo.
4. Settings:
   - Environment: Node
   - Build Command: npm install
   - Start Command: npm start
   - Instance Type: Free
5. Click "Create Web Service". Wait ~2 minutes for deploy.
6. You'll get a URL like: https://lpis-proxy-xxxx.onrender.com

## Use in QGroundControl

1. Open QGroundControl -> Application Settings (gear icon) -> General.
2. Scroll to "Map Provider" section.
3. Set Map Type to "Custom URL" (or similar wording depending on version).
4. Enter the tile URL template:

   https://lpis-proxy-xxxx.onrender.com/tiles/{z}/{x}/{y}.png

5. Save. The LPIS green field boundaries should now overlay your map.

## Notes

- Free Render instances sleep after inactivity; first tile load after idle
  may take ~30-60 seconds to "wake up".
- Layer used: LPIS_FB4 (effective DPB outlines). To change which LPIS layer
  is shown, edit the LAYERS parameter in server.js (see eAGRI WMS manual for
  other layer names like LPIS_FB_ZPUS, LPIS_FB1_KOD, etc.).
- This proxy only returns the boundary overlay (transparent background) -
  QGC will show it on top of its normal base map (satellite/street).
