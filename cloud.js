(() => {
  "use strict";

  // Public client settings. Supabase publishable keys are intended for browser use.
  // Data protection is enforced by the Row Level Security policies in supabase/setup.sql.
  const SUPABASE_URL = "https://gdhhlbfsevoksbpgobpo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_sr3yg95h-a5bW6R2x41g4A_qn7Rn9FB";
  const TOKEN_KEY = "aurasound-supabase-session";
  const UPLOADS_KEY = "aurasound-supabase-uploads";
  const BUCKET = "aurasound-tracks";
  const $ = id => document.getElementById(id);
  const bridge = () => window.auraCloudBridge;
  const session = () => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); }
    catch (_) { return null; }
  };
  const accessToken = () => session()?.access_token || "";
  const authHeaders = () => ({
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + (accessToken() || SUPABASE_KEY)
  });

  const style = document.createElement("style");
  style.textContent = "#aura-cloud-dialog{position:fixed;inset:0;z-index:10000;background:#020617ef;display:none;align-items:center;justify-content:center;padding:16px}#aura-cloud-dialog.open{display:flex}.aura-cloud-panel{width:min(100%,440px);max-height:90dvh;overflow:auto;background:#0b1220;border:1px solid var(--border,rgba(0,240,255,.3));border-radius:22px;padding:18px;color:#f8fafc;box-shadow:0 20px 70px #000b;direction:rtl}.aura-cloud-panel h2{font-size:1.05rem;color:var(--primary,#00f0ff);margin:0 0 8px}.aura-cloud-panel p{font-size:.78rem;color:#94a3b8;line-height:1.8;margin:0 0 12px}.aura-cloud-panel label{display:block;font-size:.76rem;color:#cbd5e1;margin:10px 0 5px}.aura-cloud-panel input{width:100%;padding:11px;border:1px solid #334155;border-radius:10px;background:#111827;color:white;outline:none;direction:ltr}.aura-cloud-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.aura-cloud-actions button,.aura-cloud-close{border:1px solid var(--border,rgba(0,240,255,.3));background:#ffffff0d;color:#f8fafc;border-radius:11px;padding:11px;font-weight:650;cursor:pointer}.aura-cloud-actions button.primary{background:var(--primary,#00f0ff);color:#001018}.aura-cloud-actions button:disabled,.aura-cloud-close:disabled{opacity:.5}.aura-cloud-status{font-size:.76rem;line-height:1.8;color:#a5f3fc;min-height:28px;margin-top:12px;white-space:pre-wrap}.aura-cloud-user{font-size:.75rem;color:#86efac;margin-top:8px;direction:ltr;text-align:left;overflow-wrap:anywhere}.aura-cloud-divider{height:1px;background:#334155;margin:14px 0}";
  document.head.appendChild(style);

  const button = $("btn-cloud") || document.createElement("button");
  button.className = "icon-btn";
  button.type = "button";
  button.title = "حافظه ابری";
  button.setAttribute("aria-label", "حافظه ابری");
  button.innerHTML = '<i class="fas fa-cloud"></i>';
  const nav = document.querySelector(".header-nav");
  if (nav && !button.parentElement) nav.prepend(button);

  const modal = document.createElement("div");
  modal.id = "aura-cloud-dialog";
  modal.innerHTML = '<section class="aura-cloud-panel" role="dialog" aria-modal="true" aria-labelledby="aura-cloud-title"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h2 id="aura-cloud-title"><i class="fas fa-cloud"></i> حافظه ابری AuraSound</h2><button type="button" class="aura-cloud-close" id="aura-cloud-close">بستن</button></div><p>ورود و همگام‌سازی با حساب Supabase. پخش آهنگ‌های ذخیره‌شده روی گوشی بدون اینترنت هم کار می‌کند. آپلود آهنگ فقط با انتخاب شما انجام می‌شود.</p><div class="aura-cloud-user" id="aura-cloud-user"></div><label for="aura-cloud-email">ایمیل</label><input id="aura-cloud-email" type="email" autocomplete="email" placeholder="name@example.com"><label for="aura-cloud-password">رمز عبور (حداقل ۱۰ نویسه)</label><input id="aura-cloud-password" type="password" autocomplete="current-password" placeholder="••••••••••"><div class="aura-cloud-actions"><button type="button" class="primary" id="aura-cloud-login">ورود</button><button type="button" id="aura-cloud-register">ایجاد حساب</button></div><div class="aura-cloud-divider"></div><div class="aura-cloud-actions"><button type="button" id="aura-cloud-push">ارسال تنظیمات به ابر</button><button type="button" id="aura-cloud-pull">دریافت تنظیمات از ابر</button><button type="button" class="primary" id="aura-cloud-upload">آپلود آهنگ‌ها</button><button type="button" id="aura-cloud-download">دریافت آهنگ‌های ابری</button></div><div class="aura-cloud-actions"><button type="button" id="aura-cloud-logout">خروج از حساب</button></div><div class="aura-cloud-status" id="aura-cloud-status" aria-live="polite"></div></section>';
  document.body.appendChild(modal);

  const status = msg => { $("aura-cloud-status").textContent = msg; };
  const setBusy = busy => document.querySelectorAll("#aura-cloud-dialog button").forEach(b => { b.disabled = busy; });
  const endpoint = path => SUPABASE_URL + path;
  async function api(path, options = {}) {
    if (!path.startsWith("/auth/v1/")) await refreshSessionIfNeeded();
    const headers = { ...authHeaders(), ...(options.headers || {}) };
    const response = await fetch(endpoint(path), { ...options, headers });
    const type = response.headers.get("content-type") || "";
    let data = null;
    if (type.includes("json")) { try { data = await response.json(); } catch (_) {} }
    else if (!response.ok) { try { data = { message: await response.text() }; } catch (_) {} }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || ("خطای سرویس: " + response.status);
      throw new Error(message);
    }
    return data;
  }
  function requireLogin() {
    if (!accessToken()) throw new Error("ابتدا وارد حساب ابری شوید.");
    return session();
  }
  function localData() {
    if (!bridge()) throw new Error("رابط برنامه آماده نیست؛ صفحه را دوباره بارگذاری کنید.");
    return bridge().getCloudData();
  }
  function showUser() {
    const s = session();
    $("aura-cloud-user").textContent = s?.user?.email ? ("حساب: " + s.user.email) : "هنوز وارد حساب نشده‌اید.";
  }
  function saveSession(data) {
    if (data?.access_token) {
      if (!data.expires_at && data.expires_in) data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in);
      localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
      showUser();
    }
  }
  let refreshInFlight = null;
  async function refreshSessionIfNeeded() {
    const current = session();
    if (!current?.refresh_token || !current.expires_at || current.expires_at > Math.floor(Date.now() / 1000) + 90) return;
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const response = await fetch(endpoint("/auth/v1/token?grant_type=refresh_token"), {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.access_token) {
          localStorage.removeItem(TOKEN_KEY);
          showUser();
          throw new Error("نشست حساب منقضی شده است؛ دوباره وارد شوید.");
        }
        saveSession(data);
      })().finally(() => { refreshInFlight = null; });
    }
    await refreshInFlight;
  }
  async function account(mode) {
    const email = $("aura-cloud-email").value.trim().toLowerCase();
    const password = $("aura-cloud-password").value;
    if (!email) { status("لطفاً ایمیل را وارد کنید."); $("aura-cloud-email").focus(); return; }
    if (password.length < 10) { status("رمز عبور باید حداقل ۱۰ نویسه باشد."); $("aura-cloud-password").focus(); return; }
    setBusy(true);
    status(mode === "signup" ? "در حال ایجاد حساب..." : "در حال ورود...");
    try {
      const data = await api(mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (data?.access_token) {
        saveSession(data);
        status(mode === "signup" ? "حساب ساخته شد و ورود انجام شد." : "ورود موفق بود.");
      } else if (mode === "signup" && data?.user) {
        status("حساب ساخته شد. برای فعال‌سازی، ایمیل تأیید Supabase را باز کنید؛ سپس با همین ایمیل و رمز وارد شوید.");
      } else {
        status("پاسخ سرویس دریافت شد، اما نشست ورود ایجاد نشد. تنظیمات تأیید ایمیل را بررسی کنید.");
      }
    } catch (e) { status("ثبت‌نام یا ورود ناموفق بود: " + e.message); }
    finally { setBusy(false); }
  }

  async function syncPush() {
    setBusy(true);
    try {
      const s = requireLogin();
      const data = localData();
      const result = await api("/rest/v1/app_state?on_conflict=user_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: s.user.id, data, updated_at: new Date().toISOString() })
      });
      status("تنظیمات و فهرست پخش در حساب ابری ذخیره شد.");
    } catch (e) { status(e.message); }
    finally { setBusy(false); }
  }
  async function syncPull() {
    setBusy(true);
    try {
      requireLogin();
      const rows = await api("/rest/v1/app_state?select=data,updated_at&limit=1");
      if (!Array.isArray(rows) || !rows.length || !rows[0].data) {
        status("هنوز اطلاعاتی در حساب ابری ذخیره نشده است.");
        return;
      }
      bridge().applyCloudData(rows[0].data);
      status("تنظیمات دریافت و اعمال شد. برای بازیابی فایل‌های موسیقی، گزینه دریافت آهنگ‌های ابری را هم اجرا کنید.");
    } catch (e) { status(e.message); }
    finally { setBusy(false); }
  }
  async function uploadTracks() {
    setBusy(true);
    let done = 0, failed = 0;
    try {
      const s = requireLogin();
      const tracks = bridge()?.getTracks?.() || [];
      if (!tracks.length) { status("ابتدا آهنگ‌ها را به فهرست برنامه اضافه کنید."); return; }
      if (!confirm("آپلود " + tracks.length + " آهنگ به فضای ابری آغاز شود؟ فایل‌ها به حساب شما منتقل می‌شوند.")) return;
      const uploaded = JSON.parse(localStorage.getItem(UPLOADS_KEY) || "{}");
      const existing = await api("/rest/v1/tracks?select=name,size_bytes,last_modified");
      const remoteKeys = new Set((existing || []).map(t => [t.name, t.size_bytes, t.last_modified].join("|")));
      for (const track of tracks) {
        const file = track.file;
        if (!file) continue;
        const key = [file.name, file.size, file.lastModified].join("|");
        if (uploaded[key] || remoteKeys.has(key)) { uploaded[key] = uploaded[key] || "remote"; continue; }
        const id = crypto.randomUUID();
        const storagePath = s.user.id + "/" + id;
        try {
          await api("/storage/v1/object/" + BUCKET + "/" + storagePath.split("/").map(encodeURIComponent).join("/"), {
            method: "POST",
            headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
            body: file
          });
          await api("/rest/v1/tracks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({
              id, storage_path: storagePath, name: file.name,
              mime_type: file.type || "application/octet-stream",
              size_bytes: file.size, last_modified: file.lastModified || 0,
              album: track.album || "حافظه دستگاه"
            })
          });
          uploaded[key] = id;
          localStorage.setItem(UPLOADS_KEY, JSON.stringify(uploaded));
          done++;
          status("آپلود موفق: " + done + " آهنگ");
        } catch (e) {
          failed++;
          status("آپلود " + file.name + " ناموفق بود: " + e.message);
        }
      }
      status("پایان آپلود؛ موفق: " + done + "، ناموفق: " + failed);
    } catch (e) { status(e.message); }
    finally { setBusy(false); }
  }
  async function downloadTracks() {
    setBusy(true);
    let done = 0, skipped = 0;
    try {
      requireLogin();
      const remote = await api("/rest/v1/tracks?select=id,name,storage_path,mime_type,size_bytes,last_modified,album&order=created_at.desc");
      const local = bridge().getTracks();
      for (const track of remote || []) {
        if (local.some(t => t.file && t.file.name === track.name && t.file.size === track.size_bytes && t.file.lastModified === track.last_modified)) {
          skipped++;
          continue;
        }
        const path = track.storage_path.split("/").map(encodeURIComponent).join("/");
        const response = await fetch(endpoint("/storage/v1/object/authenticated/" + BUCKET + "/" + path), { headers: authHeaders() });
        if (!response.ok) throw new Error("دریافت " + track.name + " ناموفق بود (" + response.status + ").");
        const blob = await response.blob();
        const file = new File([blob], track.name, { type: track.mime_type || blob.type, lastModified: track.last_modified || Date.now() });
        await bridge().addCloudFile(file, track.album || "فضای ابری");
        done++;
        status("دریافت: " + done + " آهنگ");
      }
      status("پایان دریافت؛ اضافه‌شده: " + done + "، تکراری: " + skipped);
    } catch (e) { status(e.message); }
    finally { setBusy(false); }
  }

  button.addEventListener("click", () => {
    modal.classList.add("open");
    showUser();
    status(navigator.onLine ? "اتصال Supabase آماده است." : "اینترنت قطع است؛ پخش محلی همچنان در دسترس است.");
  });
  $("aura-cloud-close").onclick = () => modal.classList.remove("open");
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  $("aura-cloud-login").onclick = () => account("login");
  $("aura-cloud-register").onclick = () => account("signup");
  $("aura-cloud-push").onclick = syncPush;
  $("aura-cloud-pull").onclick = syncPull;
  $("aura-cloud-upload").onclick = uploadTracks;
  $("aura-cloud-download").onclick = downloadTracks;
  $("aura-cloud-logout").onclick = async () => {
    setBusy(true);
    try {
      if (accessToken()) {
        try { await api("/auth/v1/logout", { method: "POST" }); } catch (_) {}
      }
      localStorage.removeItem(TOKEN_KEY);
      showUser();
      status("از حساب خارج شدید. اطلاعات و آهنگ‌های محلی دستگاه حذف نمی‌شوند.");
    } finally { setBusy(false); }
  };
  showUser();
})();
