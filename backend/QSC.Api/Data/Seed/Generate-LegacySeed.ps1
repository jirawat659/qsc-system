<#
  Generate-LegacySeed.ps1
  -----------------------
  อ่านข้อมูลตั้งต้นจากระบบ QSC เดิม แล้ว generate ไฟล์ seed-legacy-master.sql
  สคริปต์นี้ "อ่านเท่านั้น" ไม่เขียนอะไรลงฐานข้อมูลใด ๆ ทั้งต้นทางและปลายทาง

  ต้นทาง
    AU  192.168.11.1,1319  AUDB.dbo.Site      (สาขา)
    LG  192.168.11.1,1319  LGDB.dbo.Site      (สาขา)
    MK  192.168.20.5,4488  MikkaDB.dbo.Site   (สาขา)
    ทุกแบรนด์ 192.168.11.1,1319  PI_QSC       (ฟอร์มตรวจ)

  ใช้งาน
    powershell -ExecutionPolicy Bypass -File Generate-LegacySeed.ps1
#>
[CmdletBinding()]
param(
    [string]$OutFile,
    [string]$AuServer = '192.168.11.1,1319',
    [string]$MkServer = '192.168.20.5,4488',
    [string]$SqlUser  = 'claude_user',
    [Parameter(Mandatory=$true)][string]$SqlPass
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($OutFile)) { $OutFile = Join-Path $scriptDir 'seed-legacy-master.sql' }

# ---------------------------------------------------------------- helpers

function New-ConnString([string]$server, [string]$db) {
    "Server=$server;Database=$db;User Id=$SqlUser;Password=$SqlPass;TrustServerCertificate=True;Connect Timeout=20"
}

function Invoke-Read([string]$server, [string]$db, [string]$sql) {
    $conn = New-Object System.Data.SqlClient.SqlConnection (New-ConnString $server $db)
    try {
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.CommandTimeout = 180
        $table = New-Object System.Data.DataTable
        $table.Load($cmd.ExecuteReader())
        return ,@($table.Rows)
    } finally { $conn.Dispose() }
}

# escape สำหรับ string literal ของ T-SQL
function Q([object]$v) {
    if ($null -eq $v -or $v -is [System.DBNull]) { return 'NULL' }
    $s = [string]$v
    return "N'" + $s.Replace("'", "''") + "'"
}

# ตัวเลข — คืน fallback เมื่อแปลงไม่ได้ (Latitude/Longitude เป็น NOT NULL ใน schema ใหม่)
function Num([object]$v, [double]$fallback = 0) {
    if ($null -eq $v -or $v -is [System.DBNull]) { return $fallback }
    $s = ([string]$v).Trim()
    if ($s -eq '' -or $s -eq '.') { return $fallback }
    $out = 0.0
    if ([double]::TryParse($s, [ref]$out)) { return $out }
    return $fallback
}

# ระบบเดิมใส่ '.' หรือ '' ไว้แทน null
function Clean([object]$v) {
    if ($null -eq $v -or $v -is [System.DBNull]) { return '' }
    $s = ([string]$v).Trim()
    if ($s -eq '.') { return '' }
    return $s
}

$BkkKeywords = @("กรุงเทพ", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "นครปฐม")
$RegionBkk       = "กรุงเทพฯ และปริมณฑล"
$RegionUpcountry = "ต่างจังหวัด"

function Get-Region([string]$addr, [object]$isbkk) {
    if ($addr -ne '') {
        foreach ($k in $BkkKeywords) { if ($addr.Contains($k)) { return $RegionBkk } }
        return $RegionUpcountry
    }
    if ((Num $isbkk -1) -eq 1) { return $RegionBkk }
    return $RegionUpcountry
}

