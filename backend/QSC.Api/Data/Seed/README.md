# Seed ข้อมูลตั้งต้นจากระบบ QSC เดิม

ข้อมูลธุรกิจของระบบใหม่ (แบรนด์ / สาขา / ฟอร์มตรวจ / ประวัติการตรวจ) สำหรับ 6 แบรนด์ —
After You, Mikka, Luggaw, Songwad Coffee, Someday, Sam Coffee Roasters — ดึงมาจากระบบ
QSC เดิมและ master DB ของแต่ละแบรนด์

## แบ่งหน้าที่กันอย่างไร

| ใคร | ดูแลอะไร |
|---|---|
| [`DatabaseSeeder.cs`](../DatabaseSeeder.cs) | **การตั้งค่าระบบ** — Roles, Permissions, RolePermissions, LocationTypes, บัญชี `admin` รันอัตโนมัติทุกครั้งที่แอปสตาร์ท เป็น idempotent |
| ไฟล์ `.sql` ในโฟลเดอร์นี้ | **ข้อมูลธุรกิจ** — Brands, Locations, SurveyForms, ประวัติการตรวจ รันมือตามลำดับด้านล่าง |

`DatabaseSeeder` ไม่ยุ่งกับข้อมูลธุรกิจเลย จึงสตาร์ทแอปกี่ครั้งก็ไม่ทับข้อมูลที่ seed ไว้

## ลำดับการรัน (ต้องรันตามนี้ ห้ามสลับ)

| ลำดับ | ไฟล์ | ทำอะไร | ขนาด |
|---|---|---|---|
| 1 | `seed-legacy-master.sql` | Brands (AU/MK/LG) + Locations 163 + ฟอร์มปัจจุบัน 9 | เล็ก |
| 2 | `seed-brand-split.sql` | แยกแบรนด์ SCR/SD/SAM ออกจากฟอร์ม `OP009` + สาขา 4 แห่ง | เล็ก |
| 3 | `seed-job-history-setup.sql` | ฟอร์มประวัติ 10 ฟอร์ม + ผู้ตรวจ 20 คน + สาขา LG1003 + staging table | เล็ก |
| 4 | bcp export/import (ดูด้านล่าง) | ย้าย `JobHead`/`JobDetail` ดิบเข้า staging table | ใหญ่ (516k แถว) |
| 5 | `seed-job-history-locations-extra.sql` | backfill สาขาปิดกิจการ 15 แห่งที่มีแต่ประวัติ | เล็ก |
| 6 | `seed-job-history-import.sql` | staging → `AuditRecords`/`AuditResponses` จริง | ใหญ่ (516k แถว) |
| 7 | `seed-reset-passwords.sql` | ตั้งรหัสผ่านเริ่มต้น `{username}@change` (BCrypt) | เล็ก |
| 8 | `seed-user-brandscope.sql` | จำกัดแบรนด์ที่แต่ละคนเห็น + เพิ่ม user ที่ตกหล่น | เล็ก |

ทุกไฟล์รองรับ `-v DryRun=1` (ทดสอบ, rollback) / `-v DryRun=0` (บันทึกจริง) แบบเดียวกันหมด —
**ต้องรัน DryRun ก่อน live เสมอ**

```powershell
sqlcmd -S 192.168.2.19,44881 -U qsc_sys -P <password> -d QSCDB -C -b -v DryRun=1 -i <ไฟล์>.sql
sqlcmd -S 192.168.2.19,44881 -U qsc_sys -P <password> -d QSCDB -C -b -v DryRun=0 -i <ไฟล์>.sql
```

### ขั้นที่ 4 โดยละเอียด — bcp

ต้องรันหลัง step 3 (staging table `stg_JobHead`/`stg_JobDetail` ถูกสร้างไว้แล้ว):

