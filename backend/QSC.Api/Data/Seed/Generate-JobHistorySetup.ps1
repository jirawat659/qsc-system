<#
  Generate-JobHistorySetup.ps1
  -----------------------------
  ขั้นเตรียมข้อมูล (ส่วนที่เล็ก) ก่อน import ประวัติการตรวจจริงจาก JobHead/JobDetail
  สคริปต์นี้ "อ่านเท่านั้น" จากต้นทาง ไม่เขียนอะไรลง DB ใด ๆ

  Generate ไฟล์ seed-job-history-setup.sql ซึ่งจะสร้าง:
    - ฟอร์มประวัติ (historical snapshot) 10 ฟอร์ม พร้อม Sections/Items
      ที่สร้างจาก JobDetail เอง (ไม่ใช่ Toppic/SubToppic master) เพราะ
      โครงสร้างจริงตอนตรวจไม่ตรงกับ master ปัจจุบัน 100%
    - ผู้ตรวจในประวัติ (19 คนที่หาชื่อได้ผ่าน AUDB.A_User + 1 คน legacy-import)
    - สาขา LG1003 (ปิดแล้วแต่มีประวัติ)
    - Staging table (#... ระดับ session ไม่พอ ต้องเป็น physical table เพราะ
      ใช้ข้าม step กับ bcp) สำหรับ bcp ใส่ JobHead/JobDetail ใน step ถัดไป

  ใช้งาน
    powershell -ExecutionPolicy Bypass -File Generate-JobHistorySetup.ps1
#>
[CmdletBinding()]
param(
    [string]$OutFile,
    [string]$AuServer = '192.168.11.1,1319',
    [string]$SqlUser  = 'claude_user',
    [Parameter(Mandatory=$true)][string]$SqlPass
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($OutFile)) { $OutFile = Join-Path $scriptDir 'seed-job-history-setup.sql' }

function Invoke-Read([string]$server, [string]$db, [string]$sql) {
    $conn = New-Object System.Data.SqlClient.SqlConnection "Server=$server;Database=$db;User Id=$SqlUser;Password=$SqlPass;TrustServerCertificate=True;Connect Timeout=30"
    try {
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.CommandTimeout = 300
        $table = New-Object System.Data.DataTable
        $table.Load($cmd.ExecuteReader())
        return ,@($table.Rows)
    } finally { $conn.Dispose() }
}

function Q([object]$v) {
    if ($null -eq $v -or $v -is [System.DBNull]) { return 'NULL' }
    return "N'" + ([string]$v).Replace("'", "''") + "'"
}
function Num([object]$v, [double]$fallback = 0) {
    if ($null -eq $v -or $v -is [System.DBNull]) { return $fallback }
    return [double]$v
}
function Write-ValuesBatched($writer, [string]$header, [string[]]$rows, [int]$batch = 400) {
    if ($rows.Count -eq 0) { return }
    for ($i = 0; $i -lt $rows.Count; $i += $batch) {
        $slice = $rows[$i..([Math]::Min($i + $batch - 1, $rows.Count - 1))]
        $writer.AppendLine($header) | Out-Null
        $writer.AppendLine(($slice -join ",`r`n") + ';') | Out-Null
    }
}

$FormCodes = @('LG001','LG002','OP001','OP002','OP003','OP004','OP005','OP006','OP008','OP009')
$codeList = ($FormCodes | ForEach-Object { "'$_'" }) -join ','

# แบบฟอร์มที่มีเวอร์ชัน "ปัจจุบัน" อยู่แล้ว -> ใช้ Title เดียวกันเพื่อ join กับ SurveyForms ที่ seed ไว้แล้ว
$LiveTitle = @{
    'OP003' = 'Operation Excellence  (กันยายน 2569)'
    'OP004' = 'Operation Excellence(EV. / Catering)'
    'OP006' = 'Booth, Mini Shop'
    'OP008' = 'AMJ.(Cashless Store)'
    'OP009' = 'ทรงวาดคอฟฟี่'
    'LG001' = 'ลูกก๊อ Cashless Store'
    'LG002' = 'ลูกก๊อ Cash Store'
}
# As_code -> BrandCode (สำหรับฟอร์มที่ไม่มีเวอร์ชันปัจจุบัน OP001/OP002/OP005 ต้องผูกแบรนด์เอง)
$BrandOfCode = @{ 'OP001'='AU'; 'OP002'='AU'; 'OP005'='AU' }

