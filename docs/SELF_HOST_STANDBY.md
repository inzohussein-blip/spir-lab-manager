# موقع احتياطي ثالث على جهازك أو على خادم مستأجر

موقع ثالث خلف العنوان الواحد نفسه (الـ Worker في [`NETLIFY_STANDBY.md`](NETLIFY_STANDBY.md)). يُجرَّب فقط إذا لم يُجب
Vercel ولا Netlify، فيبقى العميل على العنوان نفسه وعلى صفحته، وبيانات متصفحه كما هي.

```
      العميل يفتح دائماً:  https://spir-lab-manager.<اسمك>.workers.dev
                 │                    │                          │
          PRIMARY: Vercel     BACKUP: Netlify     BACKUP2: جهازك أو خادمك (هذا الدليل)
                 └────────────────────┴──────────┬───────────────┘
                              قاعدة البيانات الخارجية نفسها للثلاثة
```

- يعمل على **Windows أو macOS** (جهازك، بـ Docker Desktop)، أو **Linux** (خادم مستأجر، بـ Docker Engine).
- الملفات في `deploy/standby-server/`:
  - `docker-compose.yml`: التشغيل؛
  - `.env.example`: نموذج الإعدادات؛
  - `update.cmd` و`update.sh`: التشغيل والتحديث التلقائي.
- البيانات في القاعدة الخارجية، لا على جهازك. لذلك لا يضيع شيء إن توقف جهازك، ولا تختلف البيانات بين المواقع الثلاثة.

