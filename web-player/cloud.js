(() => {
  "use strict";
  const API_KEY="aurasound-cloud-api",TOKEN_KEY="aurasound-cloud-token",UPLOADS_KEY="aurasound-cloud-uploads";
  const $=id=>document.getElementById(id);
  const api=()=>String(localStorage.getItem(API_KEY)||"https://aurasound-cloud-api.m-siyahloo.workers.dev").replace(/\/+$/,"");
  const token=()=>localStorage.getItem(TOKEN_KEY)||"";
  const headers=()=>({Authorization:"Bearer "+token()});
  const bridge=()=>window.auraCloudBridge;
  const style=document.createElement("style");
  style.textContent="#aura-cloud-dialog{position:fixed;inset:0;z-index:10000;background:#020617ef;display:none;align-items:center;justify-content:center;padding:16px}#aura-cloud-dialog.open{display:flex}.aura-cloud-panel{width:min(100%,440px);max-height:90dvh;overflow:auto;background:#0b1220;border:1px solid var(--border,rgba(0,240,255,.3));border-radius:22px;padding:18px;color:#f8fafc;box-shadow:0 20px 70px #000b;direction:rtl}.aura-cloud-panel h2{font-size:1.05rem;color:var(--primary,#00f0ff);margin:0 0 8px}.aura-cloud-panel p{font-size:.78rem;color:#94a3b8;line-height:1.8;margin:0 0 12px}.aura-cloud-panel label{display:block;font-size:.76rem;color:#cbd5e1;margin:10px 0 5px}.aura-cloud-panel input{width:100%;padding:11px;border:1px solid #334155;border-radius:10px;background:#111827;color:white;outline:none;direction:ltr}.aura-cloud-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.aura-cloud-actions button,.aura-cloud-close{border:1px solid var(--border,rgba(0,240,255,.3));background:#ffffff0d;color:#f8fafc;border-radius:11px;padding:11px;font-weight:650;cursor:pointer}.aura-cloud-actions button.primary{background:var(--primary,#00f0ff);color:#001018}.aura-cloud-status{font-size:.76rem;line-height:1.8;color:#a5f3fc;min-height:28px;margin-top:12px;white-space:pre-wrap}.aura-cloud-user{font-size:.75rem;color:#86efac;margin-top:8px;direction:ltr;text-align:left;overflow-wrap:anywhere}.aura-cloud-divider{height:1px;background:#334155;margin:14px 0}";
  document.head.appendChild(style);
  const button=$("btn-cloud")||document.createElement("button");
  button.className="icon-btn";button.type="button";button.title="حافظه ابری";button.setAttribute("aria-label","حافظه ابری");
  button.innerHTML='<i class="fas fa-cloud"></i>';
  const nav=document.querySelector(".header-nav");if(nav&&!button.parentElement)nav.prepend(button);
  const modal=document.createElement("div");modal.id="aura-cloud-dialog";
  modal.innerHTML='<section class="aura-cloud-panel" role="dialog" aria-modal="true" aria-labelledby="aura-cloud-title"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h2 id="aura-cloud-title"><i class="fas fa-cloud"></i> حافظه ابری AuraSound</h2><button type="button" class="aura-cloud-close" id="aura-cloud-close">بستن</button></div><p>با ورود به حساب، تنظیمات و علاقه‌مندی‌ها را همگام کنید و فایل‌های موسیقی را به فضای ابری انتقال دهید. آپلود فقط با انتخاب شما انجام می‌شود.</p><label for="aura-cloud-api">نشانی سرویس ابری (Worker URL)</label><input id="aura-cloud-api" type="url" placeholder="https://your-worker.workers.dev" autocomplete="url"><label for="aura-cloud-email">ایمیل</label><input id="aura-cloud-email" type="email" autocomplete="email" placeholder="name@example.com"><label for="aura-cloud-password">رمز عبور (حداقل ۱۰ نویسه)</label><input id="aura-cloud-password" type="password" autocomplete="current-password" placeholder="••••••••••"><div class="aura-cloud-actions"><button type="button" class="primary" id="aura-cloud-login">ورود</button><button type="button" id="aura-cloud-register">ایجاد حساب</button></div><div class="aura-cloud-user" id="aura-cloud-user"></div><div class="aura-cloud-divider"></div><div class="aura-cloud-actions"><button type="button" id="aura-cloud-push">ارسال تنظیمات به ابر</button><button type="button" id="aura-cloud-pull">دریافت تنظیمات از ابر</button><button type="button" class="primary" id="aura-cloud-upload">آپلود آهنگ‌ها</button><button type="button" id="aura-cloud-download">دریافت آهنگ‌های ابری</button><button type="button" id="aura-cloud-dropbox-connect">اتصال Dropbox</button></div><div class="aura-cloud-actions"><button type="button" id="aura-cloud-logout">خروج از حساب</button></div><div class="aura-cloud-status" id="aura-cloud-status" aria-live="polite"></div></section>';
  document.body.appendChild(modal);
  const status=msg=>{$("aura-cloud-status").textContent=msg};
  const setBusy=busy=>document.querySelectorAll("#aura-cloud-dialog button").forEach(b=>b.disabled=busy);
  async function request(path,options={}) {
    if(!api())throw new Error("ابتدا نشانی Worker را وارد کنید.");
    const response=await fetch(api()+path,{...options,headers:{...(options.headers||{}),...(token()?headers():{})}});
    let data={};try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data.error||("خطای سرور: "+response.status));
    return data;
  }
  function localData() {
    const b=bridge();if(!b)throw new Error("رابط برنامه آماده نیست؛ صفحه را دوباره بارگذاری کنید.");
    return b.getCloudData();
  }
  async function account(path) {
    setBusy(true);
    try {
      localStorage.setItem(API_KEY,api());
      const result=await request(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("aura-cloud-email").value.trim(),password:$("aura-cloud-password").value})});
      localStorage.setItem(TOKEN_KEY,result.token);$("aura-cloud-user").textContent=result.user.email;status("ورود به حساب ابری موفق بود.");
    } catch(e){status(e.message)} finally{setBusy(false)}
  }
  async function syncPush() {
    setBusy(true);try{await request("/api/sync",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:localData()})});status("تنظیمات و علاقه‌مندی‌ها در فضای ابری ذخیره شد.");}catch(e){status(e.message)}finally{setBusy(false)}
  }
  async function syncPull() {
    setBusy(true);try{const result=await request("/api/sync");if(!result.data||!Object.keys(result.data).length){status("هنوز اطلاعاتی در حساب ابری ذخیره نشده است.");return;}bridge().applyCloudData(result.data);status("تنظیمات و علاقه‌مندی‌ها دریافت و اعمال شد.");}catch(e){status(e.message)}finally{setBusy(false)}
  }
  async function uploadTracks() {
    const b=bridge(),tracks=b?.getTracks?.()||[];
    if(!tracks.length){status("ابتدا آهنگ‌ها را به فهرست برنامه اضافه کنید.");return;}
    if(!confirm("آپلود "+tracks.length+" آهنگ به فضای ابری آغاز شود؟ فایل‌ها به حساب شما منتقل می‌شوند."))return;
    setBusy(true);let done=0,failed=0;
    try {
      const uploaded=JSON.parse(localStorage.getItem(UPLOADS_KEY)||"{}");
      const remote=await request("/api/tracks");
      const remoteKeys=new Set((remote.tracks||[]).map(t=>[t.name,t.size_bytes,t.last_modified].join("|")));
      for(const track of tracks) {
        const file=track.file;if(!file)continue;
        const key=[file.name,file.size,file.lastModified].join("|");
        if(uploaded[key]||remoteKeys.has(key)){uploaded[key]=uploaded[key]||"remote";continue;}
        try {
          const meta=await request("/api/tracks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,mimeType:file.type||"application/octet-stream",sizeBytes:file.size,lastModified:file.lastModified||0,album:track.album||"حافظه دستگاه"})});
          await request(meta.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});
          uploaded[key]=meta.id;done++;localStorage.setItem(UPLOADS_KEY,JSON.stringify(uploaded));status("آپلود: "+done+" / "+tracks.length);
        } catch(e){failed++;status("آپلود "+file.name+" ناموفق بود: "+e.message)}
      }
      status("پایان آپلود؛ موفق: "+done+"، ناموفق: "+failed+"، قبلاً آپلودشده: "+Object.keys(uploaded).length);
    } catch(e){status(e.message)}finally{setBusy(false)}
  }
  async function downloadTracks() {
    setBusy(true);let done=0,skipped=0;
    try {
      const result=await request("/api/tracks"),local=bridge().getTracks();
      for(const track of result.tracks||[]) {
        if(local.some(t=>t.file&&t.file.name===track.name&&t.file.size===track.size_bytes&&t.file.lastModified===track.last_modified)){skipped++;continue;}
        const response=await fetch(api()+"/api/tracks/"+track.id+"/content",{headers:headers()});
        if(!response.ok)throw new Error("دریافت "+track.name+" ناموفق بود.");
        const blob=await response.blob();
        const file=new File([blob],track.name,{type:track.mime_type||blob.type,lastModified:track.last_modified||Date.now()});
        await bridge().addCloudFile(file,track.album||"فضای ابری");done++;status("دریافت: "+done+" / "+result.tracks.length);
      }
      status("پایان دریافت؛ اضافه‌شده: "+done+"، تکراری: "+skipped);
    } catch(e){status(e.message)}finally{setBusy(false)}
  }
  button.addEventListener("click",async()=>{modal.classList.add("open");$("aura-cloud-api").value=api();$("aura-cloud-user").textContent=token()?"حساب واردشده (توکن ذخیره شده)":"وارد حساب نشده‌اید";if(token()){try{const d=await request("/api/dropbox/status");status(d.connected?"Dropbox متصل است.":"حساب Dropbox هنوز متصل نشده است.")}catch(e){status(e.message)}}});
  $("aura-cloud-close").onclick=()=>modal.classList.remove("open");
  modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
  $("aura-cloud-api").addEventListener("change",e=>localStorage.setItem(API_KEY,e.target.value.trim().replace(/\/+$/,"")));
  $("aura-cloud-login").onclick=()=>account("/api/auth/login");
  $("aura-cloud-dropbox-connect").onclick=async()=>{setBusy(true);try{const result=await request("/oauth/dropbox/start");if(!result.url)throw new Error("نشانی اتصال Dropbox دریافت نشد.");location.href=result.url;}catch(e){status(e.message)}finally{setBusy(false)}};
  $("aura-cloud-register").onclick=()=>account("/api/auth/register");
  $("aura-cloud-push").onclick=syncPush;$("aura-cloud-pull").onclick=syncPull;
  $("aura-cloud-upload").onclick=uploadTracks;$("aura-cloud-download").onclick=downloadTracks;
  $("aura-cloud-logout").onclick=()=>{localStorage.removeItem(TOKEN_KEY);$("aura-cloud-user").textContent="";status("از حساب خارج شدید.")};
})();