$CatMap = @{
    'C'  = @('CLN', 'ความสะอาด')
    'DM' = @('DOC', 'เอกสาร')
    'PC' = @('OPS', 'กระบวนการทำงาน')
    'Q'  = @('QLT', 'คุณภาพสินค้า')
    'PD' = @('QLT', 'คุณภาพสินค้า')
    'S'  = @('SVC', 'การบริการ')
}

Write-Host '== 1. อ่านโครงสร้างฟอร์มประวัติจาก JobDetail (ไม่ใช่ master) ==' -ForegroundColor Cyan

$sectionSql = @"
WITH ranked AS (
  SELECT h.As_code, d.Toppic_num, d.Toppic_name,
         ROW_NUMBER() OVER (PARTITION BY h.As_code, d.Toppic_num ORDER BY h.CheckOn DESC) rn
  FROM JobDetail d JOIN JobHead h ON h.JobId = d.JobId
  WHERE h.As_code IN ($codeList) AND d.Toppic_num IS NOT NULL
)
SELECT As_code, Toppic_num, Toppic_name FROM ranked WHERE rn = 1 ORDER BY As_code, Toppic_num
"@
$sections = Invoke-Read $AuServer 'PI_QSC' $sectionSql

$itemSql = @"
WITH ranked AS (
  SELECT h.As_code, d.Toppic_num, d.Subtoppic_no, d.Subtoppic_name, d.tsCode,
         ROW_NUMBER() OVER (PARTITION BY h.As_code, d.Toppic_num, d.Subtoppic_no ORDER BY h.CheckOn DESC) rn
  FROM JobDetail d JOIN JobHead h ON h.JobId = d.JobId
  WHERE h.As_code IN ($codeList) AND d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
)
SELECT As_code, Toppic_num, Subtoppic_no, Subtoppic_name, tsCode FROM ranked WHERE rn = 1
"@
$items = Invoke-Read $AuServer 'PI_QSC' $itemSql

# FullScore ต่อข้อ = ค่า scoreGet ที่พบบ่อยที่สุดของข้อนั้น (ไม่นับแถว N/A) เสมอกัน → ค่าที่ใช้ล่าสุด
# scoreGet ของระบบเดิมคือ "คะแนนของข้อ ณ วันตรวจ" และระบบเดิมเคยปรับคะแนนของข้อเดิมหลายรอบ
# (เช่น OP006 ข้อ 1.3: 1 → 5 → 3 → 2) — เดิมใช้ MAX ทำให้คะแนนเต็มเกินจริงเกือบทุกงาน
# ค่าที่พบบ่อยสุดตรง ~93.65% ของคำตอบทั้งหมด (ระบบใหม่เก็บคะแนนเต็มได้ค่าเดียวต่อข้อ)
# ส่วนคะแนนรวมของงานคิดจาก scoreGet ตรงๆ ใน seed-job-history-import.sql จึงตรงระบบเดิม 100%
# ต้องตรงกับขั้น 5 ของ fix-job-history-scores.sql
$scoreSql = @"
WITH c AS (
  SELECT h.As_code, d.Toppic_num, d.Subtoppic_no, d.scoreGet,
         COUNT(*) AS cnt, MAX(COALESCE(h.CheckOn, h.CheckOut)) AS lastUsed
  FROM JobDetail d JOIN JobHead h ON h.JobId = d.JobId
  WHERE h.As_code IN ($codeList) AND d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
    AND d.scoreGet IS NOT NULL
    AND NOT (ISNULL(d.IsCheck, 0) = 0 AND ISNULL(d.IsNotCheck, 0) = 0)
  GROUP BY h.As_code, d.Toppic_num, d.Subtoppic_no, d.scoreGet
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY As_code, Toppic_num, Subtoppic_no
                               ORDER BY cnt DESC, lastUsed DESC) AS rn
  FROM c
), anyScore AS (
  SELECT h.As_code, d.Toppic_num, d.Subtoppic_no, MAX(d.scoreGet) AS scoreAny
  FROM JobDetail d JOIN JobHead h ON h.JobId = d.JobId
  WHERE h.As_code IN ($codeList) AND d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
  GROUP BY h.As_code, d.Toppic_num, d.Subtoppic_no
)
SELECT a.As_code, a.Toppic_num, a.Subtoppic_no, r.scoreGet AS scoreMode, a.scoreAny
FROM anyScore a
LEFT JOIN ranked r ON r.As_code = a.As_code AND r.Toppic_num = a.Toppic_num
                  AND r.Subtoppic_no = a.Subtoppic_no AND r.rn = 1
