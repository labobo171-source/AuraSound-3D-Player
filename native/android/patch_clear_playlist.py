#!/usr/bin/env python3
"""Apply the shared clear-playlist UI and behavior to the Android bundle's index.html."""
from pathlib import Path
import re

path = Path(__file__).resolve().parents[2] / "index.html"
html = path.read_text(encoding="utf-8")

heading_match = re.search(r'(<div class="playlist-heading"[^>]*>)(.*?)(</div>)', html, re.S)
if 'id="btn-clear-playlist"' not in html:
    if not heading_match:
        raise SystemExit("Could not find playlist heading in Android index.html")
    inner = heading_match.group(2)
    count_match = re.search(r'(<span id="track-count"[^>]*>.*?</span>)', inner, re.S)
    if count_match:
        inner = inner.replace(
            count_match.group(1),
            '<span class="playlist-heading-actions">' + count_match.group(1) + '<button class="clear-playlist-btn" id="btn-clear-playlist" type="button"><i class="fas fa-trash-alt"></i> پاک کردن فهرست</button></span>',
            1,
        )
    else:
        inner += '<button class="clear-playlist-btn" id="btn-clear-playlist" type="button"><i class="fas fa-trash-alt"></i> پاک کردن فهرست</button>'
    html = html[:heading_match.start()] + heading_match.group(1) + inner + heading_match.group(3) + html[heading_match.end():]

css_anchor = ".playlist-heading{"
if ".clear-playlist-btn{" not in html:
    if css_anchor not in html:
        raise SystemExit("Could not find playlist heading styles in Android index.html")
    html = html.replace(
        css_anchor,
        ".playlist-heading-actions{display:flex;align-items:center;gap:10px}.clear-playlist-btn{border:1px solid var(--border-glass);border-radius:9px;background:#ffffff08;color:var(--text-sub);padding:6px 9px;font-size:.68rem;cursor:pointer}.clear-playlist-btn:active{background:var(--primary);color:#000}.playlist-heading{",
        1,
    )

js_anchor = "async function saveDirectoryHandle(handle) {"
if "async function clearAllTracksFromLibrary()" not in html:
    if js_anchor not in html:
        raise SystemExit("Could not find library functions in Android index.html")
    clear_code = """async function clearAllTracksFromLibrary() {
  const db=await openLibraryDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('tracks','readwrite');
    tx.objectStore('tracks').clear();
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}
async function clearPlaylist() {
  if(!playlist.length)return;
  if(!confirm('همه آهنگ‌ها از فهرست داخل برنامه پاک شوند؟ فایل‌های اصلی گوشی و اطلاعات ابری حذف نمی‌شوند.'))return;
  try {
    await clearAllTracksFromLibrary();
    audioElement.pause();videoElement.pause();
    playlist.forEach(track=>{try{if(track.url)URL.revokeObjectURL(track.url);}catch(_){}});
    playlist=[];
    currentIndex=-1;
    audioElement.removeAttribute('src');videoElement.removeAttribute('src');
    audioElement.load();videoElement.load();
    titleEl.textContent='فایلی انتخاب نشده';
    artistEl.textContent='یک آهنگ یا پوشه انتخاب کنید';
    carTitle.textContent='فایلی انتخاب نشده';
    carArtist.textContent='یک آهنگ یا پوشه انتخاب کنید';
    progressFill.style.width='0%';
    currentTimeEl.textContent='00:00';durationEl.textContent='00:00';
    setPlayingUI(false);
    renderPlaylist();
    updateMediaSession();
  } catch(error) {
    console.error('Could not clear local playlist:',error);
    alert('پاک کردن فهرست انجام نشد. لطفاً دوباره تلاش کنید.');
  }
}
$('btn-clear-playlist').addEventListener('click',clearPlaylist);

"""
    html = html.replace(js_anchor, clear_code + js_anchor, 1)

path.write_text(html, encoding="utf-8")