# แบ่ง INSERT ... VALUES เป็นก้อน (SQL Server จำกัด 1000 แถวต่อ statement)
function Write-ValuesBatched($writer, [string]$header, [string[]]$rows, [int]$batch = 400) {
    if ($rows.Count -eq 0) { return }
    for ($i = 0; $i -lt $rows.Count; $i += $batch) {
        $slice = $rows[$i..([Math]::Min($i + $batch - 1, $rows.Count - 1))]
        $writer.AppendLine($header) | Out-Null
        $writer.AppendLine(($slice -join ",`r`n") + ';') | Out-Null
    }
}

# ---------------------------------------------------------------- config

$Brands = @(
    [pscustomobject]@{ Code='AU'; Name='After You'; Server=$AuServer; Db='AUDB' },
    [pscustomobject]@{ Code='MK'; Name='Mikka';     Server=$MkServer; Db='MikkaDB' },
    [pscustomobject]@{ Code='LG'; Name='Luggaw';    Server=$AuServer; Db='LGDB' }
)

# ฟอร์มที่ seed — เฉพาะ assessment ที่มีสาขาผูกอยู่ใน A_Branch_Assessment
$FormCodes = @('OP003','OP004','OP006','OP008','OP009','IT0001','LG001','LG002','MK001')

# tsCode ของระบบเดิม -> CategoryCode/CategoryName ที่ schema ใหม่ใช้
$CatMap = @{
    'C'  = @('CLN', "ความสะอาด")
    'DM' = @('DOC', "เอกสาร")
    'PC' = @('OPS', "กระบวนการทำงาน")
    'Q'  = @('QLT', "คุณภาพสินค้า")
    'PD' = @('QLT', "คุณภาพสินค้า")
    'S'  = @('SVC', "การบริการ")
}

# blocklist — แถวที่เป็น test / office / ครัวกลาง ปนอยู่ใน Site master
$BlockCode = @('*TEST*','OF-*','PLATEAU*','*TRAINING*','SAMKITCHEN','EVENT')
$BlockName = @('*Test*','*Traning*','*Training*')

function Test-Blocked([string]$code, [string]$name) {
    foreach ($p in $BlockCode) { if ($code -like $p) { return $true } }
    foreach ($p in $BlockName) { if ($name -like $p) { return $true } }
    return $false
}

# ---------------------------------------------------------------- 1. สาขา

Write-Host ''
Write-Host '== 1. อ่านสาขาจาก master DB ==' -ForegroundColor Cyan

$siteSql = @'
SELECT Site, Name, isbkk, Lat, Lng, Address, ContactTel
FROM   dbo.Site
WHERE  IsBranch = 1 AND Isclosed = 0 AND ISNULL(StateCode, 1) = 1
ORDER  BY Site
'@

# AU: ที่อยู่ใน AUDB.Site ว่างเป็นส่วนใหญ่ ใช้ PI_QSC.S_Branch_H เป็น fallback
$auAddrFallback = @{}
foreach ($r in (Invoke-Read $AuServer 'PI_QSC' "SELECT Branch_Code, Branch_Address FROM S_Branch_H WHERE Com_Code = 'AU' AND Branch_Code IS NOT NULL")) {
    $bc = Clean $r['Branch_Code']
    if ($bc -ne '') { $auAddrFallback[$bc.ToUpperInvariant()] = (Clean $r['Branch_Address']) }
}
Write-Host ("   AU address fallback (S_Branch_H): {0} แถว" -f $auAddrFallback.Count)

$locations = New-Object System.Collections.ArrayList
$skipped   = New-Object System.Collections.ArrayList
$renamed   = New-Object System.Collections.ArrayList
$seenCode  = @{}