"@
$scores = Invoke-Read $AuServer 'PI_QSC' $scoreSql
$scoreMap = @{}
foreach ($s in $scores) {
    $k = "$($s['As_code'])|$($s['Toppic_num'])|$($s['Subtoppic_no'])"
    # scoreAny ใช้เฉพาะข้อที่มีแต่แถว N/A ตลอดประวัติ (ไม่มีค่าที่พบบ่อยสุดให้เลือก)
    $v = if ($s['scoreMode'] -isnot [System.DBNull]) { [double]$s['scoreMode'] }
         elseif ($s['scoreAny'] -isnot [System.DBNull]) { [double]$s['scoreAny'] }
         else { 1.0 }
    $scoreMap[$k] = $v
}

Write-Host ("   sections={0}  items={1}" -f $sections.Count, $items.Count)

Write-Host ''
Write-Host '== 2. resolve ผู้ตรวจจริง (CheckBy -> AUDB.A_User) ==' -ForegroundColor Cyan
$auditors = Invoke-Read $AuServer 'master' @"
SELECT CAST(j.CheckBy AS varchar(50)) AS CheckBy, u.LOGON_NAME, u.User_Name, COUNT(*) AS n
FROM PI_QSC.dbo.JobHead j
LEFT JOIN AUDB.dbo.A_User u ON u.A_USER_ID = j.CheckBy
GROUP BY CAST(j.CheckBy AS varchar(50)), u.LOGON_NAME, u.User_Name
ORDER BY n DESC
"@
$resolvedAuditors = @($auditors | Where-Object { $_['LOGON_NAME'] -isnot [System.DBNull] -and [string]$_['LOGON_NAME'] -ne '' })
Write-Host ("   ผู้ตรวจที่หาชื่อได้ {0} คน (จากทั้งหมด {1} คน)" -f $resolvedAuditors.Count, $auditors.Count)

Write-Host ''
Write-Host '== 3. เช็คสาขา LG1003 (ปิดแล้วแต่มีประวัติ) ==' -ForegroundColor Cyan
$lg1003 = Invoke-Read $AuServer 'LGDB' "SELECT Site, Name FROM Site WHERE Site = 'LG1003'"
$lg1003Name = if ($lg1003.Count -gt 0) { [string]$lg1003[0]['Name'] } else { 'LG1003' }
Write-Host ("   LG1003 = {0}" -f $lg1003Name)

# ---------------------------------------------------------------- emit SQL

Write-Host ''
Write-Host '== 4. เขียนไฟล์ .sql ==' -ForegroundColor Cyan

