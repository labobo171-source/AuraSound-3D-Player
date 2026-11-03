AuraSound Ultra 3D Player - PWA package

Files:
- index.html: the player
- manifest.webmanifest: installation metadata
- sw.js: offline shell cache

Deploy all four files to the same folder on an HTTPS static host (for example, Netlify).
Then open the HTTPS URL in Chrome on Android and choose Install app / Add to Home screen.

Library persistence:
- Tracks that you add are stored in this browser's IndexedDB on this device, so they should return after closing and reopening the app without rescanning.
- Storage is browser/site-specific. Do not clear Chrome site data if you want to keep the saved library. Large libraries may exceed available browser storage.
- Automatic discovery of newly added tracks is possible only in browsers that support the File System Access API and only after selecting the music folder with the in-app Scan Folder button and granting access. The app checks that saved folder when opened or brought back to the foreground; browsers do not permit continuous background monitoring while the app is closed.
- If Android Chrome does not support persistent directory handles on your device, the already-added tracks remain saved, but new tracks must be added manually with Select File / Scan Folder.

Privacy: audio files are saved locally in this browser's storage; this feature does not upload your music to Netlify.
