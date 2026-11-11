# AuraSound Cloud — راه‌اندازی

این سرویس برای حساب کاربری AuraSound، همگام‌سازی تنظیمات/علاقه‌مندی‌ها/پلی‌لیست‌ها و نگهداری فایل‌های موسیقی طراحی شده است.

## منابع Cloudflare موردنیاز
1. یک D1 database با نام `aurasound-cloud-db`
2. یک R2 bucket با نام `aurasound-music`
3. یک Worker با نام `aurasound-cloud`

**Worker پروژه AYDIN جداست و نباید برای این برنامه استفاده شود.** این سرویس از D1 و R2 مستقل استفاده می‌کند.

## ساخت دیتابیس و باکت
در Cloudflare Dashboard:
- Workers & Pages → D1 SQL Database → Create → نام `aurasound-cloud-db`
- Workers & Pages → R2 Object Storage → Create bucket → نام `aurasound-music`

سپس فایل `schema.sql` را در کنسول D1 اجرا کنید.

## اتصال Worker
در بخش Settings → Bindings:
- D1 binding: متغیر `DB`، دیتابیس `aurasound-cloud-db`
- R2 binding: متغیر `MUSIC`، باکت `aurasound-music`

در Variables and Secrets:
- Secret: `AUTH_SECRET`، یک مقدار تصادفی قوی حداقل ۳۲ نویسه
- Variable: `APP_ORIGIN` برابر با `https://labobo171-source.github.io`

فایل `wrangler.toml` نیز برای استقرار با Wrangler آماده شده است؛ مقدار `database_id` را با شناسه D1 جایگزین کنید.

## API
- `POST /api/auth/register` و `POST /api/auth/login`
- `GET /api/me`
- `GET/PUT /api/sync` برای داده‌های سبک برنامه
- `GET/POST /api/tracks`، سپس `PUT/GET/DELETE /api/tracks/:id/content` برای فایل‌ها

رمز عبور با PBKDF2 و توکن دسترسی با HMAC امضا می‌شود. توکن ۳۰ روز اعتبار دارد. فایل‌ها خصوصی و با کلید مبتنی بر شناسه کاربر در R2 نگهداری می‌شوند؛ هیچ باکت عمومی یا کلید مدیریتی در مرورگر قرار نمی‌گیرد.

## محدودیت فعلی این commit
این commit فقط backend و زیرساخت داده را آماده می‌کند. تا وقتی D1 و R2 در حساب Cloudflare ساخته و Worker مستقر نشود، API فعال نیست. بعد از مشخص‌شدن نشانی Worker، باید رابط ورود/ثبت‌نام و همگام‌سازی در رابط برنامه به آن متصل شود. فایل‌های محلی موجود نیز تا زمانی که کاربر وارد حساب نشود و آپلود را انتخاب نکند، خودکار به فضای ابری ارسال نمی‌شوند.

## حریم خصوصی و فایل‌ها
فایل‌های موسیقی متعلق به کاربر هستند. قبل از آپلود، کاربر باید انتخاب صریح داشته باشد. حذف حساب/پاک‌سازی کامل داده‌ها باید در نسخه بعدی API اضافه شود؛ در حال حاضر حذف فایل جداگانه پشتیبانی می‌شود.