```powershell
$BCP = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\bcp.exe"

# export จากต้นทาง (native format -N รักษาภาษาไทยได้ถูกต้อง — ต้อง type ตรงกับ staging table เป๊ะ)
& $BCP "SELECT JobId, Branch_Code, As_code, CheckBy, latOn, lonOn, CheckOn, CheckOut, latColse, lonColse, managerName, empNum, Comment, criterion FROM PI_QSC.dbo.JobHead" queryout jobhead.dat -S 192.168.11.1,1319 -U claude_user -P <password> -N -d PI_QSC
& $BCP "SELECT JobId, Toppic_num, Subtoppic_no, IsCheck, IsNotCheck, comment, scoreGet, tsCode FROM PI_QSC.dbo.JobDetail" queryout jobdetail.dat -S 192.168.11.1,1319 -U claude_user -P <password> -N -d PI_QSC

# import เข้า staging table ปลายทาง
& $BCP QSCDB.dbo.stg_JobHead   in jobhead.dat   -S 192.168.2.19,44881 -U qsc_sys -P <password> -N
& $BCP QSCDB.dbo.stg_JobDetail in jobdetail.dat -S 192.168.2.19,44881 -U qsc_sys -P <password> -N -b 10000
```

**ทำไมใช้ bcp แทนการ generate `.sql` แบบตอน master data**: `JobDetail` มี 516,367+ แถว —
literal `INSERT VALUES` จะได้ไฟล์ใหญ่มากและช้า `bcp` native format โอนได้ ~100,000+ แถว/วินาที

**สำคัญ**: ต้องลบไฟล์ `.dat` หลังใช้เสร็จ (มีข้อมูลชื่อผู้จัดการสาขา/ความคิดเห็นจริง) —
อย่า commit เข้า git เด็ดขาด (`.gitignore` ควรมี `Data/Seed/*.dat`)

## เตรียมข้อมูลก่อนรัน (generate .sql)

```powershell
powershell -ExecutionPolicy Bypass -File Generate-LegacySeed.ps1          # -> seed-legacy-master.sql
powershell -ExecutionPolicy Bypass -File Generate-JobHistorySetup.ps1     # -> seed-job-history-setup.sql
```

ทั้งสองสคริปต์ "อ่านเท่านั้น" จากต้นทาง ไม่เขียนอะไรลงฐานข้อมูลใด ๆ
`seed-brand-split.sql`, `seed-job-history-locations-extra.sql`, `seed-job-history-import.sql`
เขียนด้วยมือ (ข้อมูลเล็กพอไม่ต้อง generate)

ต้นทาง:

| แบรนด์ | Server | Master DB (สาขา) | ฟอร์มตรวจ/ประวัติ |
|---|---|---|---|
| AU | `192.168.11.1,1319` | `AUDB.dbo.Site` | `PI_QSC` |
| LG | `192.168.11.1,1319` | `LGDB.dbo.Site` | `PI_QSC` |
| MK | `192.168.20.5,4488` | `MikkaDB.dbo.Site` | `PI_QSC` |
| SCR/SD/SAM | `192.168.11.1,1319` | `AUDB.dbo.Site` (สาขาย่อยของฟอร์ม OP009) | `PI_QSC` |

ผู้ตรวจในประวัติ (`JobHead.CheckBy`) resolve ผ่าน `AUDB.dbo.A_User` (คนละฐานกับ `PI_QSC.A_User`)

## การแปลงข้อมูล

### Master data (ดู `seed-legacy-master.sql`)

| ระบบใหม่ | ระบบเดิม |
|---|---|
| `Brands` | `PI_QSC.A_Company` (AU / MK / LG) |
| `Locations` | `dbo.Site` — กรอง `IsBranch=1 AND Isclosed=0 AND StateCode=1` + blocklist |
| `SurveyForms` | `Assessment` (`PassingScore = criterion × 100`) |
| `SurveySections` | `Toppic` (`WeightPercent = socreTotal / As_total × 100`) |
| `SurveyItems` | `SubToppic` (`FullScore = socre`, `QuestionType = YESNO`) |
| `SurveyFormTargetLocations` | `A_Branch_Assessment` |

หมวดหมู่ข้อคำถาม — `SubToppic.tsCode` / `JobDetail.tsCode` → `CategoryCode`:

| tsCode | CategoryCode | CategoryName |
|---|---|---|
| `C` | `CLN` | ความสะอาด |
| `DM` | `DOC` | เอกสาร |
| `PC` | `OPS` | กระบวนการทำงาน |
| `Q`, `PD` | `QLT` | คุณภาพสินค้า |
| `S` | `SVC` | การบริการ |

### แบรนด์ที่ซ่อนอยู่ใต้ฟอร์ม OP009 (ดู `seed-brand-split.sql`)

ฟอร์ม "ทรงวาดคอฟฟี่" (`OP009`) ในระบบเดิมถูกเก็บใต้ `Com_Code='AU'` เดียว แต่จริง ๆ ใช้ตรวจ
3 แบรนด์คนละกันที่แชร์ checklist เดียวกัน:

