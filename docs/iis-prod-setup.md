# ตั้งค่า IIS บนเครื่อง production (192.168.20.5)

เป้าหมาย: หน้าเว็บเสิร์ฟผ่าน `https://qsc_website.mmm2007.net` ได้ปกติ แต่ backend API
เข้าถึงจากภายนอกโดยตรงไม่ได้ — ทุก request ต้องผ่าน IIS เท่านั้น

รันทุกคำสั่งใน **PowerShell ที่เปิดแบบ Run as Administrator** บนเครื่อง 192.168.20.5

---

## สภาพปัจจุบันที่ตรวจพบ (22 ก.ย. 2026)

| เรื่อง | สถานะ |
|---|---|
| หน้าเว็บ `https://qsc_website.mmm2007.net/` | ใช้งานได้ (HTTP 200, cert ถูกต้อง) |
| `/api/*` ผ่าน IIS | **ไม่ทำงาน** — ทุก path ตอบ `index.html` 1245 bytes เท่ากันหมด |
| `https://192.168.20.5:7076` เข้าจากนอก | เข้าถึงได้ แต่ `ERR_SSL_KEY_USAGE_INCOMPATIBLE` (dev cert) |
| Swagger / health ออก public | ไม่ออก — แต่เพราะ SPA fallback บังเอิญดักไว้ ไม่ใช่การป้องกันจริง |

วิธีที่ผมยืนยันว่า proxy ไม่ทำงาน:

```powershell
# ทุกอันได้ 1245 bytes เท่ากัน รวมถึง path ที่ไม่มีจริง = SPA fallback ตอบ ไม่ใช่ backend
curl.exe -sk -o NUL -w "%{http_code} %{content_type} %{size_download}`n" https://qsc_website.mmm2007.net/api/brands
curl.exe -sk -o NUL -w "%{http_code} %{content_type} %{size_download}`n" https://qsc_website.mmm2007.net/notexist-xyz
```

สาเหตุที่เป็นไปได้สูงสุด: **URL Rewrite / ARR ยังไม่ได้ติดตั้ง** ถ้า module ไม่มี IIS จะข้าม
บล็อก `<rewrite>` ใน web.config ไปเงียบ ๆ ไม่ขึ้น error ใด ๆ

---

## ลำดับบังคับ — ห้ามสลับ

ขั้น 1 ต้องเสร็จและทดสอบผ่านก่อนทำขั้น 2 เพราะขั้น 2 ตัดทางเข้า Kestrel จากภายนอก
ถ้า proxy ยังไม่ทำงานแล้วปิด Kestrel ก่อน เว็บจะใช้งานไม่ได้เลย

| ขั้น | ทำอะไร | เวลา |
|---|---|---|
| 1 | ทำให้ ARR proxy ใช้งานได้ | 15-20 นาที (มี restart IIS) |
| 2 | ให้ Kestrel ฟังแค่ loopback | 5 นาที |
| 3 | บล็อกพอร์ต 7076 ที่ firewall | 3 นาที |
| 4 | ปิด Swagger ที่ IIS | 5 นาที |
| 5 | ลบ CI/CD variable `FRONTEND_ENV_FILE` + re-deploy | 10 นาที |

---

## ขั้น 0 — ตรวจสถานะก่อนแตะอะไร

```powershell
powershell -ExecutionPolicy Bypass -File check-iis-prod.ps1
```

สคริปต์อ่านค่าเท่านั้น ไม่แก้อะไร ผลที่ต้องดู: หัวข้อ 1 บอกว่า URL Rewrite / ARR
`INSTALLED` หรือ `MISSING` — ตัวนี้ตัดสินว่าต้องทำขั้น 1.1 หรือข้ามได้

---

## ขั้น 1 — ทำให้ ARR proxy ใช้งานได้

### 1.1 ติดตั้ง URL Rewrite + ARR (ข้ามได้ถ้าขั้น 0 บอกว่า INSTALLED)

ดาวน์โหลดและติดตั้งตามลำดับนี้ (URL Rewrite ก่อน ARR):

1. URL Rewrite 2.1 — https://www.iis.net/downloads/microsoft/url-rewrite
2. Application Request Routing 3.0 — https://www.iis.net/downloads/microsoft/application-request-routing

หรือถ้ามี Chocolatey:

```powershell
choco install urlrewrite -y
choco install iis-arr -y
```

ติดตั้งเสร็จต้อง restart IIS:

```powershell
iisreset
```

ยืนยันว่า module มาแล้ว:

```powershell
Get-WebGlobalModule | Where-Object { $_.Name -match 'Rewrite|ApplicationRequestRouting' } |
    Select-Object Name | Format-Table -AutoSize
