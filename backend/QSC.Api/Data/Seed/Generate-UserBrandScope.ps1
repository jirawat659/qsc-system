<#
    Generate-UserBrandScope.ps1 -- generates seed-user-brandscope.sql

    Purpose: give every user a brand scope limited to the brands they are
    responsible for. Only 'admin' keeps BrandScope = 'ALL'.

    How the app reads this (Controllers/AuthController.cs:89-105):
      BrandScope = 'ALL'       -> sees every brand; UserBrands is never read
      BrandScope = 'SPECIFIC'  -> reads UserBrands, returns allowedBrandIds
    Setting SPECIFIC with no UserBrands rows means the user sees ZERO brands,
    so the generated script does both in one transaction.

    Two source signals, unioned:
      1. Brands actually audited  -- QSCDB.AuditRecords -> LocationBrands -> Brands
      2. IsQSC = 1 in each brand's own A_User table (legacy permission flag)

    Neither source is complete on its own:
      - 17302 (1240 audits) and 18127 (1049 audits) are the two busiest
        auditors in the system yet carry IsQSC = 1 in NO database.
      - 12 users carry IsQSC = 1 but have never audited anything.
    Hence the union.

    A01 / A02 are deliberately excluded from the MikkaDB result: both are
    legacy system-admin accounts ("IT Admin" / "Operation Admin"), so their
    IsQSC flag in MikkaDB is an admin permission, not real MK audit work.
    They keep AU only, from their actual audit history.

    Read-only against every source database. Writes one .sql file.

    NOTE: keep this file pure ASCII. Windows PowerShell 5.1 reads a UTF-8 file
    without BOM as ANSI, which turns non-ASCII characters into parse errors.
#>

[CmdletBinding()]
param(
    [string] $ProdServer   = '192.168.11.1,1319',
    [string] $ProdDb       = 'QSCDB',
    [string] $ProdUser     = 'qsc_sys',
    [Parameter(Mandatory=$true)] [string] $ProdPass,
    [string] $LegacyUser   = 'claude_user',
    [Parameter(Mandatory=$true)] [string] $LegacyPass,
    [string] $OutFile,
    [string] $WorkDir
)

$ErrorActionPreference = 'Stop'

if (-not $WorkDir) {
    $WorkDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
}
if (-not $OutFile) { $OutFile = Join-Path $WorkDir 'seed-user-brandscope.sql' }

$binn   = Join-Path ${env:ProgramFiles} 'Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn'
$sqlcmd = Join-Path $binn 'SQLCMD.EXE'
if (-not (Test-Path $sqlcmd)) { throw "SQLCMD.EXE not found at $sqlcmd" }

# Each brand's own database, and which QSC brand codes it maps to.
# SCRDB holds three brands that share one checklist (form OP009).
$sources = @(
    @{ Server = '192.168.11.1,1319'; Db = 'AUDB';    Brands = @('AU') },
    @{ Server = '192.168.11.1,1319'; Db = 'LGDB';    Brands = @('LG') },
    @{ Server = '192.168.20.5,4488'; Db = 'MikkaDB'; Brands = @('MK') },
    @{ Server = '192.168.20.5,4488'; Db = 'SCRDB';   Brands = @('SCR','SD','SAM') }
)

# Legacy system-admin accounts: their IsQSC flag is an admin permission,
# not evidence of audit work on that brand. Excluded per database.
$isQscBlocklist = @{
    'MikkaDB' = @('A01','A02')
}

function Invoke-Scalar {
    param([string] $Server, [string] $Db, [string] $User, [string] $Pass, [string] $Query)

    $out = & $sqlcmd -S $Server -U $User -P $Pass -d $Db -C -b -h -1 -W -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) {
        $out | ForEach-Object { Write-Host "     $_" }
        throw "query against $Db failed (exit $LASTEXITCODE)"
    }
    # -h -1 still emits a trailing "(n rows affected)" line; drop noise lines.
    $out | ForEach-Object { "$_".Trim() } |
        Where-Object { $_ -ne '' -and $_ -notmatch '^\(\d+ rows? affected\)$' }
}