| สาขา | ชื่อจริง | แบรนด์ใหม่ |
|---|---|---|
| ASW | ทรงวาด | SCR (Songwad Coffee) |
| ASW2 | ท่าเตียน | SCR (กลุ่มเดียวกับทรงวาด) |
| ASD1 | Someday | SD (แยกเดี่ยว) |
| SAM1 | Sam Coffee Roasters | SAM (แยกเดี่ยว) |

ฟอร์ม `OP009` ผูกทั้ง 3 แบรนด์ผ่าน `SurveyFormBrands` (ไม่ใช้ `BrandId` เดี่ยวอีกต่อไป)

### ฟอร์มปัจจุบันที่ seed — เฉพาะที่มีสาขาผูกอยู่ใน `A_Branch_Assessment`

`OP003`, `OP004`, `OP006`, `OP008`, `OP009`, `IT0001`, `LG001`, `LG002`, `MK001`

### ประวัติการตรวจจริง (ดู `seed-job-history-*.sql`)

**ฟอร์มประวัติ 10 ฟอร์ม** (`LG001,LG002,OP001,OP002,OP003,OP004,OP005,OP006,OP008,OP009`)
สร้าง `SurveySections`/`SurveyItems` **จาก `JobDetail` เอง** ไม่ใช่จาก `Toppic`/`SubToppic` master —
เพราะโครงสร้างฟอร์มตอนตรวจจริงมีจำนวน/ลำดับข้อไม่ตรงกับ master ปัจจุบัน (เช่น `OP002` มี
350 ชุด `(Toppic_num, Subtoppic_no)` จริงในประวัติ แต่ master ปัจจุบันมีแค่ 124 ข้อ)

- ฟอร์มที่มีเวอร์ชันปัจจุบันอยู่แล้ว (`OP003,OP004,OP006,OP008,OP009,LG001,LG002`) → เพิ่มเป็น
  version ใหม่ใน `FormGroupId` เดียวกัน, `IsLatest=0`, `Version='legacy-history'`
- ฟอร์มที่ไม่มีเวอร์ชันปัจจุบัน (`OP001,OP002,OP005`) → สร้างฟอร์มเดี่ยว `IsActive=0`,
  Title = `"<As_code> (legacy-history)"`
- `FullScore` ต่อข้อ = `MAX(scoreGet WHERE IsCheck=1)`, fallback `MAX(scoreGet)` ถ้าไม่เคยผ่าน

**AuditRecords ← JobHead**, **AuditResponses ← JobDetail** — ดู mapping เต็มใน
`seed-job-history-import.sql` (มีคอมเมนต์กำกับทุกคอลัมน์)

**ผู้ตรวจ** — seed เฉพาะ 19 คนที่ปรากฏจริงใน `JobHead.CheckBy` (resolve ผ่าน `AUDB.A_User`)
+ 1 คน `legacy-import` สำหรับ GUID ที่หาไม่เจอ (228 งาน) — ไม่ import `A_User` ทั้งหมด

### รหัสผ่านเริ่มต้น (ดู `seed-reset-passwords.sql`)

ผู้ตรวจที่ seed มาจากประวัติได้ `PasswordHash` เป็น `NEWID()` (ยาว 36 ไม่ใช่ BCrypt) จึง
login ไม่ได้เลย ไฟล์นี้ตั้งรหัสเป็น `{username}@change` แบบ BCrypt work factor 11 ให้ตรงกับ
ที่ `AuthController.cs:63` ใช้ `BCrypt.Verify` และตรงกับรูปแบบของบัญชี `admin` เดิม

`MustChangePassword = 1` ทุกคน ระบบบังคับตั้งรหัสใหม่ตอน login ครั้งแรก — **ไม่แตะ `admin`**
(เป็นบัญชีเดียวที่ hash ใช้งานได้อยู่แล้ว ถ้ารีเซ็ตพร้อมกันแล้วพลาดจะไม่เหลือทางเข้าระบบ)

### ขอบเขตแบรนด์ของแต่ละคน (ดู `Generate-UserBrandScope.ps1`)

`AuthController.cs:89-105` อ่าน 2 ชั้น:

| `Users.BrandScope` | พฤติกรรม |
|---|---|
| `ALL` | เห็นทุกแบรนด์ — ไม่อ่าน `UserBrands` เลย |
| `SPECIFIC` | อ่าน `UserBrands` แล้วส่ง `allowedBrandIds` ให้ frontend |