foreach ($b in $Brands) {
    $rows = Invoke-Read $b.Server $b.Db $siteSql
    $kept = 0
    $cut  = 0
    foreach ($r in $rows) {
        $code = Clean $r['Site']
        $name = Clean $r['Name']
        if ($code -eq '') { continue }
        if ($name -eq '') { $name = $code }

        if (Test-Blocked $code $name) {
            [void]$skipped.Add([pscustomobject]@{ Brand=$b.Code; Code=$code; Name=$name })
            $cut++
            continue
        }

        $addr = Clean $r['Address']
        if ($addr -eq '' -and $b.Code -eq 'AU') {
            $k = $code.ToUpperInvariant()
            if ($auAddrFallback.ContainsKey($k)) { $addr = $auAddrFallback[$k] }
        }

        # กันโค้ดชนกันข้ามแบรนด์ (collation ของ SQL Server ไม่แยกตัวพิมพ์เล็กใหญ่)
        $finalCode = $code
        $key = $code.ToUpperInvariant()
        if ($seenCode.ContainsKey($key)) {
            $finalCode = "{0}-{1}" -f $b.Code, $code
            $newKey = $finalCode.ToUpperInvariant()
            if ($seenCode.ContainsKey($newKey)) {
                throw "โค้ดสาขาชนกันและแก้อัตโนมัติไม่ได้: '$code' (แบรนด์ $($b.Code)) ชนกับ '$($seenCode[$key])' — ต้องแก้ที่ต้นทาง"
            }
            [void]$renamed.Add([pscustomobject]@{ Brand=$b.Code; From=$code; To=$finalCode; ClashWith=$seenCode[$key] })
            $key = $newKey
        }
        $seenCode[$key] = "$($b.Code)/$code"

        [void]$locations.Add([pscustomobject]@{
            Code      = $finalCode
            Name      = $name
            BrandCode = $b.Code
            Lat       = (Num $r['Lat'])
            Lng       = (Num $r['Lng'])
            Region    = (Get-Region $addr $r['isbkk'])
            Address   = $addr
            Phone     = (Clean $r['ContactTel'])
            SrcCode   = $code
        })
        $kept++
    }
    Write-Host ("   {0,-3} {1,-9} เก็บ {2,4} สาขา  (ตัด {3})" -f $b.Code, $b.Db, $kept, $cut)
}

# ---------------------------------------------------------------- 2. ฟอร์ม

Write-Host ''
Write-Host '== 2. อ่านฟอร์มตรวจจาก PI_QSC ==' -ForegroundColor Cyan

$codeList = ($FormCodes | ForEach-Object { "'$_'" }) -join ','

$assessments = Invoke-Read $AuServer 'PI_QSC' "SELECT As_code, As_name, As_total, criterion, Com_Code FROM Assessment WHERE As_code IN ($codeList) ORDER BY As_code"

$sections = Invoke-Read $AuServer 'PI_QSC' "SELECT As_code, Toppic_num, Toppic_name, socreTotal FROM Toppic WHERE As_code IN ($codeList) AND ISNULL(DeletionStateCode, 0) = 0 ORDER BY As_code, Toppic_num"

$items = Invoke-Read $AuServer 'PI_QSC' "SELECT t.As_code, t.Toppic_num, st.ST_num, st.ST_name, st.socre, st.tsCode FROM SubToppic st JOIN Toppic t ON t.Toppic_id = st.Toppic_id WHERE t.As_code IN ($codeList) AND ISNULL(st.DeletionStateCode, 0) = 0 AND ISNULL(t.DeletionStateCode, 0) = 0 ORDER BY t.As_code, t.Toppic_num, st.ST_num"

$targets = Invoke-Read $AuServer 'PI_QSC' "SELECT DISTINCT As_code, Branch_Code FROM A_Branch_Assessment WHERE As_code IN ($codeList)"

$asTotal = @{}
foreach ($a in $assessments) { $asTotal[[string]$a['As_code']] = (Num $a['As_total'] 0) }

Write-Host ("   ฟอร์ม {0} · หมวด {1} · ข้อ {2} · ผูกสาขา {3} แถว" -f $assessments.Count, $sections.Count, $items.Count, $targets.Count)

# ---------------------------------------------------------------- 3. emit SQL

Write-Host ''
Write-Host '== 3. เขียนไฟล์ .sql ==' -ForegroundColor Cyan

