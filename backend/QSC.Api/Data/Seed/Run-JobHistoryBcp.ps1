<#
    Run-JobHistoryBcp.ps1 -- step 4 of README.md

    Moves raw JobHead/JobDetail from PI_QSC (legacy system) into the staging
    tables in QSCDB. Source and target live on the SAME server
    (192.168.11.1,1319) but need different logins:
      PI_QSC  readable only by claude_user (qsc_sys is denied - Msg 916)
      QSCDB   writable only by qsc_sys     (claude_user cannot log in)
    So the data still has to go through .dat files as README describes;
    a cross-database INSERT..SELECT is not possible.

    Why CAST on export: bcp native (-N) requires the source types to match the
    destination table exactly, and three columns currently differ --
      JobHead.Comment     varchar(max)  -> nvarchar(max)
      JobHead.criterion   decimal(18,2) -> decimal(5,2)   (every row is 0.85)
      JobDetail.comment   varchar(250)  -> nvarchar(500)

    Run seed-job-history-setup.sql (step 3) first, or the staging tables
    will not exist.

    The .dat files hold real branch-manager names and comments. This script
    deletes them when it finishes (.gitignore already covers Data/Seed/*.dat).

    NOTE: keep this file pure ASCII. Windows PowerShell 5.1 reads a UTF-8 file
    without BOM as ANSI, which turns non-ASCII comments into parse errors.
#>

[CmdletBinding()]
param(
    [string] $Server       = '192.168.11.1,1319',
    [string] $SourceDb     = 'PI_QSC',
    [string] $TargetDb     = 'QSCDB',
    [string] $SourceUser   = 'claude_user',
    [Parameter(Mandatory=$true)] [string] $SourcePass,
    [string] $TargetUser   = 'qsc_sys',
    [Parameter(Mandatory=$true)] [string] $TargetPass,
    [string] $WorkDir      = $PSScriptRoot,
    [switch] $KeepDatFiles
)

$ErrorActionPreference = 'Stop'

$binn   = Join-Path ${env:ProgramFiles} 'Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn'
$bcp    = Join-Path $binn 'bcp.exe'
$sqlcmd = Join-Path $binn 'SQLCMD.EXE'
if (-not (Test-Path $bcp)) { throw "bcp.exe not found at $bcp" }

$headDat   = Join-Path $WorkDir 'jobhead.dat'
$detailDat = Join-Path $WorkDir 'jobdetail.dat'

# Column order must match stg_JobHead / stg_JobDetail exactly: bcp native
# matches by position, not by name.
$headQuery = @"
SELECT JobId, Branch_Code, As_code, CheckBy, latOn, lonOn, CheckOn, CheckOut,
       latColse, lonColse, managerName, empNum,
       CAST(Comment AS nvarchar(max)) AS Comment,
       CAST(criterion AS decimal(5,2)) AS criterion
FROM   $SourceDb.dbo.JobHead
"@

$detailQuery = @"
SELECT JobId, Toppic_num, Subtoppic_no, IsCheck, IsNotCheck,
       CAST(comment AS nvarchar(500)) AS comment,
       scoreGet, tsCode
FROM   $SourceDb.dbo.JobDetail
"@

function Invoke-Bcp {
    param([string[]] $Arguments, [string] $Label)

    Write-Host "  -> $Label"
    $out = & $bcp @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        $out | ForEach-Object { Write-Host "     $_" }
        throw "$Label failed (exit $LASTEXITCODE)"
    }
    $out | Where-Object { $_ -match 'rows copied|Average|Error|error' } |
        ForEach-Object { Write-Host "     $_" }
}

try {
    Write-Host "=== 1. export JobHead from $SourceDb ==="
    Invoke-Bcp -Label 'JobHead -> jobhead.dat' -Arguments @(
        $headQuery, 'queryout', $headDat,
        '-S', $Server, '-U', $SourceUser, '-P', $SourcePass, '-d', $SourceDb, '-N'
    )

    Write-Host "=== 2. export JobDetail from $SourceDb (523k rows, takes a while) ==="
    Invoke-Bcp -Label 'JobDetail -> jobdetail.dat' -Arguments @(
        $detailQuery, 'queryout', $detailDat,
        '-S', $Server, '-U', $SourceUser, '-P', $SourcePass, '-d', $SourceDb, '-N'
    )

    Write-Host "=== 3. import into $TargetDb.dbo.stg_JobHead ==="
    Invoke-Bcp -Label 'jobhead.dat -> stg_JobHead' -Arguments @(
        "$TargetDb.dbo.stg_JobHead", 'in', $headDat,
        '-S', $Server, '-U', $TargetUser, '-P', $TargetPass, '-N'
    )

    Write-Host "=== 4. import into $TargetDb.dbo.stg_JobDetail ==="
    Invoke-Bcp -Label 'jobdetail.dat -> stg_JobDetail' -Arguments @(
        "$TargetDb.dbo.stg_JobDetail", 'in', $detailDat,
        '-S', $Server, '-U', $TargetUser, '-P', $TargetPass, '-N', '-b', '10000'
    )

    Write-Host "=== 5. row counts ==="
    & $sqlcmd -S $Server -U $TargetUser -P $TargetPass -d $TargetDb -C -b -W -Q "SELECT 'stg_JobHead' AS tbl, COUNT(*) AS rows_loaded FROM dbo.stg_JobHead UNION ALL SELECT 'stg_JobDetail', COUNT(*) FROM dbo.stg_JobDetail;"
}
finally {
    if (-not $KeepDatFiles) {
        foreach ($f in @($headDat, $detailDat)) {
            if (Test-Path $f) {
                Remove-Item -LiteralPath $f -Force
                Write-Host ("removed temp file: " + (Split-Path -Leaf $f))
            }
        }
    } else {
        Write-Warning "Keeping .dat files as requested -- they hold real data, do not commit them."
    }
}