**ตั้ง `SPECIFIC` แล้วไม่ใส่แถวใน `UserBrands` = เห็นศูนย์แบรนด์ ใช้งานไม่ได้** — สองอย่าง
ต้องทำใน transaction เดียว ซึ่ง `seed-user-brandscope.sql` จัดการให้แล้ว

แบรนด์ของแต่ละคน = **union ของ 2 แหล่ง** — สำคัญ ห้ามยึดแหล่งเดียว:

| แหล่ง | ความหมาย |
|---|---|
| `AuditRecords` → `LocationBrands` → `Brands` | แบรนด์ที่เคยตรวจจริง |
| `IsQSC = 1` ใน `A_User` ของแต่ละแบรนด์ | สิทธิ์ที่ระบบเดิมตั้งไว้ |

ทำไมต้อง union — **แต่ละแหล่งไม่ครบ**:

- `17302` (1,240 งาน) และ `18127` (1,049 งาน) เป็นผู้ตรวจที่ทำงานมากสุดในระบบ แต่
  **ไม่ติดธง `IsQSC` ที่ DB ไหนเลย** → ถ้ายึด `IsQSC` เดียว สองคนนี้จะไม่มีแบรนด์
- 12 คนติดธง `IsQSC` แต่ไม่เคยตรวจเลย → ถ้ายึดประวัติเดียว จะเสียสิทธิ์ที่ระบบเดิมให้ไว้

DB ต้นทางของธง `IsQSC` (ทุกตัวมีคอลัมน์นี้ ยกเว้น `PI_QSC`):

| Server | DB | แบรนด์ |
|---|---|---|
| `192.168.11.1,1319` | `AUDB` | AU |
| `192.168.11.1,1319` | `LGDB` | LG |
| `192.168.20.5,4488` | `MikkaDB` | MK |
| `192.168.20.5,4488` | `SCRDB` | SCR + SD + SAM (แชร์ checklist เดียว) |

**blocklist**: `A01`/`A02` ถูกตัดออกจากผลของ `MikkaDB` — ทั้งคู่เป็นบัญชี admin ของระบบเดิม
(`User_Name` = "IT Admin" / "Operation Admin") ธง `IsQSC` ที่นั่นเป็นสิทธิ์ผู้ดูแลระบบ ไม่ใช่
งานตรวจ MK จริง ทั้งคู่จึงได้ `AU` ตามประวัติตรวจจริงเท่านั้น (26 งาน) — แก้ได้ที่ตัวแปร
`$isQscBlocklist` ใน generator

ผลที่ได้: **user 31 คน / `UserBrands` 46 แถว** — AU 28 / LG 6 / SAM 4 / SCR 4 / SD 4
(ยังไม่นับ `test1`/`test2` ที่ generator ไม่แตะ)

`legacy-import` → `IsActive = 0` (ไม่มีคนใช้จริง) แต่คง `UserBrands = LG` ไว้ เพื่อให้รายงาน
ยังแสดงประวัติ 236 งานถูกต้อง

## ข้อจำกัดที่ต้องรู้

- **ไม่ seed รูปภาพ/ลายเซ็น** — `JobSubImg` (23,048 ไฟล์) เก็บเป็น path
  `assets/images/{สาขา}({เดือน-ปี})/...` แต่หา web server/file share ที่เก็บไฟล์จริงไม่เจอ
  (ลองทั้ง HTTP และ SMB) `AuditResponseImages` และ `AuditorSignatureUrl`/`AuditeeSignatureUrl`
  จึงว่างเปล่าทั้งหมด — ทำต่อได้เมื่อหาที่เก็บไฟล์จริงเจอ
- **พิกัด GPS ขาดหลายสาขา** — `Locations.Latitude/Longitude` เป็น `NOT NULL` สาขาที่ไม่มี
  พิกัดจะได้ `0,0` ใช้ฟีเจอร์ check-in ด้วย GPS กับสาขาเหล่านั้นไม่ได้จนกว่าจะเติมพิกัด