## ما تحتاجه
| | جهازك (Windows / macOS) | خادم مستأجر (Linux) |
|---|---|---|
| Docker | [Docker Desktop](https://www.docker.com/products/docker-desktop/)، وفعّل «Start Docker Desktop when you sign in» | `curl -fsSL https://get.docker.com \| sh` ثم `sudo usermod -aG docker $USER` وأعد الدخول |
| Git | [git-scm.com](https://git-scm.com) | `sudo apt install -y git` |
| الذاكرة | 4 GB أو أكثر | 2 GB على الأقل (البناء يحتاجها)، ويُفضَّل 4 GB |
| يبقى يعمل | لا يدخل الجهاز في وضع السكون، ولا يُطفأ | دائماً |
| عنوان على الإنترنت | Tailscale Funnel (مجاني)، انظر الخطوة 5 | Tailscale Funnel، أو Cloudflare Tunnel إن كان لك نطاق |

## الخطوة 1 — نسخ المشروع
في نافذة الأوامر (Windows: **cmd**؛ Linux / macOS: **Terminal**):
```
git clone https://github.com/inzohussein-blip/spir-lab-manager.git
cd spir-lab-manager/deploy/standby-server
```
إن كان المستودع خاصاً يطلب Git تسجيل الدخول إلى GitHub:
- على Windows تفتح نافذة الدخول وحدها.
- على الخادم استعمل **Fine-grained token** بصلاحية قراءة المحتوى (Contents: Read) لهذا المستودع فقط، من
  GitHub ← Settings ← Developer settings.

## الخطوة 2 — الإعدادات (`.env`)
1. انسخ `.env.example` إلى ملف اسمه `.env` في المجلد نفسه:
   - Windows: `copy .env.example .env`
   - Linux / macOS: `cp .env.example .env`
2. افتحه بمحرر نصوص، وضع **القيم نفسها التي في Vercel حرفياً**:
   - `DATABASE_URL` و`AUTH_SECRET`؛
   - و`NEXT_PUBLIC_BASE_URL` = عنوان الـ Worker.
3. والمتغيرات الأخرى الموجودة في Vercel: احذف `#` من أول سطرها وضع قيمتها.

⚠️ **كل متغير يبدأ بـ `NEXT_PUBLIC_` يجب أن يطابق Vercel وNetlify تماماً.** هذه المتغيرات تدخل في رقم الإصدار. أي اختلاف
يجعل المحطات ترى المواقع إصدارات مختلفة، فتعيد تنزيل التطبيق كلما تبدّل الموقع الذي يجيب.

ملف `.env` فيه أسرار: يبقى على هذا الجهاز وحده، وGit لا يرفعه.

## الخطوة 3 — التشغيل
- Windows: انقر نقرتين على `update.cmd`.
- Linux / macOS: `./update.sh`.

1. أول مرة يُبنى التطبيق، ويستغرق ذلك دقائق.
2. ثم افتح على الجهاز نفسه `http://localhost:3000/welcome`: يجب أن تظهر صفحة الترحيب.

المنفذ 3000 مفتوح لهذا الجهاز فقط. لا تفتحه في جدار الحماية، فالطريق من الإنترنت هو النفق في الخطوة 5.

## الخطوة 4 — التحديث التلقائي (مهم)
السكربت يأخذ آخر نسخة من `main`، ويعيد البناء فقط إذا تغيّرت. بهذا يبقى هذا الموقع على **إصدار Vercel وNetlify نفسه**.
شغّله كل 10 دقائق:
- **Windows:** افتح cmd في المجلد `deploy\standby-server`، ونفّذ مرة واحدة:
  ```
  schtasks /create /tn "SPIR standby update" /sc minute /mo 10 /tr "\"%CD%\update.cmd\""
  ```
- **Linux / macOS:** نفّذ `crontab -e` وأضف السطر (بالمسار الكامل للمجلد):
  ```
  */10 * * * * /home/USER/spir-lab-manager/deploy/standby-server/update.sh >> $HOME/standby-update.log 2>&1
  ```

بعد إعادة تشغيل الجهاز يعود التطبيق وحده (`restart: unless-stopped`)، ما دام Docker يبدأ مع الجهاز.

## الخطوة 5 — عنوان على الإنترنت
الـ Worker يحتاج عنواناً عاماً بـ https يصل إلى جهازك.

### الطريقة المجانية: Tailscale Funnel
تعمل من البيت ومن الخادم، بلا نطاق ولا فتح منافذ.
1. أنشئ حساباً مجانياً على [tailscale.com](https://tailscale.com)، ثبّت Tailscale على هذا الجهاز، وسجّل الدخول.
2. نفّذ:
   ```
   tailscale funnel --bg 3000
   ```
   - أول مرة يعطيك رابطاً لتفعيل Funnel في حسابك. افتحه وفعّله، ثم أعد الأمر.
   - على Linux نفّذه بـ `sudo`.
3. يظهر العنوان، مثل `https://my-pc.tail1234.ts.net`. افتحه من هاتفك للتأكد أنه يعرض صفحة الترحيب.

### إن كان لك نطاق على Cloudflare: Cloudflare Tunnel
1. Zero Trust ← Networks ← **Tunnels** ← Create a tunnel، وثبّت `cloudflared` بالأمر الذي يظهر لك.
2. في **Public Hostname** أضف عنواناً، مثل `standby.example.com` ← `http://localhost:3000`.

## الخطوة 6 — اربطه بالـ Worker
1. Cloudflare ← Worker `spir-lab-manager` ← **Settings ← Variables and Secrets** ← أضف `BACKUP2` = عنوان الخطوة 5.
2. كود الـ Worker يجب أن يكون الأحدث (`deploy/failover-worker/worker.mjs`)، لأنه هو الذي يعرف `BACKUP2`:
   - إن كان مربوطاً بـ GitHub فهو يُنشر مع كل دمج في `main`؛
   - وإلا فالصق الملف من جديد في **Edit code**.
3. افتح `https://spir-lab-manager.<اسمك>.workers.dev/__failover`: يجب أن يظهر `"ok": true` عند `backup2`.

## تجربة (مرة كل بضعة أشهر)
1. في الـ Worker غيّر `PRIMARY` و`BACKUP` مؤقتاً إلى `https://example.invalid`.
2. افتح العنوان الواحد: يعمل كل شيء، وفي أدوات المطوّر يظهر الترويس `x-served-by: backup2`.
3. ادخل لوحة الإدارة واحفظ شيئاً.
4. أعِد المتغيرين كما كانا.

## تنبيهات
- **قاعدة البيانات الواحدة** هي ما يجمع المواقع الثلاثة. إن توقفت هي نفسها لا يفيد أي موقع احتياطي. للمختبرات حينها
  النسخة المحلية في [`CONTINUITY.md`](CONTINUITY.md).
- **فترة التحديث:** بعد دمج تغيير في `main` قد يبقى هذا الموقع حتى 10 دقائق على الإصدار السابق. إن احتاجه الـ Worker في هذه
  الدقائق يعمل، لكن المحطات تعدّه إصداراً آخر.
- **عند تغيير متغير** في Vercel غيّره هنا في `.env` أيضاً، ثم نفّذ `docker compose up -d --build` في المجلد `deploy/standby-server`.
- **جهازك في البيت:** إن انقطعت الكهرباء أو الإنترنت عنه يتجاوزه الـ Worker. هو احتياطي ثالث، لا بديل عن الموقعين.