$sb = New-Object System.Text.StringBuilder
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$hdr = @"
/* =============================================================================
   seed-job-history-setup.sql   (GENERATED - ห้ามแก้ด้วยมือ)
   สร้างโดย Generate-JobHistorySetup.ps1 เมื่อ $stamp

   เตรียมข้อมูลก่อน import ประวัติการตรวจจริง (ส่วนที่มีขนาดเล็ก):
     - ฟอร์มประวัติ 10 ฟอร์ม + Sections/Items (สร้างจาก JobDetail เอง)
     - ผู้ตรวจในประวัติ ($($resolvedAuditors.Count) คน + legacy-import)
     - สาขา LG1003 (ปิดแล้วแต่มีประวัติ)
     - staging table สำหรับ bcp (JobHead/JobDetail) - รอ step ถัดไป

   ต้องรันหลัง seed-brand-split.sql เสมอ

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i seed-job-history-setup.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i seed-job-history-setup.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '`$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

CREATE TABLE #Sec  (AsCode varchar(50) NOT NULL, SecNum int NOT NULL, Title nvarchar(300) NOT NULL);
CREATE TABLE #Item (AsCode varchar(50) NOT NULL, SecNum int NOT NULL, ItemNum int NOT NULL,
                     QText nvarchar(max) NOT NULL, FullScore float NOT NULL,
                     CatCode nvarchar(20) NULL, CatName nvarchar(100) NULL);
CREATE TABLE #Auditor (LegacyId nvarchar(50) NOT NULL, Username nvarchar(100) NOT NULL, FullName nvarchar(200) NOT NULL);
"@
$sb.AppendLine($hdr) | Out-Null

$secRows = @($sections | ForEach-Object {
    "($(Q $_['As_code']),$([int]$_['Toppic_num']),$(Q $_['Toppic_name']))"
})
$sb.AppendLine("`r`n/* --- หมวดฟอร์มประวัติ $($secRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Sec (AsCode,SecNum,Title) VALUES' $secRows

$itemRows = @($items | ForEach-Object {
    $k = "$($_['As_code'])|$($_['Toppic_num'])|$($_['Subtoppic_no'])"
    $score = if ($scoreMap.ContainsKey($k)) { $scoreMap[$k] } else { 1.0 }
    $ts = ([string]$_['tsCode']).Trim().ToUpperInvariant()
    if ($ts -ne '' -and $CatMap.ContainsKey($ts)) { $cc = Q $CatMap[$ts][0]; $cn = Q $CatMap[$ts][1] }
    else { $cc = 'NULL'; $cn = 'NULL' }
    $txt = [string]$_['Subtoppic_name']
    if ([string]::IsNullOrWhiteSpace($txt)) { $txt = '-' }
    "($(Q $_['As_code']),$([int]$_['Toppic_num']),$([int]$_['Subtoppic_no']),$(Q $txt),$score,$cc,$cn)"
})
$sb.AppendLine("`r`n/* --- ข้อคำถามฟอร์มประวัติ $($itemRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Item (AsCode,SecNum,ItemNum,QText,FullScore,CatCode,CatName) VALUES' $itemRows

$auditorRows = @($resolvedAuditors | ForEach-Object {
    "($(Q $_['CheckBy']),$(Q $_['LOGON_NAME']),$(Q $_['User_Name']))"
})
$sb.AppendLine("`r`n/* --- ผู้ตรวจในประวัติ $($auditorRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Auditor (LegacyId,Username,FullName) VALUES' $auditorRows

$body = @'

/* --- 1. backfill FormGroupId ของฟอร์มปัจจุบันให้ชี้ตัวเอง (ตาม convention ของแอป) --- */
PRINT '1) backfill FormGroupId ของฟอร์มปัจจุบัน';
UPDATE SurveyForms SET FormGroupId = Id WHERE FormGroupId IS NULL AND IsLatest = 1;

/* --- 2. สาขา LG1003 (ปิดแล้วแต่มีประวัติ) --- */
PRINT '2) เพิ่มสาขา LG1003';
DECLARE @LgId int = (SELECT Id FROM Brands WHERE Code = N'LG');
DECLARE @StoreTypeId int = (SELECT MIN(Id) FROM LocationTypes WHERE Code = 'STORE');
IF @LgId IS NULL THROW 50020, 'ไม่พบแบรนด์ LG', 1;

