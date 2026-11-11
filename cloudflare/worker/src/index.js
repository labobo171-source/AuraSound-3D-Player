const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_TRACK_BYTES = 100 * 1024 * 1024;

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}
function b64url(bytes) {
  let s=""; for (const b of new Uint8Array(bytes)) s+=String.fromCharCode(b);
  return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function fromB64url(s) {
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
const enc = new TextEncoder();
const dec = new TextDecoder();
async function passwordHash(password,salt) {
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
  return b64url(bits);
}
async function sign(payload,secret) {
  const data=b64url(enc.encode(JSON.stringify(payload)));
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,enc.encode(data));
  return data+"."+b64url(sig);
}
async function verify(token,secret) {
  try {
    const [data,sig]=token.split(".");
    const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const ok=await crypto.subtle.verify("HMAC",key,fromB64url(sig),enc.encode(data));
    if(!ok)return null;
    const p=JSON.parse(dec.decode(fromB64url(data)));
    return p.exp>Date.now()/1000?p:null;
  } catch { return null; }
}
function cors(request,env) {
  const origin=request.headers.get("Origin")||"";
  const allowed=(env.APP_ORIGIN||"").split(",").map(s=>s.trim()).filter(Boolean);
  const headers={"access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"Authorization,Content-Type","access-control-max-age":"86400","vary":"Origin"};
  if(allowed.includes(origin))headers["access-control-allow-origin"]=origin;
  return headers;
}
async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}
async function auth(request,env) {
  const h=request.headers.get("Authorization")||"";
  if(!h.startsWith("Bearer "))return null;
  const p=await verify(h.slice(7),env.AUTH_SECRET);
  if(!p?.sub)return null;
  return p;
}
function safeName(name) {
  return String(name||"audio").replace(/[\/\r\n\0]/g,"_").slice(0,180);
}
async function handle(request,env) {
  if(!env.DB||!env.MUSIC)return json({error:"Cloud storage is not configured."},503);
  if(!env.AUTH_SECRET||env.AUTH_SECRET.length<32)return json({error:"Authentication secret is not configured."},503);
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
  if(request.method==="GET"&&path==="/api/health")return json({ok:true,service:"AuraSound Cloud",version:1});
  if(request.method==="POST"&&(path==="/api/auth/register"||path==="/api/auth/login")) {
    const input=await bodyJson(request);
    const email=String(input?.email||"").trim().toLowerCase();
    const password=String(input?.password||"");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"ایمیل معتبر وارد کنید."},400);
    if(password.length<10)return json({error:"رمز عبور باید حداقل ۱۰ نویسه باشد."},400);
    let user;
    if(path.endsWith("register")) {
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const hash=await passwordHash(password,salt);
      const id=crypto.randomUUID();
      try {
        await env.DB.prepare("INSERT INTO users (id,email,password_salt,password_hash,created_at) VALUES (?,?,?,?,?)").bind(id,email,b64url(salt),hash,Date.now()).run();
      } catch { return json({error:"این ایمیل قبلاً ثبت شده یا ثبت‌نام ممکن نیست."},409); }
      user={id,email};
    } else {
      const row=await env.DB.prepare("SELECT id,email,password_salt,password_hash FROM users WHERE email=?").bind(email).first();
      if(!row)return json({error:"ایمیل یا رمز عبور اشتباه است."},401);
      const hash=await passwordHash(password,fromB64url(row.password_salt));
      if(hash!==row.password_hash)return json({error:"ایمیل یا رمز عبور اشتباه است."},401);
      user={id:row.id,email:row.email};
    }
    const token=await sign({sub:user.id,email:user.email,exp:Math.floor(Date.now()/1000)+60*60*24*30},env.AUTH_SECRET);
    return json({token,user});
  }
  const user=await auth(request,env);
  if(!user)return json({error:"برای استفاده از فضای ابری وارد حساب شوید."},401);
  if(request.method==="GET"&&path==="/api/me")return json({user:{id:user.sub,email:user.email}});
  if(path==="/api/sync"&&request.method==="GET") {
    const row=await env.DB.prepare("SELECT data,updated_at FROM app_state WHERE user_id=?").bind(user.sub).first();
    return json({data:row?JSON.parse(row.data):{},updatedAt:row?.updated_at||null});
  }
  if(path==="/api/sync"&&request.method==="PUT") {
    const input=await bodyJson(request);
    if(!input||typeof input.data!=="object"||Array.isArray(input.data))return json({error:"داده همگام‌سازی معتبر نیست."},400);
    const serialized=JSON.stringify(input.data);
    if(serialized.length>250000)return json({error:"حجم تنظیمات و فهرست‌ها بیش از حد مجاز است."},413);
    const now=Date.now();
    await env.DB.prepare("INSERT INTO app_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(user.sub,serialized,now).run();
    return json({ok:true,updatedAt:now});
  }
  if(path==="/api/tracks"&&request.method==="GET") {
    const {results=[]}=await env.DB.prepare("SELECT id,name,mime_type,size_bytes,last_modified,album,created_at FROM tracks WHERE user_id=? ORDER BY created_at DESC").bind(user.sub).all();
    return json({tracks:results});
  }
  if(path==="/api/tracks"&&request.method==="POST") {
    const input=await bodyJson(request);
    const name=safeName(input?.name),mime=String(input?.mimeType||"application/octet-stream").slice(0,120),size=Number(input?.sizeBytes),lastModified=Number(input?.lastModified)||0,album=safeName(input?.album||"");
    if(!Number.isSafeInteger(size)||size<1||size>MAX_TRACK_BYTES)return json({error:"هر فایل باید حداکثر ۱۰۰ مگابایت باشد."},413);
    const id=crypto.randomUUID(),key=user.sub+"/"+id;
    await env.DB.prepare("INSERT INTO tracks (id,user_id,object_key,name,mime_type,size_bytes,last_modified,album,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,user.sub,key,name,mime,size,lastModified,album,Date.now()).run();
    return json({id,uploadUrl:"/api/tracks/"+id+"/content"},201);
  }
  const match=path.match(/^\/api\/tracks\/([0-9a-f-]{36})(?:\/content)?$/i);
  if(match) {
    const id=match[1],row=await env.DB.prepare("SELECT id,object_key,name,mime_type,size_bytes FROM tracks WHERE id=? AND user_id=?").bind(id,user.sub).first();
    if(!row)return json({error:"فایل پیدا نشد."},404);
    if(path.endsWith("/content")&&request.method==="PUT") {
      const length=Number(request.headers.get("Content-Length")||0);
      if(length&&length!==row.size_bytes)return json({error:"اندازه فایل با اطلاعات ثبت‌شده مطابقت ندارد."},400);
      if(length>MAX_TRACK_BYTES)return json({error:"حداکثر حجم فایل ۱۰۰ مگابایت است."},413);
      await env.MUSIC.put(row.object_key,request.body,{httpMetadata:{contentType:row.mime_type},customMetadata:{owner:user.sub,name:row.name}});
      return json({ok:true,id});
    }
    if(path.endsWith("/content")&&request.method==="GET") {
      const obj=await env.MUSIC.get(row.object_key);
      if(!obj)return json({error:"محتوای فایل موجود نیست."},404);
      return new Response(obj.body,{headers:{"content-type":row.mime_type,"content-length":String(obj.size),"content-disposition":'attachment; filename="audio-file"',"cache-control":"private, no-store"}});
    }
    if(request.method==="DELETE") {
      await env.MUSIC.delete(row.object_key);
      await env.DB.prepare("DELETE FROM tracks WHERE id=? AND user_id=?").bind(id,user.sub).run();
      return json({ok:true});
    }
  }
  return json({error:"مسیر درخواست پیدا نشد."},404);
}
export default {
  async fetch(request,env) {
    const headers=cors(request,env);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    try {
      const response=await handle(request,env);
      const merged=new Headers(response.headers);
      for(const [k,v] of Object.entries(headers))merged.set(k,v);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers:merged});
    } catch(error) {
      console.error("AuraSound Cloud error",error);
      return json({error:"خطای داخلی سرویس ابری."},500,headers);
    }
  }
};