$sb = New-Object System.Text.StringBuilder
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$hdr = @"
/* =============================================================================
   seed-legacy-master.sql   (GENERATED - ห้ามแก้ด้วยมือ)
   สร้างโดย Generate-LegacySeed.ps1 เมื่อ $stamp

   ข้อมูลตั้งต้นจากระบบ QSC เดิม: แบรนด์ + สาขา + ฟอร์มตรวจ (AU / MK / LG)
   ล้าง demo test data ออก แต่คงการตั้งค่าระบบไว้
   (Roles / Permissions / RolePermissions / LocationTypes / บัญชี admin)

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -v DryRun=1 -i seed-legacy-master.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -v DryRun=0 -i seed-legacy-master.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '`$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

/* --- 0. staging ------------------------------------------------------------ */
CREATE TABLE #Loc (
    Code      nvarchar(50)  NOT NULL,
    Name      nvarchar(200) NOT NULL,
    BrandCode nvarchar(10)  NOT NULL,
    Lat       float         NOT NULL,
    Lng       float         NOT NULL,
    Region    nvarchar(100) NOT NULL,
    Addr      nvarchar(max) NOT NULL,
    Phone     nvarchar(50)  NOT NULL
);
CREATE TABLE #Form (
    AsCode       varchar(50)   NOT NULL,
    BrandCode    nvarchar(10)  NOT NULL,
    Title        nvarchar(300) NOT NULL,
    PassingScore float         NOT NULL
);
CREATE TABLE #Sec (
    AsCode varchar(50)   NOT NULL,
    SecNum int           NOT NULL,
    Title  nvarchar(300) NOT NULL,
    Weight float         NOT NULL
);
CREATE TABLE #Item (
    AsCode    varchar(50)   NOT NULL,
    SecNum    int           NOT NULL,
    ItemNum   int           NOT NULL,
    QText     nvarchar(max) NOT NULL,
    FullScore float         NOT NULL,
    CatCode   nvarchar(20)  NULL,
    CatName   nvarchar(100) NULL
);
CREATE TABLE #Target (
    AsCode     varchar(50)  NOT NULL,
    BranchCode nvarchar(50) NOT NULL
);
"@
$sb.AppendLine($hdr) | Out-Null