INSERT INTO Locations (Code, Name, LocationTypeId, ManagerUserId, Latitude, Longitude, Region,
                        Address, Phone, LastScore, LastAuditDate, IsActive, CreatedAt)
SELECT N'LG1003', N'##LG1003_NAME##', @StoreTypeId, NULL, 0, 0, N'กรุงเทพฯ และปริมณฑล',
       N'', N'', 0, NULL, 0, SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM Locations WHERE Code = N'LG1003');

INSERT INTO LocationBrands (LocationId, BrandId, CreatedAt)
SELECT l.Id, @LgId, SYSUTCDATETIME() FROM Locations l WHERE l.Code = N'LG1003'
AND NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id AND lb.BrandId = @LgId);

/* --- 3. ผู้ตรวจในประวัติ (Users) --- */
PRINT '3) เพิ่มผู้ใช้ผู้ตรวจในประวัติ';
DECLARE @AuditorRoleId int = (SELECT Id FROM Roles WHERE Code = 'AUDITOR');
IF @AuditorRoleId IS NULL THROW 50021, 'ไม่พบบทบาท AUDITOR', 1;

-- หมายเหตุ: บางคนใช้ GUID (LegacyId) มากกว่า 1 ตัว (login คนละอุปกรณ์/เซสชัน) แต่
-- Username (รหัสพนักงาน) เดียวกัน จึงต้อง dedupe ก่อน insert เข้า Users (เอาแถวแรกสุด)
INSERT INTO Users (Username, PasswordHash, FullName, RoleId, BranchScope, BrandScope, MustChangePassword, IsActive, CreatedAt)
SELECT a.Username, CONVERT(varchar(200), NEWID()), a.FullName, @AuditorRoleId, 'ALL', 'ALL', 1, 0, SYSUTCDATETIME()
FROM (
    SELECT Username, FullName, ROW_NUMBER() OVER (PARTITION BY Username ORDER BY LegacyId) rn
    FROM #Auditor
) a
WHERE a.rn = 1
AND NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = a.Username);

INSERT INTO Users (Username, PasswordHash, FullName, RoleId, BranchScope, BrandScope, MustChangePassword, IsActive, CreatedAt)
SELECT 'legacy-import', CONVERT(varchar(200), NEWID()), N'ผู้ตรวจในประวัติ (ไม่ทราบตัวตน)', @AuditorRoleId, 'ALL', 'ALL', 1, 0, SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'legacy-import');

/* --- 4. ฟอร์มประวัติ 10 ฟอร์ม --- */
PRINT '4) สร้างฟอร์มประวัติ';
'@
$sb.AppendLine($body) | Out-Null

