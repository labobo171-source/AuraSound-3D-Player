#!/usr/bin/env python3
"""Patch the extracted Android web bundle for MediaStore sync and playlist controls."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
hp = root / "index.html"
jp = root / "native/android/AuraNativePlugin.java"
mp = root / "native/android/patch_manifest.py"
html = hp.read_text(encoding="utf-8")
plugin = jp.read_text(encoding="utf-8")

old = '''@CapacitorPlugin(name="AuraNative", permissions={
  @Permission(alias="audio", strings={"android.permission.READ_MEDIA_AUDIO", "android.permission.READ_EXTERNAL_STORAGE"})
})'''
new = '''@CapacitorPlugin(name="AuraNative", permissions={
  @Permission(alias="audio", strings={"android.permission.READ_MEDIA_AUDIO"}),
  @Permission(alias="legacyAudio", strings={"android.permission.READ_EXTERNAL_STORAGE"})
})'''
if old in plugin:
    plugin = plugin.replace(old, new, 1)
elif new not in plugin:
    raise SystemExit("AuraNative permission annotation not found")

if "private String audioPermissionAlias()" not in plugin:
    anchor = "  private ContentObserver mediaStoreObserver;\n"
    if anchor not in plugin:
        raise SystemExit("Plugin insertion point not found")
    plugin = plugin.replace(anchor, anchor + '''
  private String audioPermissionAlias() {
    return Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
  }
''', 1)

plugin = plugin.replace('getPermissionState("audio")', 'getPermissionState(audioPermissionAlias())')
plugin = plugin.replace('requestPermissionForAlias("audio", call,', 'requestPermissionForAlias(audioPermissionAlias(), call,')
plugin = plugin.replace(
    'if (Build.VERSION.SDK_INT >= 33 && getPermissionState(audioPermissionAlias()) != PermissionState.GRANTED)',
    'if (Build.VERSION.SDK_INT >= 23 && getPermissionState(audioPermissionAlias()) != PermissionState.GRANTED)'
)

# Legacy storage permission is valid only through Android 12.
if mp.exists():
    manifest_patch = mp.read_text(encoding="utf-8").replace(
        '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
        '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'
    )
    mp.write_text(manifest_patch, encoding="utf-8")

# Remove the manual folder-scan button in the native app.
html, removed = re.subn(r'\s*<button class="glass-btn" id="btn-scan-folder">.*?</button>', '', html, count=1, flags=re.S)
if removed != 1:
    raise SystemExit("Android folder-scan button not found")

# Android uses the native MediaStore library; remove the web file picker entirely.
html, removed = re.subn(r'\s*<label class="glass-btn">.*?id="file-input".*?</label>', '<input type="file" id="file-input" multiple accept="audio/*,video/*">', html, count=1, flags=re.S)
if removed != 1:
    raise SystemExit("Android file-picker control not found")
html = re.sub(r'\s*<div class="action-bar">\s*</div>', '', html, count=1)

# Resolve native MediaStore content URIs at playback time, not only during scanning.
html = html.replace(
    "  media.src=track.url;media.load();",
    """  const nativeSource=track.nativeUri ? (window.Capacitor?.convertFileSrc ? window.Capacitor.convertFileSrc(track.nativeUri) : track.nativeUri) : null;
  media.src=nativeSource || track.url;media.load();""",
    1
)

# Add a delete icon for the currently selected custom playlist.
create_button = '<button id="btn-create-playlist" title="ساخت پلی‌لیست" aria-label="ساخت پلی‌لیست"><i class="fas fa-plus"></i></button>'
delete_button = '<button id="btn-delete-playlist" title="حذف پلی‌لیست انتخاب‌شده" aria-label="حذف پلی‌لیست" hidden><i class="fas fa-trash-alt"></i></button>'
if 'id="btn-delete-playlist"' not in html:
    if create_button not in html:
        raise SystemExit("Create-playlist button not found")
    html = html.replace(create_button, create_button + delete_button, 1)

if '#btn-delete-playlist' not in html:
    anchor = '.playlist-tools button{'
    if anchor not in html:
        raise SystemExit("Playlist button CSS not found")
    html = html.replace(anchor, '.playlist-tools #btn-delete-playlist:not([hidden]){display:inline-flex;align-items:center;justify-content:center;color:#ff6b78}.playlist-tools button{', 1)

if 'async function deleteCustomPlaylist()' not in html:
    anchor = 'async function addTrackToActiveCollection(track) {'
    code = '''function updatePlaylistDeleteButton() {
  const button=$('btn-delete-playlist');
  if(button) button.hidden=!activeCollectionId.startsWith('playlist-');
}
async function deleteCustomPlaylist() {
  const id=activeCollectionId;
  const collection=collections.find(c=>c.id===id && c.id.startsWith('playlist-'));
  if(!collection) return;
  if(!confirm('پلی‌لیست «'+collection.name+'» حذف شود؟ آهنگ‌ها و فایل‌های اصلی حذف نمی‌شوند.')) return;
  try {
    const db=await openLibraryDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('collections','readwrite');
      tx.objectStore('collections').delete(id);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    });
    collections=collections.filter(c=>c.id!==id);
    activeCollectionId='all';
    const select=$('collection-select');
    select.innerHTML='<option value="all">همه آهنگ‌ها</option>'+collections.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.name)+'</option>').join('');
    select.value='all';
    updatePlaylistDeleteButton();
    renderPlaylist();
  } catch(error) {
    console.warn('Could not delete custom playlist:',error);
    alert('حذف پلی‌لیست انجام نشد. دوباره تلاش کنید.');
  }
}
'''
    if anchor not in html:
        raise SystemExit("Playlist insertion point not found")
    html = html.replace(anchor, code + anchor, 1)

html = html.replace(
    "select.value=activeCollectionId;\n  } catch(e) { console.warn('Could not load playlists',e); }",
    "select.value=activeCollectionId;\n    updatePlaylistDeleteButton();\n  } catch(e) { console.warn('Could not load playlists',e); }",
    1
)
html = html.replace("select.value=id; renderPlaylist();", "select.value=id; updatePlaylistDeleteButton(); renderPlaylist();", 1)
html = html.replace(
    "$('collection-select').addEventListener('change',e=>{activeCollectionId=e.target.value;renderPlaylist();});",
    "$('collection-select').addEventListener('change',e=>{activeCollectionId=e.target.value;updatePlaylistDeleteButton();renderPlaylist();});",
    1
)
html = html.replace(
    "$('btn-create-playlist').addEventListener('click',createCustomPlaylist);",
    "$('btn-create-playlist').addEventListener('click',createCustomPlaylist);\n$('btn-delete-playlist').addEventListener('click',deleteCustomPlaylist);",
    1
)

# Merge MediaStore snapshots through one path; the startup scan below guarantees
# the initial result even if the observer's first event arrives before JS is ready.
if 'function mergeNativeTracks(tracks)' not in html:
    anchor = 'async function restoreLibrary() {'
    code = '''function mergeNativeTracks(tracks) {
  if(!Array.isArray(tracks)) return;
  let added=0;
  const known=new Set(playlist.map(t=>t.id));
  for(const t of tracks) {
    if(!t || !t.id || known.has(t.id)) continue;
    const uri=t.uri || '';
    playlist.push({
      id:t.id,name:t.name||t.filename||'آهنگ',size:t.size||0,date:t.date||0,
      album:t.album||'حافظه دستگاه',artist:t.artist||'',duration:t.duration||0,
      url:uri,
      isVideo:false,nativeUri:uri
    });
    known.add(t.id); added++;
  }
  if(added) { sortPlaylist(); if(currentIndex===-1) loadTrack(0,false); }
}
'''
    if anchor not in html:
        raise SystemExit("restoreLibrary function not found")
    html = html.replace(anchor, code + anchor, 1)

old_listener = '''    const libraryResult = AuraNative.addListener('newAudioFiles', event => {
      try {
        let added=0; const known=new Set(playlist.map(t=>t.id));
        for(const t of (event?.tracks||[])) {
          if(known.has(t.id))continue;
          playlist.push({id:t.id,name:t.name||t.filename||'آهنگ',size:t.size||0,date:t.date||0,album:t.album||'حافظه دستگاه',artist:t.artist||'',duration:t.duration||0,url:window.Capacitor.convertFileSrc(t.uri),isVideo:false,nativeUri:t.uri});
          known.add(t.id); added++;
        }
        if(added){sortPlaylist();if(currentIndex===-1)loadTrack(0,false);}
      } catch(err) { console.debug('Automatic library update:',err); }
    });'''
new_listener = '''    const libraryResult = AuraNative.addListener('newAudioFiles', event => {
      try { mergeNativeTracks(event?.tracks || []); }
      catch(err) { console.debug('Automatic library update:',err); }
    });'''
if old_listener in html:
    html = html.replace(old_listener, new_listener, 1)
elif new_listener not in html:
    raise SystemExit("MediaStore listener not found")

old_start = '''// Native app: request library scan and start user-visible foreground monitor.
window.addEventListener('load',()=>{
  if(AuraNative && window.Capacitor?.isNativePlatform?.()) {
    AuraNative.startBackgroundScan().catch(e=>console.warn('Background scan service:',e));
    if(typeof AuraNative.startWatchingLibrary==='function') AuraNative.startWatchingLibrary().catch(e=>console.warn('MediaStore observer:',e));
  }
});'''
new_start = '''// Ask for audio access on first launch, register MediaStore observation, and
// explicitly load the initial snapshot so the first observer event cannot be missed.
window.addEventListener('load',async()=>{
  if(!(AuraNative && window.Capacitor?.isNativePlatform?.())) return;
  try {
    if(typeof AuraNative.startWatchingLibrary==='function') await AuraNative.startWatchingLibrary();
    if(typeof AuraNative.scanAudio==='function') {
      const response=await AuraNative.scanAudio();
      mergeNativeTracks(response?.tracks || []);
    }
  } catch(error) {
    console.warn('Android music permission/library scan:',error);
    alert('برای نمایش و افزودن خودکار آهنگ‌ها، اجازه دسترسی به موسیقی را فعال کنید.');
  }
});'''
if old_start in html:
    html = html.replace(old_start, new_start, 1)
elif new_start not in html:
    raise SystemExit("Native startup block not found")

# The button is removed above, so its old listener must be conditional.
html = html.replace(
    "scanFolderBtn.addEventListener('click',async()=>{",
    "if(scanFolderBtn) scanFolderBtn.addEventListener('click',async()=>{",
    1
)


# Preserve Android's transient tap activation: never await AudioContext.resume()
# before calling HTMLMediaElement.play(), or Android WebView may reject playback.
old_load = "  try{initAudioEngine();if(audioCtx&&audioCtx.state==='suspended')await audioCtx.resume();}catch(_){}"
new_load = "  try{initAudioEngine();}catch(error){console.warn('Audio engine initialization:',error);}"
if old_load in html:
    html = html.replace(old_load, new_load, 1)
elif new_load not in html:
    raise SystemExit("loadTrack audio initialization block not found")

old_play = """async function playTrack() {
  if(currentIndex<0||!playlist.length)return;
  const media=activeMedia();
  try{
    initAudioEngine();
    if(audioCtx&&audioCtx.state==='suspended')await audioCtx.resume();
    if(audioCtx&&activeSource!==(playlist[currentIndex].isVideo?audioSourceVideo:audioSourceAudio))connectChain(playlist[currentIndex].isVideo?audioSourceVideo:audioSourceAudio);
    await media.play();
    setPlayingUI(true);updateMediaSession();
  }catch(error){setPlayingUI(false);console.warn('پخش ناموفق بود:',error);if(error.name!=='NotAllowedError')alert('این فایل قابل پخش نیست یا فرمت آن پشتیبانی نمی‌شود.');}
}"""
new_play = """async function playTrack() {
  if(currentIndex<0||!playlist.length)return;
  const media=activeMedia();
  try{
    initAudioEngine();
    if(audioCtx&&activeSource!==(playlist[currentIndex].isVideo?audioSourceVideo:audioSourceAudio))connectChain(playlist[currentIndex].isVideo?audioSourceVideo:audioSourceAudio);
    // Start playback synchronously within the user's tap gesture.
    const playPromise=media.play();
    const resumePromise=audioCtx&&audioCtx.state==='suspended'?audioCtx.resume():Promise.resolve();
    await Promise.all([playPromise,resumePromise]);
    setPlayingUI(true);updateMediaSession();
  }catch(error){
    setPlayingUI(false);
    console.warn('پخش ناموفق بود:',error,'mediaError:',media.error,'source:',media.currentSrc);
    if(error.name!=='NotAllowedError')alert('پخش انجام نشد: '+(error.message||error.name||'خطای ناشناخته'));
  }
}"""
if old_play in html:
    html = html.replace(old_play, new_play, 1)
elif new_play not in html:
    raise SystemExit("playTrack function not found")

hp.write_text(html, encoding="utf-8")
jp.write_text(plugin, encoding="utf-8")
print("Android MediaStore and playlist patches applied.")
