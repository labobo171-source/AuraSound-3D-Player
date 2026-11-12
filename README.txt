AuraSound Ultra 3D Player - PWA package

Files:
- index.html: the player
- cloud.js: optional Supabase account, sync, and private cloud music
- sw.js: offline shell cache

Deploy all four files to the same folder on an HTTPS static host (for example, GitHub Pages or Netlify).
Then open the HTTPS URL in Chrome on Android and choose Install app / Add to Home screen.

Supabase setup:
1. Open Supabase Dashboard > SQL Editor > New query.
2. Paste and run the complete contents of supabase/setup.sql.
3. The Supabase project URL and publishable key are configured in cloud.js.
4. In Authentication > URL Configuration, add the deployed app URL to Site URL / Redirect URLs.
5. If email confirmation is enabled, confirm the registration email before signing in.

Privacy and local-first behavior:
- The publishable key is intended for client apps. Never put a service_role or secret key in the app.
- Row Level Security policies in supabase/setup.sql isolate account data and files by user.
- Tracks added to the player are stored locally in this browser's IndexedDB on this device.
- Cloud sync and cloud track backup are optional and require an internet connection and a signed-in account.
- Audio files are uploaded only after the user explicitly selects Upload tracks.
- Storage bucket aurasound-tracks is private; each user can access only their own files.
- Storage is browser/site-specific. Do not clear Chrome site data if you want to keep the saved local library.
- Automatic discovery of new tracks is only possible where the browser supports File System Access API and the user has granted folder access. The app checks when opened or brought to the foreground; browsers do not permit continuous background monitoring while the app is closed.
- If Android Chrome does not support persistent directory handles, existing saved tracks remain, but new tracks must be added manually.

Offline:
- Local playback and locally saved tracks do not depend on Supabase.
- Login, cloud sync, and cloud music upload/download require an internet connection.