- **`AuditType` ทุกแถวเป็น `'spot'`** — ระบบเดิมไม่ได้แยกประเภทการตรวจ (announced/spot/undercover/followup)
- **ไม่มีผู้ตรวจคนใดเข้าถึงแบรนด์ MK ได้ นอกจาก `admin`** — MK มี 64 สาขาแต่ไม่มีประวัติ
  การตรวจในระบบเลย (`AuditRecords` = 0) และคนที่ติดธง `IsQSC` ที่ `MikkaDB` มีแค่ `A01`/`A02`
  ที่เป็นบัญชี admin ระบบเดิม (อยู่ใน blocklist) ถ้ามีคนรับผิดชอบ MK ต้องเพิ่ม `UserBrands`
  ให้คนนั้นผ่านหน้า admin หรือรัน seed เพิ่ม
- **`StaffCount` ไม่ได้ import** — คอลัมน์นี้ถูกลบออกจาก schema ระหว่างทำงาน (ดูหัวข้อถัดไป)
- ระบบเดิม (`PI_QSC`) ยังใช้งานจริงอยู่ (live production) — ข้อมูลที่ seed เป็น snapshot ณ
  ตอนรัน ไม่ใช่ sync ต่อเนื่อง ถ้าต้องการข้อมูลล่าสุดต้องรันใหม่ทั้งหมด
- `seed-legacy-master.sql` / `seed-job-history-setup.sql` เป็นไฟล์ generated — **อย่าแก้ด้วยมือ**
  ให้แก้ที่ `Generate-LegacySeed.ps1` / `Generate-JobHistorySetup.ps1` แล้ว generate ใหม่
- `IX_Brands_Code` / `IX_Permissions_Code` ยังไม่ unique — `DatabaseSeeder.DedupeLegacyDuplicates()`
  คอยรวมแถวซ้ำให้ แต่ทางแก้ถาวรคือเพิ่ม migration ทำ index ให้ unique

## ⚠️ DB dev นี้ใช้ร่วมกับคนอื่น — เช็คก่อน seed/cleanup ทุกครั้ง

`192.168.2.19,44881` (server ชื่อ `AUDEV`) ไม่ได้เป็น DB ส่วนตัว — เจอแล้วว่ามีเพื่อนร่วมทีม
(branch `2-feat-dev-2-19` / `qsc`) พัฒนาชี้มาที่เดียวกัน และรัน `dotnet ef database update`
ตรงจากเครื่องเขาเอง (migration `UpdateCapTasksAndSchema` — ลบคอลัมน์ `Locations.BrandName` และ
`AuditRecords.StaffCount` ออกไปแล้ว โดยที่ migration ไฟล์นั้นยังไม่ถูก commit เข้า git)

ผลที่ตามมา 2 อย่างที่ต้องระวัง:

1. **แบรนด์ demo (`UB/CL/AB/CS/QSCH`) อาจโผล่กลับมาได้ทุกเมื่อ** — เพราะ build ฝั่งเขายังมี
   demo-seed logic เดิมอยู่ (ก่อนที่เราจะตัดออกจาก `DatabaseSeeder.cs`) รันชน DB เดียวกัน
   **เช็คก่อนทำงานทุกครั้ง**: `SELECT Code FROM Brands WHERE Code IN ('UB','CL','AB','CS','QSCH')`
   ถ้าเจอ รันคำสั่งนี้ล้าง (ปลอดภัย รันซ้ำได้):
   ```powershell
   sqlcmd -S 192.168.2.19,44881 -U qsc_sys -P <password> -d QSCDB -C -b -v DryRun=0 -i cleanup-demo-brands.sql
   ```
2. **Schema อาจเปลี่ยนได้โดยไม่แจ้งล่วงหน้า** — ก่อนรันสคริปต์ seed ใหม่ ให้เช็ค
   `SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId DESC` ว่ามี migration
   ใหม่ที่เราไม่มีในเครื่องหรือไม่ ถ้ามี ให้ตรวจคอลัมน์ของตารางที่จะ insert ก่อนรัน:
   `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.<ตาราง>')`

## blocklist (master data)

ตัดแถวที่เป็น test / office / คลังสินค้า ที่ปนอยู่ใน `Site` master — แก้ได้ที่ตัวแปร
`$BlockCode` และ `$BlockName` ใน `Generate-LegacySeed.ps1`

ปัจจุบันตัด 16 แถว: `OF-*` (คลังสินค้า 6), `*TEST*` (3), `*TRAINING*` / `Traning` (3),
`Plateau1`, `SAMKITCHEN` (ครัวกลาง), `EVENT`, `M1002T`