```

ต้องเห็นทั้ง `RewriteModule` และ `ApplicationRequestRouting`

### 1.2 เปิด proxy ใน ARR

ARR ติดตั้งมาแล้วแต่ proxy **ปิดอยู่โดยค่าเริ่มต้น** ต้องเปิดเอง:

```powershell
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' `
    -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True'
```

ยืนยัน (ต้องได้ `True`):

```powershell
(Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' `
    -Filter 'system.webServer/proxy' -Name 'enabled').Value
```

ถ้าคำสั่งแรก error ว่าไม่พบ section `system.webServer/proxy` แปลว่า ARR ยังไม่ได้ติดตั้งจริง
ให้กลับไปทำ 1.1

### 1.3 ตรวจว่า web.config ที่ปลายทางมี rule ครบ

ไฟล์ต้นทางคือ `frontend/public/web.config` ในโปรเจกต์ ซึ่ง vite ก๊อปลง `dist/` ตอน build
แล้ว CI robocopy ขึ้นเครื่อง

หา path จริงของเว็บไซต์:

```powershell
Import-Module WebAdministration
Get-Website | Select-Object Name, State, PhysicalPath | Format-Table -AutoSize
```

แล้วเปิดดู web.config ใน path นั้น ต้องมี rule ชื่อ `API proxy` มาก่อน `SPA fallback`:

```powershell
$site = 'E:\Production\QSC Service\frontend'   # เปลี่ยนตาม PhysicalPath จริง
([xml](Get-Content (Join-Path $site 'web.config') -Raw)).configuration.'system.webServer'.rewrite.rules.rule |
    Select-Object name, stopProcessing | Format-Table -AutoSize
