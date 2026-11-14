#!/usr/bin/env python3
"""Improve Android/PWA seeking and publish complete Android Media Session metadata."""
from pathlib import Path
import re

path = Path("index.html")
html = path.read_text(encoding="utf-8")

metadata = """navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name || 'AuraSound 3D',
        artist: track.artist || track.album || 'AuraSound 3D Player',
        album: track.album || 'AuraSound Playlist',
        artwork: [
          { src: new URL('./icons/icon-192.png', document.baseURI).href, sizes: '192x192', type: 'image/png' },
          { src: new URL('./icons/icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }
        ]
      });"""
html, count = re.subn(
    r"navigator\.mediaSession\.metadata\s*=\s*new MediaMetadata\(\{.*?\n\s*\}\);",
    metadata,
    html,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit("Could not locate Media Session metadata block")

pause_line = "        pause: () => { pauseTrack(); },"
if "stop: () => { pauseTrack(); }" not in html:
    if pause_line not in html:
        raise SystemExit("Could not locate Media Session pause handler")
    html = html.replace(pause_line, pause_line + "\n        stop: () => { pauseTrack(); },", 1)

seek_code = r"""function seekFromPointer(e){
  const media=activeMedia();
  if(!Number.isFinite(media.duration)||media.duration<=0)return;
  const rect=progressWrapper.getBoundingClientRect();
  if(!rect.width)return;
  const point=(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:((e.touches&&e.touches.length)?e.touches[0]:e);
  let clientX=Number(point.clientX);
  if(!Number.isFinite(clientX)&&Number.isFinite(point.offsetX))clientX=rect.left+point.offsetX;
  if(!Number.isFinite(clientX))return;
  const x=Math.max(0,Math.min(rect.width,clientX-rect.left));
  const ratio=x/rect.width;
  const target=ratio*media.duration;
  try{media.currentTime=target;}catch(error){console.warn("Seeking failed:",error);return;}
  progressFill.style.width=String(ratio*100)+"%";
  currentTimeEl.textContent=formatTime(target);
  progressWrapper.setAttribute("aria-valuenow",String(Math.round(ratio*100)));
  updateMediaSession();
}
progressWrapper.addEventListener("pointerdown",e=>{if(currentIndex<0)return;e.preventDefault();isDragging=true;try{progressWrapper.setPointerCapture(e.pointerId);}catch(_){}seekFromPointer(e);});
progressWrapper.addEventListener("pointermove",e=>{if(isDragging)seekFromPointer(e);});
function stopDragging(e){if(!isDragging)return;seekFromPointer(e);isDragging=false;}
progressWrapper.addEventListener("pointerup",stopDragging);
progressWrapper.addEventListener("pointercancel",e=>{if(isDragging)seekFromPointer(e);isDragging=false;});
/* Touch fallback for Android WebViews that do not deliver PointerEvents consistently. */
progressWrapper.addEventListener("touchstart",e=>{if(currentIndex<0)return;isDragging=true;seekFromPointer(e);},{passive:true});
progressWrapper.addEventListener("touchmove",e=>{if(isDragging)seekFromPointer(e);},{passive:true});
progressWrapper.addEventListener("touchend",e=>{if(isDragging)seekFromPointer(e);isDragging=false;},{passive:true});
/* Always handle click as a final fallback, including taps that only emit click. */
progressWrapper.addEventListener("click",e=>seekFromPointer(e));
progressWrapper.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();seekBy(e.key==="ArrowRight"?5:-5);}});
"""
html, count = re.subn(
    r"function seekFromPointer\(e\)\s*\{.*?progressWrapper\.addEventListener\([\"\']keydown[\"\'],e=>\{.*?\}\);\s*",
    seek_code + "\n",
    html,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit("Could not locate progress-bar pointer handlers")

# Bridge the browser player state into the native Android MediaSession.
# The Android plugin exposes updateCarMediaSession and emits mediaControl events.
native_sync = r"""let nativeSessionTrackId = null;
let nativeSessionPlaying = null;
let nativeSessionPosition = 0;
let nativeSessionUpdatedAt = 0;
function syncNativeMediaSession(track, media){
  const plugin=window.Capacitor?.Plugins?.AuraNative;
  if(!track||!plugin||!window.Capacitor?.isNativePlatform?.()||typeof plugin.updateCarMediaSession!=="function")return;
  const playing=!!(media&&!media.paused&&!media.ended);
  const position=Math.max(0,Number(media&&media.currentTime)||0);
  const duration=Number.isFinite(media&&media.duration)&&media.duration>0?media.duration:(Number(track.duration)||0)/1000;
  const now=Date.now();
  const changed=track.id!==nativeSessionTrackId||playing!==nativeSessionPlaying||Math.abs(position-nativeSessionPosition)>2.5;
  if(!changed&&now-nativeSessionUpdatedAt<1000)return;
  nativeSessionTrackId=track.id; nativeSessionPlaying=playing; nativeSessionPosition=position; nativeSessionUpdatedAt=now;
  try{
    const result=plugin.updateCarMediaSession({title:track.name||"AuraSound 3D",artist:track.artist||track.album||"AuraSound 3D Player",playing:playing,position:Math.round(position*1000),duration:Math.round(Math.max(0,duration)*1000),artworkUri:track.nativeUri||""});
    if(result&&typeof result.catch==="function")result.catch(error=>console.debug("Native MediaSession update:",error));
  }catch(error){console.debug("Native MediaSession unavailable:",error);}
}
"""
if "function syncNativeMediaSession(track, media)" not in html:
    anchor = "function updateMediaSession() {"
    if anchor not in html: raise SystemExit("Media Session update function not found for native bridge")
    html = html.replace(anchor, native_sync + "\n" + anchor, 1)
call_anchor = "function updateMediaSession() {"
call_line = "  try { syncNativeMediaSession(playlist[currentIndex], activeMedia()); } catch (_) {}"
if call_line not in html:
    if call_anchor not in html: raise SystemExit("Media Session update function not found for native bridge")
    html = html.replace(call_anchor, call_anchor + "\\n" + call_line, 1)

path.write_text(html, encoding="utf-8")
print("Seeking and Android Media Session metadata patched.")