$locRows = @($locations | ForEach-Object {
    "($(Q $_.Code),$(Q $_.Name),$(Q $_.BrandCode),$($_.Lat),$($_.Lng),$(Q $_.Region),$(Q $_.Address),$(Q $_.Phone))"
})
$sb.AppendLine("`r`n/* --- สาขา $($locRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Loc (Code,Name,BrandCode,Lat,Lng,Region,Addr,Phone) VALUES' $locRows

$brandOfForm = @{}
$formRows = @()
foreach ($a in $assessments) {
    $ac = [string]$a['As_code']
    $bc = (Clean $a['Com_Code']).ToUpperInvariant()
    if ($bc -eq '') { $bc = 'AU' }
    $brandOfForm[$ac] = $bc
    $pass = (Num $a['criterion'] 0.85) * 100
    $formRows += "($(Q $ac),$(Q $bc),$(Q (Clean $a['As_name'])),$pass)"
}
$sb.AppendLine("`r`n/* --- ฟอร์ม $($formRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Form (AsCode,BrandCode,Title,PassingScore) VALUES' $formRows

$secRows = @($sections | ForEach-Object {
    $ac = [string]$_['As_code']
    $tot = $asTotal[$ac]
    $w = if ($tot -gt 0) { [Math]::Round((Num $_['socreTotal']) / $tot * 100, 4) } else { 0 }
    "($(Q $ac),$([int](Num $_['Toppic_num'])),$(Q (Clean $_['Toppic_name'])),$w)"
})
$sb.AppendLine("`r`n/* --- หมวด $($secRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Sec (AsCode,SecNum,Title,Weight) VALUES' $secRows

$itemRows = @($items | ForEach-Object {
    $ts = (Clean $_['tsCode']).ToUpperInvariant()
    if ($ts -ne '' -and $CatMap.ContainsKey($ts)) {
        $cc = Q $CatMap[$ts][0]; $cn = Q $CatMap[$ts][1]
    } else { $cc = 'NULL'; $cn = 'NULL' }
    $txt = Clean $_['ST_name']
    if ($txt -eq '') { $txt = '-' }
    "($(Q ([string]$_['As_code'])),$([int](Num $_['Toppic_num'])),$([int](Num $_['ST_num'])),$(Q $txt),$(Num $_['socre']),$cc,$cn)"
})
$sb.AppendLine("`r`n/* --- ข้อคำถาม $($itemRows.Count) แถว --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Item (AsCode,SecNum,ItemNum,QText,FullScore,CatCode,CatName) VALUES' $itemRows

# map โค้ดสาขาต้นทาง -> โค้ดที่ใช้จริง (กรณีถูกเติม prefix กันชน)
$codeRemap = @{}
$liveCodes = @{}
foreach ($l in $locations) {
    $codeRemap["$($l.BrandCode)|$($l.SrcCode.ToUpperInvariant())"] = $l.Code
    $liveCodes[$l.Code.ToUpperInvariant()] = $true
}

$tgtRows = @()
$tgtDropped = New-Object System.Collections.ArrayList
foreach ($t in $targets) {
    $ac = [string]$t['As_code']
    $src = Clean $t['Branch_Code']
    if ($src -eq '') { continue }
    $bc = $brandOfForm[$ac]
    $k = "$bc|$($src.ToUpperInvariant())"
    $final = if ($codeRemap.ContainsKey($k)) { $codeRemap[$k] } else { $src }
    if (-not $liveCodes.ContainsKey($final.ToUpperInvariant())) {
        [void]$tgtDropped.Add([pscustomobject]@{ Form=$ac; Branch=$src })
        continue
    }
    $tgtRows += "($(Q $ac),$(Q $final))"
}
$sb.AppendLine("`r`n/* --- ผูกฟอร์มกับสาขา $($tgtRows.Count) แถว (ตัดที่ชี้สาขาที่ไม่ถูก seed $($tgtDropped.Count) แถว) --- */") | Out-Null
Write-ValuesBatched $sb 'INSERT INTO #Target (AsCode,BranchCode) VALUES' $tgtRows

$body = @'

/* --- 1. ล้าง demo test data (child -> parent, FK ส่วนใหญ่เป็น Restrict) ----- */
PRINT '1) ล้าง demo test data';
DELETE FROM CapTaskComments;
DELETE FROM CapTaskImages;
DELETE FROM CapTasks;
DELETE FROM AuditResponseImages;
DELETE FROM AuditResponses;
DELETE FROM AuditRecordEditLogs;
DELETE FROM AuditRecords;
DELETE FROM AuditDrafts;
DELETE FROM AuditScheduleAuditors;
DELETE FROM AuditSchedules;
DELETE FROM SurveyItems;
DELETE FROM SurveySections;
DELETE FROM SurveyFormTargetLocations;
DELETE FROM SurveyFormBrands;
DELETE FROM SurveyForms;
DELETE FROM UserLocations;
DELETE FROM LocationBrands;
DELETE FROM UserBrands;
DELETE FROM Locations;
DELETE FROM Brands;
DELETE FROM Users WHERE Username <> 'admin';
/* ไม่แตะ: LocationTypes, Roles, Permissions, RolePermissions, Users(admin) */

UPDATE Users SET BranchScope = 'ALL', BrandScope = 'ALL' WHERE Username = 'admin';

DECLARE @AdminId     int = (SELECT MIN(Id) FROM Users WHERE Username = 'admin');
DECLARE @StoreTypeId int = (SELECT MIN(Id) FROM LocationTypes WHERE Code = 'STORE');

IF @AdminId IS NULL
    THROW 50001, 'ไม่พบผู้ใช้ admin - ให้สตาร์ท API หนึ่งครั้งเพื่อ bootstrap การตั้งค่าระบบก่อน', 1;
IF @StoreTypeId IS NULL
    THROW 50002, 'ไม่พบ LocationType STORE - ให้สตาร์ท API หนึ่งครั้งเพื่อ bootstrap การตั้งค่าระบบก่อน', 1;

/* --- 2. แบรนด์ ------------------------------------------------------------- */
PRINT '2) แบรนด์';
INSERT INTO Brands (Code, Name, Description, IsActive, CreatedAt)
VALUES (N'AU', N'After You', N'บริษัท อาฟเตอร์ ยู จำกัด (มหาชน)', 1, SYSUTCDATETIME()),
       (N'MK', N'Mikka',     N'บริษัท เอ็ม แอนด์ เอ็ม จำกัด (มหาชน)', 1, SYSUTCDATETIME()),
       (N'LG', N'Luggaw',    N'บริษัท ลูกก๊อ จำกัด', 1, SYSUTCDATETIME());

/* --- 3. สาขา --------------------------------------------------------------- */
PRINT '3) สาขา';
INSERT INTO Locations
      (Code, Name, LocationTypeId, ManagerUserId, Latitude, Longitude, Region,
       Address, Phone, LastScore, LastAuditDate, IsActive, CreatedAt)
SELECT l.Code, l.Name, @StoreTypeId, NULL, l.Lat, l.Lng, l.Region,
       l.Addr, l.Phone, 0, NULL, 1, SYSUTCDATETIME()
FROM   #Loc l
JOIN   Brands b ON b.Code = l.BrandCode;

INSERT INTO LocationBrands (LocationId, BrandId, CreatedAt)
SELECT loc.Id, b.Id, SYSUTCDATETIME()
FROM   #Loc l
JOIN   Locations loc ON loc.Code = l.Code
JOIN   Brands    b   ON b.Code   = l.BrandCode;

/* --- 4. ฟอร์มตรวจ ---------------------------------------------------------- */
PRINT '4) ฟอร์มตรวจ';
INSERT INTO SurveyForms
      (FormGroupId, Title, LocationTypeId, BrandId, PassingScore, TargetingMode,
       Version, IsLatest, IsActive, CreatedBy, MetadataConfigJson, CreatedAt)
SELECT NULL, f.Title, @StoreTypeId, b.Id, f.PassingScore, 'SPECIFIC_LOCATIONS',
       'v1.0', 1, 1, @AdminId, NULL, SYSUTCDATETIME()
FROM   #Form f
JOIN   Brands b ON b.Code = f.BrandCode;

/* Title ของ Assessment ไม่ซ้ำกันในชุดที่ seed จึงใช้ join ด้วย Title ได้ */
INSERT INTO SurveyFormBrands (SurveyFormId, BrandId, CreatedAt)
SELECT sf.Id, b.Id, SYSUTCDATETIME()
FROM   #Form f
JOIN   SurveyForms sf ON sf.Title = f.Title
JOIN   Brands      b  ON b.Code   = f.BrandCode;

INSERT INTO SurveySections (SurveyFormId, Title, OrderIndex, WeightPercent, IsActive, CreatedAt)
SELECT sf.Id, s.Title, s.SecNum, s.Weight, 1, SYSUTCDATETIME()
FROM   #Sec s
JOIN   #Form f        ON f.AsCode = s.AsCode
JOIN   SurveyForms sf ON sf.Title = f.Title;

INSERT INTO SurveyItems
      (SurveySectionId, QuestionText, QuestionType, FullScore, IsCritical,
       CategoryCode, CategoryName, OrderIndex, IsActive, CreatedAt)
SELECT sec.Id, i.QText, 'YESNO', i.FullScore, 0,
       i.CatCode, i.CatName, i.ItemNum, 1, SYSUTCDATETIME()
FROM   #Item i
JOIN   #Form f        ON f.AsCode = i.AsCode
JOIN   SurveyForms sf ON sf.Title = f.Title
JOIN   SurveySections sec ON sec.SurveyFormId = sf.Id AND sec.OrderIndex = i.SecNum;

INSERT INTO SurveyFormTargetLocations (SurveyFormId, LocationId, CreatedAt)
SELECT sf.Id, loc.Id, SYSUTCDATETIME()
FROM   #Target t
JOIN   #Form f        ON f.AsCode = t.AsCode
JOIN   SurveyForms sf ON sf.Title = f.Title
JOIN   Locations  loc ON loc.Code = t.BranchCode;

/* --- 5. รายงานผล ----------------------------------------------------------- */
PRINT '5) สรุปผล';
SELECT 'Brands' AS [ตาราง], COUNT(*) AS [แถว] FROM Brands
UNION ALL SELECT 'Locations',                 COUNT(*) FROM Locations
UNION ALL SELECT 'LocationBrands',            COUNT(*) FROM LocationBrands
UNION ALL SELECT 'SurveyForms',               COUNT(*) FROM SurveyForms
UNION ALL SELECT 'SurveyFormBrands',          COUNT(*) FROM SurveyFormBrands
UNION ALL SELECT 'SurveySections',            COUNT(*) FROM SurveySections
UNION ALL SELECT 'SurveyItems',               COUNT(*) FROM SurveyItems
UNION ALL SELECT 'SurveyFormTargetLocations', COUNT(*) FROM SurveyFormTargetLocations
UNION ALL SELECT '-- คงไว้ --',               NULL
UNION ALL SELECT 'Roles',                     COUNT(*) FROM Roles
UNION ALL SELECT 'Permissions',               COUNT(*) FROM Permissions
UNION ALL SELECT 'RolePermissions',           COUNT(*) FROM RolePermissions
UNION ALL SELECT 'LocationTypes',             COUNT(*) FROM LocationTypes
UNION ALL SELECT 'Users',                     COUNT(*) FROM Users;

SELECT b.Code AS [แบรนด์], COUNT(*) AS [สาขา]
FROM   Locations l
JOIN   LocationBrands lb ON lb.LocationId = l.Id
JOIN   Brands b ON b.Id = lb.BrandId
GROUP  BY b.Code ORDER BY b.Code;

SELECT sf.Title AS [ฟอร์ม],
       (SELECT COUNT(*) FROM SurveySections s WHERE s.SurveyFormId = sf.Id) AS [หมวด],
       (SELECT COUNT(*) FROM SurveyItems si JOIN SurveySections s2 ON s2.Id = si.SurveySectionId WHERE s2.SurveyFormId = sf.Id) AS [ข้อ],
       (SELECT SUM(si.FullScore) FROM SurveyItems si JOIN SurveySections s3 ON s3.Id = si.SurveySectionId WHERE s3.SurveyFormId = sf.Id) AS [คะแนนรวม],
       (SELECT ROUND(SUM(s4.WeightPercent), 1) FROM SurveySections s4 WHERE s4.SurveyFormId = sf.Id) AS [น้ำหนัก %],
       (SELECT COUNT(*) FROM SurveyFormTargetLocations tl WHERE tl.SurveyFormId = sf.Id) AS [สาขาที่ผูก]
FROM   SurveyForms sf ORDER BY sf.Title;

/* ตรวจความถูกต้อง - ทุกค่าต้องเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM Locations l WHERE NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id)) AS [สาขาไม่มีแบรนด์],
  (SELECT COUNT(*) FROM (SELECT Code FROM Locations GROUP BY Code HAVING COUNT(*) > 1) x)                          AS [โค้ดสาขาซ้ำ],
  (SELECT COUNT(*) FROM Brands WHERE Code IN ('UB','CL','AB','CS','QSCH'))                                         AS [แบรนด์ demo คงเหลือ],
  (SELECT COUNT(*) FROM SurveyItems si WHERE NOT EXISTS (SELECT 1 FROM SurveySections s WHERE s.Id = si.SurveySectionId)) AS [ข้อกำพร้า],
  (SELECT COUNT(*) FROM AuditRecords) + (SELECT COUNT(*) FROM CapTasks) + (SELECT COUNT(*) FROM AuditSchedules)     AS [ข้อมูลตรวจ demo คงเหลือ];

/* --- 6. commit / rollback -------------------------------------------------- */
IF @DryRun = 1
BEGIN
    ROLLBACK TRANSACTION;
    PRINT '*** DRY RUN จบแล้ว - ROLLBACK เรียบร้อย ไม่มีอะไรถูกบันทึก ***';
END
ELSE
BEGIN
    COMMIT TRANSACTION;
    PRINT '*** COMMIT เรียบร้อย ***';
END
'@
$sb.AppendLine($body) | Out-Null

# เขียนแบบ UTF-8 + BOM เพื่อให้ sqlcmd -i อ่านภาษาไทยถูก
[System.IO.File]::WriteAllText($OutFile, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))

# ---------------------------------------------------------------- 4. รายงาน

$size = [Math]::Round((Get-Item $OutFile).Length / 1KB, 1)
Write-Host ("   เขียน {0} ({1} KB)" -f $OutFile, $size) -ForegroundColor Green

Write-Host ''
Write-Host '== สรุปสิ่งที่จะถูก seed ==' -ForegroundColor Cyan
$locations | Group-Object BrandCode | Sort-Object Name | ForEach-Object {
    $noGps  = ($_.Group | Where-Object { $_.Lat -eq 0 -or $_.Lng -eq 0 }).Count
    $noAddr = ($_.Group | Where-Object { $_.Address -eq '' }).Count
    Write-Host ("   {0,-3} สาขา {1,4}   ไม่มีพิกัด {2,3}   ไม่มีที่อยู่ {3,3}" -f $_.Name, $_.Count, $noGps, $noAddr)
}
Write-Host ("   รวม    {0,4} สาขา · ฟอร์ม {1} · หมวด {2} · ข้อ {3} · ผูกสาขา {4}" -f $locations.Count, $formRows.Count, $secRows.Count, $itemRows.Count, $tgtRows.Count)

if ($renamed.Count -gt 0) {
    Write-Host ''
    Write-Host ('== โค้ดสาขาที่ถูกเปลี่ยนเพราะชนกัน ({0}) ==' -f $renamed.Count) -ForegroundColor Yellow
    $renamed | ForEach-Object { Write-Host ("   {0,-3} {1}  ->  {2}   (ชนกับ {3})" -f $_.Brand, $_.From, $_.To, $_.ClashWith) }
}

if ($tgtDropped.Count -gt 0) {
    Write-Host ''
    Write-Host ('== การผูกฟอร์มที่ถูกตัด เพราะสาขาไม่ถูก seed ({0}) ==' -f $tgtDropped.Count) -ForegroundColor Yellow
    $tgtDropped | Group-Object Form | Sort-Object Name | ForEach-Object {
        Write-Host ("   {0,-8} {1,3} สาขา : {2}" -f $_.Name, $_.Count, (($_.Group.Branch | Sort-Object) -join ', '))
    }
}

Write-Host ''
Write-Host ('== สาขาที่ถูกตัดออกด้วย blocklist ({0}) - โปรด review ==' -f $skipped.Count) -ForegroundColor Yellow
$skipped | Sort-Object Brand, Code | ForEach-Object { Write-Host ("   {0,-3} {1,-14} {2}" -f $_.Brand, $_.Code, $_.Name) }

Write-Host ''
Write-Host 'ขั้นต่อไป - ทดสอบแบบ rollback:' -ForegroundColor Cyan
Write-Host '   sqlcmd -S <server> -U qsc_sys -P <password> -d QSCDB -C -v DryRun=1 -i seed-legacy-master.sql'