# ---------------------------------------------------------------------------
# 1. brands each user is flagged for in the legacy per-brand databases
# ---------------------------------------------------------------------------
Write-Host "=== 1. reading IsQSC = 1 from each brand database ==="
$fromFlag = @{}   # username -> hashset of brand codes

foreach ($s in $sources) {
    $blocked = @()
    if ($isQscBlocklist.ContainsKey($s.Db)) { $blocked = $isQscBlocklist[$s.Db] }

    # DISTINCT is required: LOGON_NAME repeats across rows in A_User.
    $names = Invoke-Scalar -Server $s.Server -Db $s.Db -User $LegacyUser -Pass $LegacyPass `
        -Query "SET NOCOUNT ON; SELECT DISTINCT LOGON_NAME FROM dbo.A_User WHERE IsQSC = 1;"

    $kept = 0
    foreach ($n in $names) {
        if ($blocked -contains $n) {
            Write-Host ("     skip $n (blocklisted for " + $s.Db + ": legacy admin account)")
            continue
        }
        if (-not $fromFlag.ContainsKey($n)) { $fromFlag[$n] = New-Object System.Collections.Generic.HashSet[string] }
        foreach ($b in $s.Brands) { [void]$fromFlag[$n].Add($b) }
        $kept++
    }
    Write-Host ("  " + $s.Db.PadRight(9) + " -> " + ($s.Brands -join ',').PadRight(12) + " $kept users")
}

# ---------------------------------------------------------------------------
# 2. brands each user has actually audited, from production
# ---------------------------------------------------------------------------
Write-Host "=== 2. reading audited brands from $ProdDb ==="
$auditedRows = Invoke-Scalar -Server $ProdServer -Db $ProdDb -User $ProdUser -Pass $ProdPass -Query @"
SET NOCOUNT ON;
SELECT u.Username + '|' + b.Code
FROM   Users u
JOIN   AuditRecords   ar ON ar.PrimaryAuditorId = u.Id
JOIN   LocationBrands lb ON lb.LocationId       = ar.LocationId
JOIN   Brands         b  ON b.Id                = lb.BrandId
GROUP  BY u.Username, b.Code;
"@

$fromAudit = @{}
foreach ($row in $auditedRows) {
    $p = $row -split '\|'
    if ($p.Count -ne 2) { continue }
    $u = $p[0].Trim(); $b = $p[1].Trim()
    if (-not $fromAudit.ContainsKey($u)) { $fromAudit[$u] = New-Object System.Collections.Generic.HashSet[string] }
    [void]$fromAudit[$u].Add($b)
}
Write-Host ("  " + $fromAudit.Count + " users have audit history")

# ---------------------------------------------------------------------------
# 3. users already in production, and the brand code -> id map
# ---------------------------------------------------------------------------
Write-Host "=== 3. reading existing users and brands from $ProdDb ==="
$existing = Invoke-Scalar -Server $ProdServer -Db $ProdDb -User $ProdUser -Pass $ProdPass `
    -Query "SET NOCOUNT ON; SELECT Username FROM Users;"
$existingSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($e in $existing) { [void]$existingSet.Add($e) }

$brandCodes = Invoke-Scalar -Server $ProdServer -Db $ProdDb -User $ProdUser -Pass $ProdPass `
    -Query "SET NOCOUNT ON; SELECT Code FROM Brands;"
$knownBrands = New-Object System.Collections.Generic.HashSet[string]
foreach ($c in $brandCodes) { [void]$knownBrands.Add($c) }
Write-Host ("  " + $existingSet.Count + " users, " + $knownBrands.Count + " brands: " + (($knownBrands | Sort-Object) -join ','))

# ---------------------------------------------------------------------------
# 4. union the two signals
# ---------------------------------------------------------------------------
# 'admin' keeps BrandScope = 'ALL' and is never touched.
# 'test1'/'test2' were set up by hand and are left alone.
$untouched = @('admin','test1','test2')

$allNames = New-Object System.Collections.Generic.HashSet[string]
foreach ($k in $fromFlag.Keys)  { [void]$allNames.Add($k) }
foreach ($k in $fromAudit.Keys) { [void]$allNames.Add($k) }
foreach ($u in $untouched)      { [void]$allNames.Remove($u) }

$plan = @()
foreach ($name in ($allNames | Sort-Object)) {
    $brands = New-Object System.Collections.Generic.HashSet[string]
    if ($fromAudit.ContainsKey($name)) { foreach ($b in $fromAudit[$name]) { [void]$brands.Add($b) } }
    if ($fromFlag.ContainsKey($name))  { foreach ($b in $fromFlag[$name])  { [void]$brands.Add($b) } }

    # Business rule (2026-09-23): After You auditors see every real brand except
    # Mikka. Anyone whose derived set includes AU also gets LG, SAM, SCR, SD.
    # MK is deliberately not added. Same rule as seed-user-brandscope-au-extend.sql,
    # kept here so re-running this generator does not undo it.
    if ($brands.Contains('AU')) {
        foreach ($b in @('LG','SAM','SCR','SD')) { [void]$brands.Add($b) }
    }

    $unknown = @($brands | Where-Object { -not $knownBrands.Contains($_) })
    if ($unknown.Count -gt 0) { throw "user $name maps to unknown brand(s): $($unknown -join ',')" }
    if ($brands.Count -eq 0)  { throw "user $name resolved to zero brands" }

    $plan += [pscustomobject]@{
        Username = $name
        Brands   = @($brands | Sort-Object)
        IsNew    = -not $existingSet.Contains($name)
    }
}

$newUsers  = @($plan | Where-Object { $_.IsNew })
$totalRows = ($plan | ForEach-Object { $_.Brands.Count } | Measure-Object -Sum).Sum

Write-Host "=== 4. plan ==="
Write-Host ("  users        : " + $plan.Count)
Write-Host ("  new users    : " + $newUsers.Count + "  " + (($newUsers | ForEach-Object { $_.Username }) -join ', '))
Write-Host ("  UserBrands   : " + $totalRows + " rows")
$perBrand = @{}
foreach ($p in $plan) { foreach ($b in $p.Brands) { if (-not $perBrand.ContainsKey($b)) { $perBrand[$b] = 0 }; $perBrand[$b]++ } }
Write-Host ("  per brand    : " + (($perBrand.Keys | Sort-Object | ForEach-Object { "$_=" + $perBrand[$_] }) -join ' '))
foreach ($b in ($knownBrands | Sort-Object)) {
    if (-not $perBrand.ContainsKey($b)) { Write-Warning "brand $b has NO user other than admin" }
}

# ---------------------------------------------------------------------------
# 5. BCrypt hashes for the new users
# ---------------------------------------------------------------------------
$hashes = @{}
if ($newUsers.Count -gt 0) {
    Write-Host "=== 5. generating BCrypt hashes for new users ==="
    $genDir = Join-Path $WorkDir '.hashgen'
    New-Item -ItemType Directory -Force -Path $genDir | Out-Null

    # Work factor 11 matches the existing 'admin' hash ($2a$11$) and
    # DatabaseSeeder's default, so every hash in Users stays consistent.
    @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="BCrypt.Net-Next" Version="4.2.0" />
  </ItemGroup>
</Project>
'@ | Set-Content -Path (Join-Path $genDir 'hashgen.csproj') -Encoding ascii

    @'
// reads one username per line, prints "username<TAB>hash<TAB>verified"
string line;
while ((line = Console.ReadLine()) != null)
{
    var u = line.Trim();
    if (u.Length == 0) continue;
    var pw = u + "@change";
    var hash = BCrypt.Net.BCrypt.HashPassword(pw, 11);
    // self-check: right password accepted, wrong password rejected
    var good = BCrypt.Net.BCrypt.Verify(pw, hash);
    var bad  = BCrypt.Net.BCrypt.Verify(u + "@wrong", hash);
    Console.WriteLine($"{u}\t{hash}\t{(good && !bad ? "OK" : "FAIL")}");
}
'@ | Set-Content -Path (Join-Path $genDir 'Program.cs') -Encoding ascii

    Push-Location $genDir
    try {
        & dotnet build -v q --nologo | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "dotnet build of the hash generator failed" }
        $names = ($newUsers | ForEach-Object { $_.Username }) -join "`n"
        $out = $names | & dotnet run --no-build
        if ($LASTEXITCODE -ne 0) { throw "dotnet run of the hash generator failed" }
    } finally { Pop-Location }

    foreach ($l in $out) {
        $p = "$l" -split "`t"
        if ($p.Count -ne 3) { continue }
        if ($p[2].Trim() -ne 'OK') { throw "hash self-check failed for $($p[0])" }
        $hashes[$p[0].Trim()] = $p[1].Trim()
    }
    if ($hashes.Count -ne $newUsers.Count) {
        throw "expected $($newUsers.Count) hashes, got $($hashes.Count)"
    }
    Write-Host ("  " + $hashes.Count + " hashes generated, all self-checked")
    Remove-Item -Recurse -Force $genDir -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# 6. write the SQL