# --- per-As_code form creation (บาง As_code ใช้ FormGroupId ของฟอร์มปัจจุบัน, บางอันไม่มี)
foreach ($code in $FormCodes) {
    $safeCode = $code
    if ($LiveTitle.ContainsKey($code)) {
        $title = $LiveTitle[$code]
        $sb.AppendLine(@"

DECLARE @LiveId_$safeCode int = (SELECT Id FROM SurveyForms WHERE Title = $(Q $title) AND IsLatest = 1);
IF @LiveId_$safeCode IS NULL THROW 50022, 'ไม่พบฟอร์มปัจจุบันของ $safeCode', 1;
IF NOT EXISTS (SELECT 1 FROM SurveyForms WHERE FormGroupId = @LiveId_$safeCode AND Version = 'legacy-history')
INSERT INTO SurveyForms (FormGroupId, Title, LocationTypeId, BrandId, PassingScore, TargetingMode, Version, IsLatest, IsActive, CreatedBy, MetadataConfigJson, CreatedAt)
SELECT @LiveId_$safeCode, sf.Title, sf.LocationTypeId, sf.BrandId, 85.0, 'ALL_LOCATIONS', 'legacy-history', 0, 0, @AdminId, NULL, SYSUTCDATETIME()
FROM SurveyForms sf WHERE sf.Id = @LiveId_$safeCode;

INSERT INTO SurveyFormBrands (SurveyFormId, BrandId, CreatedAt)
SELECT hist.Id, fb.BrandId, SYSUTCDATETIME()
FROM SurveyForms hist
JOIN SurveyFormBrands fb ON fb.SurveyFormId = @LiveId_$safeCode
WHERE hist.FormGroupId = @LiveId_$safeCode AND hist.Version = 'legacy-history'
AND NOT EXISTS (SELECT 1 FROM SurveyFormBrands x WHERE x.SurveyFormId = hist.Id AND x.BrandId = fb.BrandId);
"@) | Out-Null
    } else {
        $brandCode = $BrandOfCode[$code]
        $sb.AppendLine(@"

DECLARE @BrandId_$safeCode int = (SELECT Id FROM Brands WHERE Code = $(Q $brandCode));
IF NOT EXISTS (SELECT 1 FROM SurveyForms WHERE Title = $(Q "$code (legacy-history)"))
INSERT INTO SurveyForms (FormGroupId, Title, LocationTypeId, BrandId, PassingScore, TargetingMode, Version, IsLatest, IsActive, CreatedBy, MetadataConfigJson, CreatedAt)
VALUES (NULL, $(Q "$code (legacy-history)"), @StoreTypeId, @BrandId_$safeCode, 85.0, 'ALL_LOCATIONS', 'legacy-history', 1, 0, @AdminId, NULL, SYSUTCDATETIME());

DECLARE @NewFormId_$safeCode int = (SELECT Id FROM SurveyForms WHERE Title = $(Q "$code (legacy-history)"));
UPDATE SurveyForms SET FormGroupId = Id WHERE Id = @NewFormId_$safeCode AND FormGroupId IS NULL;
INSERT INTO SurveyFormBrands (SurveyFormId, BrandId, CreatedAt)
SELECT @NewFormId_$safeCode, @BrandId_$safeCode, SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM SurveyFormBrands WHERE SurveyFormId = @NewFormId_$safeCode AND BrandId = @BrandId_$safeCode);
"@) | Out-Null
    }
}

$sb.AppendLine(@'

/* --- resolve HistFormId ของแต่ละ As_code (ใช้ต่อใน sections/items) --- */
CREATE TABLE #HistForm (AsCode varchar(50) NOT NULL, FormId int NOT NULL);
'@) | Out-Null

foreach ($code in $FormCodes) {
    if ($LiveTitle.ContainsKey($code)) {
        $sb.AppendLine("INSERT INTO #HistForm (AsCode, FormId) SELECT $(Q $code), Id FROM SurveyForms WHERE FormGroupId = @LiveId_$code AND Version = 'legacy-history';") | Out-Null
    } else {
        $sb.AppendLine("INSERT INTO #HistForm (AsCode, FormId) SELECT $(Q $code), @NewFormId_$code;") | Out-Null
    }
}

$sb.AppendLine(@'

/* --- 5. Sections/Items ของฟอร์มประวัติ --- */
PRINT '5) สร้าง Sections/Items ของฟอร์มประวัติ';
INSERT INTO SurveySections (SurveyFormId, Title, OrderIndex, WeightPercent, IsActive, CreatedAt)
SELECT hf.FormId, s.Title, s.SecNum, 0, 0, SYSUTCDATETIME()
FROM #Sec s JOIN #HistForm hf ON hf.AsCode = s.AsCode
WHERE NOT EXISTS (SELECT 1 FROM SurveySections x WHERE x.SurveyFormId = hf.FormId AND x.OrderIndex = s.SecNum);

INSERT INTO SurveyItems (SurveySectionId, QuestionText, QuestionType, FullScore, IsCritical, CategoryCode, CategoryName, OrderIndex, IsActive, CreatedAt)
SELECT sec.Id, i.QText, 'YESNO', i.FullScore, 0, i.CatCode, i.CatName, i.ItemNum, 0, SYSUTCDATETIME()
FROM #Item i
JOIN #HistForm hf ON hf.AsCode = i.AsCode
JOIN SurveySections sec ON sec.SurveyFormId = hf.FormId AND sec.OrderIndex = i.SecNum
WHERE NOT EXISTS (SELECT 1 FROM SurveyItems x WHERE x.SurveySectionId = sec.Id AND x.OrderIndex = i.ItemNum);

/* --- 6. staging tables สำหรับ bcp (JobHead/JobDetail) --- */
PRINT '6) สร้าง staging table สำหรับ bcp';
IF OBJECT_ID('dbo.stg_JobHead') IS NOT NULL DROP TABLE dbo.stg_JobHead;
CREATE TABLE dbo.stg_JobHead (
    JobId       uniqueidentifier NOT NULL PRIMARY KEY,
    Branch_Code varchar(10)      NOT NULL,
    As_code     varchar(50)      NULL,
    CheckBy     uniqueidentifier NOT NULL,
    latOn       float            NULL,
    lonOn       float            NULL,
    CheckOn     datetime         NULL,
    CheckOut    datetime         NULL,
    latColse    float            NULL,
    lonColse    float            NULL,
    managerName varchar(255)     NULL,
    empNum      int              NULL,
    Comment     varchar(max)     NULL,
    criterion   decimal(18,2)    NULL
);
IF OBJECT_ID('dbo.stg_JobDetail') IS NOT NULL DROP TABLE dbo.stg_JobDetail;
CREATE TABLE dbo.stg_JobDetail (
    JobId        uniqueidentifier NOT NULL,
    Toppic_num   int              NULL,
    Subtoppic_no int              NULL,
    IsCheck      bit              NULL,
    IsNotCheck   bit              NULL,
    comment      varchar(250)     NULL,
    scoreGet     float            NULL,
    tsCode       varchar(50)      NULL
);

SELECT 'sections='+CAST((SELECT COUNT(*) FROM #Sec) AS varchar)
     + ' items='+CAST((SELECT COUNT(*) FROM #Item) AS varchar)
     + ' auditors='+CAST((SELECT COUNT(*) FROM #Auditor) AS varchar) AS [สรุป];

IF @DryRun = 1
BEGIN
    ROLLBACK TRANSACTION;
    PRINT '*** DRY RUN จบแล้ว - ROLLBACK เรียบร้อย (หมายเหตุ: staging table ก็จะถูก rollback ด้วย ต้องรันจริงก่อนไป step bcp) ***';
END
ELSE
BEGIN
    COMMIT TRANSACTION;
    PRINT '*** COMMIT เรียบร้อย ***';
END
'@) | Out-Null

# แทรก @AdminId, @StoreTypeId declare ไว้ตอนต้น (ก่อนใช้ในลูป As_code)
$declarePrefix = @'

DECLARE @AdminId int = (SELECT MIN(Id) FROM Users WHERE Username = 'admin');
IF @AdminId IS NULL THROW 50023, 'ไม่พบผู้ใช้ admin', 1;
'@
$finalText = $sb.ToString()
$insertPoint = $finalText.IndexOf("PRINT '4) สร้างฟอร์มประวัติ';")
$finalText = $finalText.Insert($insertPoint + "PRINT '4) สร้างฟอร์มประวัติ';".Length, $declarePrefix)
$lg1003NameEscaped = $lg1003Name.Replace("'", "''")
$finalText = $finalText.Replace('##LG1003_NAME##', $lg1003NameEscaped)

[System.IO.File]::WriteAllText($OutFile, $finalText, (New-Object System.Text.UTF8Encoding($true)))

$size = [Math]::Round((Get-Item $OutFile).Length / 1KB, 1)
Write-Host ("   เขียน {0} ({1} KB)" -f $OutFile, $size) -ForegroundColor Green
Write-Host ''
Write-Host 'ขั้นต่อไป - ทดสอบแบบ rollback:' -ForegroundColor Cyan
Write-Host '   sqlcmd -S <server> -U qsc_sys -P <password> -d QSCDB -C -b -v DryRun=1 -i seed-job-history-setup.sql'