```

ลำดับสำคัญ: `API proxy` มี `stopProcessing="true"` จึงต้องอยู่**บน** `SPA fallback`
ถ้าสลับกัน SPA fallback จะกิน `/api/*` ไปก่อน

### 1.4 ทดสอบว่า proxy ทำงานแล้ว

```powershell
# ต้องได้ HTTP 401 หรือ 400 และ content-type เป็น application/json
# ถ้าได้ text/html ขนาด ~1245 bytes = proxy ยังไม่ทำงาน
curl.exe -sk -X POST -H "Content-Type: application/json" `
    -d "{\"username\":\"probe\",\"password\":\"probe\"}" `
    -w "`nHTTP %{http_code} | %{content_type}`n" `
    https://qsc_website.mmm2007.net/api/auth/login
```

**เกณฑ์ผ่าน**: `content_type` ต้องเป็น `application/json` ไม่ใช่ `text/html`
ตัว HTTP code เป็น 400/401 ถือว่าใช้ได้ (แปลว่าถึง backend แล้ว แค่ credential ผิด)

ห้ามทำขั้น 2 จนกว่าขั้นนี้จะผ่าน

---

## ขั้น 2 — ให้ Kestrel ฟังแค่ loopback

ตอนนี้ backend ฟังทุก interface จึงเข้าจาก `192.168.20.5:7076` ได้ เปลี่ยนให้ฟังแค่
`127.0.0.1` — ARR อยู่เครื่องเดียวกันจึงยังเข้าถึงได้ และไม่ต้องใช้ cert เลย
(`ERR_SSL_KEY_USAGE_INCOMPATIBLE` หายไปด้วย เพราะ loopback คุยกันด้วย http)

หา path ของ backend แล้วแก้ `appsettings.json` เพิ่ม section `Kestrel`:

```jsonc
{
  // ... ค่าเดิมทั้งหมด เก็บไว้ ...
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://127.0.0.1:7076"
      }
    }
  }
}
```

**สำคัญ**: `appsettings.json` บนเครื่อง prod ถูก CI เขียนทับทุกครั้งที่ deploy
(จาก CI/CD variable `ENV_FILE` scope `production`) ดังนั้นต้องไปแก้ที่ variable นั้นด้วย
ไม่ใช่แก้แค่บนเครื่อง — ไม่งั้น deploy รอบหน้าค่าจะหายกลับไป

ถ้า backend รันเป็น IIS site แยก (ไม่ใช่ Windows Service หรือ console) ให้แก้ binding
ของ site นั้นแทน:

```powershell
Get-WebBinding -Name 'ชื่อ-site-ของ-backend' | Select-Object protocol, bindingInformation
# ถ้าเห็น *:7076: ให้เปลี่ยนเป็น 127.0.0.1:7076:
Set-WebBinding -Name 'ชื่อ-site-ของ-backend' -BindingInformation '*:7076:' `
    -PropertyName BindingInformation -Value '127.0.0.1:7076:'
```

restart แล้วทดสอบ:

```powershell
Restart-WebAppPool 'qsc-apppool'

# ต้องยังได้ 401/400 json (ARR ยังเข้าถึงได้)
curl.exe -sk -o NUL -w "via IIS: %{http_code} %{content_type}`n" `
    -X POST -H "Content-Type: application/json" -d "{}" `
    https://qsc_website.mmm2007.net/api/auth/login
```

จากเครื่องอื่นใน LAN (ไม่ใช่เครื่อง prod) ทดสอบว่าเข้าตรงไม่ได้แล้ว:

```powershell
# ต้อง timeout หรือ connection refused
curl.exe -sk --max-time 8 https://192.168.20.5:7076/api/brands
```

---

## ขั้น 3 — บล็อกพอร์ต 7076 ที่ firewall

กันชั้นที่สอง เผื่อมีใครแก้ config กลับ:

```powershell
# ลบ rule เดิมที่เปิดพอร์ตนี้ (ถ้ามี)
Get-NetFirewallRule -Enabled True -Direction Inbound |
    Where-Object { ($_ | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue).LocalPort -eq 7076 } |
    Select-Object DisplayName, Action, Profile | Format-Table -AutoSize

# เพิ่ม rule บล็อกขาเข้าจากภายนอก
New-NetFirewallRule -DisplayName "QSC API - block external 7076" `
    -Direction Inbound -Protocol TCP -LocalPort 7076 `
    -RemoteAddress Any -Action Block -Profile Any
```

loopback (`127.0.0.1`) ไม่ผ่าน Windows Firewall จึงไม่กระทบ ARR

---

## ขั้น 4 — ปิด Swagger / endpoint ที่ไม่ควรเปิด

ตอนนี้ Swagger ถูก SPA fallback บังไว้โดยบังเอิญ ถ้าวันหลังมีคนแก้ลำดับ rule
หรือเพิ่ม proxy path จะหลุดออก public ทันที ปิดให้ชัดเจนที่ IIS:

เพิ่มใน `web.config` ของ frontend **ก่อน** rule `API proxy`:

```xml
<rule name="Block swagger and diagnostics" stopProcessing="true">
  <match url="^(swagger|openapi|hangfire)(/.*)?$" />
  <action type="CustomResponse" statusCode="404"
          statusDescription="Not Found" subStatusCode="0" />
</rule>
```

แก้ที่ `frontend/public/web.config` ในโปรเจกต์ แล้ว deploy ใหม่ ไม่ใช่แก้บนเครื่องตรง ๆ
(robocopy รอบหน้าจะทับ)

ปิดที่ฝั่งโค้ดด้วยจะแน่นกว่า — `Program.cs:185` เรียก `app.UseSwaggerUI()` อยู่
ตรวจว่าอยู่ใน `if (app.Environment.IsDevelopment())` จริงหรือไม่ ถ้าไม่ ให้ครอบไว้

ทดสอบ:

```powershell
# ต้องได้ 404 ไม่ใช่ 200
curl.exe -sk -o NUL -w "%{http_code}`n" https://qsc_website.mmm2007.net/swagger
curl.exe -sk -o NUL -w "%{http_code}`n" https://qsc_website.mmm2007.net/openapi/v1.json
```

---

## ขั้น 5 — ลบ CI/CD variable ที่ทำให้ frontend ข้าม proxy

ต้นเหตุที่หน้าเว็บเรียก `https://localhost:7076` คือ CI/CD variable
`FRONTEND_ENV_FILE` scope `production` ซึ่งมีค่า `VITE_API_BASE_URL=https://localhost:7076`
ฝังลง bundle ตอน build

ตรวจได้จาก bundle ที่รันอยู่จริง:

```powershell
curl.exe -sk https://qsc_website.mmm2007.net/assets/index-B-OzTw0b.js |
    Select-String -Pattern 'localhost:7076' -SimpleMatch
```

แก้:

1. เปิด GitLab → Settings → CI/CD → Variables
2. ลบ `FRONTEND_ENV_FILE` **scope `production`** (scope `staging` เก็บไว้ถ้ายังใช้)
3. Cancel job ที่ค้างอยู่ (ถ้ามี)
4. Re-run pipeline — ต้อง build ใหม่ เพราะค่าถูก inline ตอน build ไม่ใช่ runtime

ผลหลังแก้: `frontend/src/config/api.js` จะ fallback ไปใช้ hostname ของหน้าเว็บเอง
(`https://qsc_website.mmm2007.net`) แล้วยิง `/api/...` เข้า ARR proxy ตามที่ตั้งไว้

ทำไมปล่อยว่างถูกต้อง: `api.js` คำนวณ `SERVER_BASE_URL` จาก `window.location` เมื่อ env ว่าง
และเพราะ URL ของหน้าเว็บไม่มีพอร์ต (`https://.../` ไม่ใช่ `:1234`) ตัวแปร
`defaultBackendPort` จึงเป็นค่าว่าง ไม่เติม `:5082` ต่อท้าย

---

## ตรวจครั้งสุดท้าย — ทำครบทุกข้อ

```powershell
Write-Host "--- 1. หน้าเว็บโหลดได้ (200 text/html) ---"
curl.exe -sk -o NUL -w "%{http_code} %{content_type}`n" https://qsc_website.mmm2007.net/

Write-Host "--- 2. API ผ่าน proxy (ต้องเป็น json ไม่ใช่ html) ---"
curl.exe -sk -o NUL -w "%{http_code} %{content_type}`n" -X POST `
    -H "Content-Type: application/json" -d "{}" `
    https://qsc_website.mmm2007.net/api/auth/login

Write-Host "--- 3. Swagger ปิด (ต้อง 404) ---"
curl.exe -sk -o NUL -w "%{http_code}`n" https://qsc_website.mmm2007.net/swagger

Write-Host "--- 4. bundle ไม่มี localhost หลงเหลือ (ต้องไม่มี output) ---"
$idx = (curl.exe -sk https://qsc_website.mmm2007.net/ | Select-String -Pattern 'assets/index-[A-Za-z0-9_-]+\.js').Matches.Value
curl.exe -sk "https://qsc_website.mmm2007.net/$idx" | Select-String 'localhost:7076' -SimpleMatch
```

ทดสอบข้อ 5 จาก**เครื่องอื่น** ไม่ใช่เครื่อง prod:

```powershell
Write-Host "--- 5. เข้า Kestrel ตรงไม่ได้ (ต้อง timeout/refused) ---"
curl.exe -sk --max-time 8 https://192.168.20.5:7076/api/brands
```

สุดท้าย เปิดเบราว์เซอร์จริงที่ `https://qsc_website.mmm2007.net` แล้ว login —
กด F12 ดูแท็บ Network ว่า request ไปที่ `qsc_website.mmm2007.net/api/...`
ไม่ใช่ `localhost:7076`

---

## จุดที่พลาดกันบ่อย

- **ติดตั้ง ARR แล้วแต่ลืมเปิด proxy** (ขั้น 1.2) — เป็นสาเหตุอันดับหนึ่ง ไม่มี error ใด ๆ
  request แค่ตกไป SPA fallback เฉย ๆ
- **แก้ web.config บนเครื่องตรง ๆ** — robocopy รอบหน้าทับหมด ต้องแก้ที่
  `frontend/public/web.config` ในโปรเจกต์
- **ปิด WebDAV แค่ฝั่ง frontend** — frontend กับ backend เป็นคนละ IIS site
  `<remove name="WebDAVModule" />` มีผลแค่ site ตัวเอง ถ้าปิดแค่ frontend แล้ว
  request PUT/DELETE จะผ่าน frontend ได้ แต่ไปตาย 405 ที่ backend site
  หลัง ARR rewrite แทน (อาการ: ทุก PUT ตอบ 405 ทั้งที่ controller มี `[HttpPut]`
  และ GET path เดียวกันใช้ได้) จึงต้องมี `backend/QSC.Api/web.config` ปิดซ้ำอีกชั้น —
  `dotnet publish` จะ merge `<aspNetCore>` handler เข้าไฟล์นี้ให้เอง ห้ามเขียน
  section นั้นเองเพราะ `processPath` อาจไม่ตรงกับ output จริง
- **แก้ appsettings.json บนเครื่องตรง ๆ** — CI เขียนทับจาก variable `ENV_FILE`
  ต้องแก้ที่ CI/CD variable
- **ลำดับ rule สลับ** — `API proxy` ต้องอยู่บน `SPA fallback` เพราะมี `stopProcessing="true"`
- **ARR proxy กับ `preserveHostHeader`** — ถ้า backend ตรวจ Host header แล้วพัง ให้ตั้ง
  `Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'preserveHostHeader' -Value 'True'`
  โปรเจกต์นี้มี `UseForwardedHeaders` (`Program.cs:157`) อยู่แล้วจึงมักไม่ต้องตั้ง
- **CORS** — ไม่ต้องแตะ เพราะผ่าน proxy แล้วเบราว์เซอร์เห็นเป็น same-origin
  policy `AllowReact` (`Program.cs:29`) ไม่ถูกเรียกใช้ในเส้นทางนี้

---

## ถ้าขั้น 1.4 ยังไม่ผ่าน

ไล่ทีละข้อ:

1. `Get-WebGlobalModule | ? Name -match 'Rewrite'` — ว่างแปลว่า URL Rewrite ไม่ได้ติดตั้ง
2. proxy enabled เป็น `False` — กลับไปขั้น 1.2
3. เปิด Failed Request Tracing ดูว่า rule ไหนจับ request:
   ```powershell
   # ดู log ล่าสุดของ site
   Get-ChildItem 'C:\inetpub\logs\FailedReqLogFiles' -Recurse -Filter '*.xml' |
       Sort-Object LastWriteTime -Descending | Select-Object -First 3 FullName
   ```
4. เช็คว่า backend ตอบที่ loopback จริง:
   ```powershell
   curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:7076/api/brands
   ```
   ถ้าอันนี้ไม่ตอบ ปัญหาอยู่ที่ backend ไม่ใช่ proxy