# ---------------------------------------------------------------------------
Write-Host "=== 6. writing $OutFile ==="
$sb = New-Object System.Text.StringBuilder
function Add-Line { param([string] $Text = '') [void]$sb.AppendLine($Text) }

Add-Line '/* ============================================================================='
Add-Line '   seed-user-brandscope.sql   (generated by Generate-UserBrandScope.ps1)'
Add-Line '   DO NOT EDIT BY HAND -- change the generator and regenerate.'
Add-Line ''
Add-Line '   Limits every user to the brands they are responsible for.'
Add-Line "   Only 'admin' keeps BrandScope = 'ALL'."
Add-Line ''
Add-Line '   Brand set per user = union of two signals:'
Add-Line '     - brands actually audited (QSCDB.AuditRecords)'
Add-Line "     - IsQSC = 1 in each brand's own A_User table"
Add-Line '   Neither is complete alone: the two busiest auditors (17302, 18127)'
Add-Line '   carry no IsQSC flag anywhere, and 12 flagged users never audited.'
Add-Line ''
Add-Line '   A01 / A02 are excluded from the MikkaDB flag: they are legacy'
Add-Line '   system-admin accounts, so that flag is an admin permission rather'
Add-Line '   than real MK audit work. They keep AU from their audit history.'
Add-Line ''
Add-Line '   AuthController.cs:89-105 reads this as:'
Add-Line "     BrandScope 'ALL'      -> every brand, UserBrands ignored"
Add-Line "     BrandScope 'SPECIFIC' -> UserBrands rows become allowedBrandIds"
Add-Line '   SPECIFIC with no UserBrands rows means ZERO brands, so both changes'
Add-Line '   happen in one transaction here.'
Add-Line ''
Add-Line ("   Generated : " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add-Line ("   Users     : " + $plan.Count + " (" + $newUsers.Count + " new)")
Add-Line ("   UserBrands: " + $totalRows + " rows")
Add-Line ''
Add-Line '   How to run'
Add-Line '     dry run  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i seed-user-brandscope.sql'
Add-Line '     for real sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i seed-user-brandscope.sql'
Add-Line '============================================================================= */'
Add-Line ''
Add-Line 'SET NOCOUNT ON;'
Add-Line 'SET XACT_ABORT ON;'
Add-Line ''
Add-Line "DECLARE @DryRun bit = CASE WHEN '`$(DryRun)' = '0' THEN 0 ELSE 1 END;"
Add-Line "PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - rolls everything back at the end ***'"
Add-Line "                            ELSE '*** LIVE RUN - commits ***' END;"
Add-Line ''
Add-Line 'BEGIN TRANSACTION;'
Add-Line ''
Add-Line 'DECLARE @AuditorRoleId int = (SELECT Id FROM Roles WHERE Code = %ROLE%);'
Add-Line "IF @AuditorRoleId IS NULL THROW 50040, 'role AUDITOR not found', 1;"
Add-Line ''
Add-Line '/* target list: username -> brand codes, plus a hash for users to create */'
Add-Line 'DECLARE @Target TABLE ('
Add-Line '    Username     nvarchar(100) NOT NULL,'
Add-Line '    BrandCode    nvarchar(10)  NOT NULL,'
Add-Line '    PRIMARY KEY (Username, BrandCode)'
Add-Line ');'
Add-Line 'DECLARE @NewUser TABLE ('
Add-Line '    Username     nvarchar(100) PRIMARY KEY,'
Add-Line '    FullName     nvarchar(200) NOT NULL,'
Add-Line '    PasswordHash nvarchar(200) NOT NULL'
Add-Line ');'
Add-Line ''

Add-Line 'INSERT INTO @Target (Username, BrandCode) VALUES'
$pairs = @()
foreach ($p in $plan) {
    foreach ($b in $p.Brands) {
        $pairs += ("    (N'" + $p.Username.Replace("'","''") + "', N'" + $b + "')")
    }
}
Add-Line (($pairs -join ",`r`n") + ';')
Add-Line ''

if ($newUsers.Count -gt 0) {
    Add-Line '/* users flagged IsQSC = 1 in the legacy system but absent from QSCDB.'
    Add-Line "   Password is {username}@change, BCrypt work factor 11, MustChangePassword = 1"
    Add-Line '   so the app forces a new password on first login. */'
    Add-Line 'INSERT INTO @NewUser (Username, FullName, PasswordHash) VALUES'
    $rows = @()
    foreach ($n in $newUsers) {
        $u = $n.Username.Replace("'","''")
        $h = $hashes[$n.Username].Replace("'","''")
        $rows += ("    (N'" + $u + "', N'" + $u + "', N'" + $h + "')")
    }
    Add-Line (($rows -join ",`r`n") + ';')
    Add-Line ''
    Add-Line "PRINT 'creating users that are missing from QSCDB';"
    Add-Line 'INSERT INTO Users (Username, PasswordHash, FullName, RoleId, BranchScope, BrandScope,'
    Add-Line '                   MustChangePassword, IsActive, CreatedAt)'
    Add-Line "SELECT n.Username, n.PasswordHash, n.FullName, @AuditorRoleId, 'ALL', 'SPECIFIC',"
    Add-Line '       1, 1, SYSUTCDATETIME()'
    Add-Line 'FROM   @NewUser n'
    Add-Line 'WHERE  NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = n.Username);'
    Add-Line ''
}

Add-Line "PRINT 'before:';"
Add-Line "SELECT BrandScope AS [scope], COUNT(*) AS [users] FROM Users GROUP BY BrandScope;"
Add-Line ''
Add-Line "PRINT 'setting BrandScope = SPECIFIC for every targeted user';"
Add-Line 'UPDATE u'
Add-Line "SET    u.BrandScope = 'SPECIFIC',"
Add-Line '       u.UpdatedAt  = SYSUTCDATETIME()'
Add-Line 'FROM   Users u'
Add-Line 'WHERE  EXISTS (SELECT 1 FROM @Target t WHERE t.Username = u.Username)'
Add-Line "AND    u.BrandScope <> 'SPECIFIC';"
Add-Line ''
Add-Line "PRINT 'replacing UserBrands for those users';"
Add-Line '/* delete first so re-running produces exactly the generated set */'
Add-Line 'DELETE ub'
Add-Line 'FROM   UserBrands ub'
Add-Line 'JOIN   Users u ON u.Id = ub.UserId'
Add-Line 'WHERE  EXISTS (SELECT 1 FROM @Target t WHERE t.Username = u.Username);'
Add-Line ''
Add-Line 'INSERT INTO UserBrands (UserId, BrandId, CreatedAt)'
Add-Line 'SELECT u.Id, b.Id, SYSUTCDATETIME()'
Add-Line 'FROM   @Target t'
Add-Line 'JOIN   Users  u ON u.Username = t.Username'
Add-Line 'JOIN   Brands b ON b.Code     = t.BrandCode;'
Add-Line ''
Add-Line '/* legacy-import is the placeholder for audit GUIDs that could not be'
Add-Line '   resolved to a real person (236 jobs). Nobody signs in as it, so keep'
Add-Line '   the account disabled while leaving its UserBrands row in place so'
Add-Line '   reports still attribute that history correctly. */'
Add-Line "PRINT 'disabling the legacy-import placeholder account';"
Add-Line 'UPDATE Users'
Add-Line 'SET    IsActive = 0, UpdatedAt = SYSUTCDATETIME()'
Add-Line "WHERE  Username = N'legacy-import' AND IsActive <> 0;"
Add-Line ''
Add-Line "PRINT 'after:';"
Add-Line 'SELECT u.Username, u.BrandScope, u.IsActive,'
Add-Line "       STUFF((SELECT ',' + b.Code FROM UserBrands ub JOIN Brands b ON b.Id = ub.BrandId"
Add-Line "              WHERE ub.UserId = u.Id ORDER BY b.Code FOR XML PATH('')), 1, 1, '') AS brands"
Add-Line 'FROM   Users u ORDER BY u.Username;'
Add-Line ''
Add-Line 'SELECT b.Code AS [brand], COUNT(ub.UserId) AS [users]'
Add-Line 'FROM   Brands b LEFT JOIN UserBrands ub ON ub.BrandId = b.Id'
Add-Line 'GROUP  BY b.Code ORDER BY b.Code;'
Add-Line ''
Add-Line '/* validation -- every number must be 0 */'
Add-Line 'SELECT'
Add-Line "  (SELECT COUNT(*) FROM Users u WHERE u.BrandScope = 'SPECIFIC'"
Add-Line '     AND NOT EXISTS (SELECT 1 FROM UserBrands ub WHERE ub.UserId = u.Id))          AS [specific_with_no_brand],'
Add-Line "  (SELECT COUNT(*) FROM Users WHERE BrandScope = 'ALL' AND Username <> N'admin')   AS [all_scope_not_admin],"
Add-Line '  (SELECT COUNT(*) FROM UserBrands ub'
Add-Line '     WHERE NOT EXISTS (SELECT 1 FROM Brands b WHERE b.Id = ub.BrandId))            AS [orphan_brand_link],'
Add-Line '  (SELECT COUNT(*) FROM @Target t'
Add-Line '     WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = t.Username))       AS [target_user_missing],'
Add-Line "  (SELECT COUNT(*) FROM Users WHERE PasswordHash NOT LIKE '`$2%')                   AS [hash_unusable];"
Add-Line ''
Add-Line 'IF @DryRun = 1'
Add-Line 'BEGIN'
Add-Line '    ROLLBACK TRANSACTION;'
Add-Line "    PRINT '*** DRY RUN finished - rolled back, nothing was saved ***';"
Add-Line 'END'
Add-Line 'ELSE'
Add-Line 'BEGIN'
Add-Line '    COMMIT TRANSACTION;'
Add-Line "    PRINT '*** COMMITTED ***';"
Add-Line 'END'

# %ROLE% avoids embedding a quoted literal inside a PowerShell string that
# already uses both quote styles above.
$sql = $sb.ToString().Replace('%ROLE%', "'AUDITOR'")
[System.IO.File]::WriteAllText($OutFile, $sql, (New-Object System.Text.UTF8Encoding $true))

Write-Host ("  wrote " + ([System.IO.File]::ReadAllLines($OutFile).Count) + " lines")
Write-Host ""
Write-Host "Next: dry run it, check every validation column is 0, then run with -v DryRun=0"
