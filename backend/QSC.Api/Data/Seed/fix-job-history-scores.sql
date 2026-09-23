/* =============================================================================
   fix-job-history-scores.sql   (มือ — ไม่ใช่ไฟล์ generated)

   แก้คะแนนงานตรวจประวัติที่ import ด้วย seed-job-history-import.sql เวอร์ชันเก่า
   ใช้เฉพาะกับ DB ที่ import ไปแล้วก่อนแก้สคริปต์ import (22 ก.ย. 2026) — DB ที่ import
   ด้วยสคริปต์เวอร์ชันใหม่ไม่ต้องรันไฟล์นี้

   ต้นเหตุ: JobDetail.scoreGet ของระบบเดิมคือ "คะแนนของข้อนั้น" ซึ่งเก็บไว้ทุกแถว
   ไม่ว่าข้อนั้นผ่านหรือไม่ผ่าน ระบบเดิมคิดคะแนนเป็น
       SUM(scoreGet ข้อผ่าน) / SUM(scoreGet ทุกข้อที่ไม่ใช่ N/A)
   แต่ import เวอร์ชันเก่าตีความ scoreGet เป็น "คะแนนที่ได้" จึงผิด 2 จุด
     1. ข้อที่ไม่ผ่านได้คะแนนไปด้วย (ตัวตั้งเกิน)
     2. คะแนนเต็มรายข้อใช้ MAX(scoreGet) ตลอดประวัติ แต่ระบบเดิมเคยปรับคะแนนของ
        ข้อเดิมหลายรอบ (เช่น OP006 ข้อ 1.3 เคยเป็น 1 → 5 → 3 → 2) ตัวหารจึงเกิน
   ตัวอย่าง: ASB 19 ก.ย. 2026 ฟอร์ม Booth, Mini Shop ระบบเดิม 267/285 = 93.68%
   import เก่าได้ 285/341 = 83.58% แล้วตกเกณฑ์ 85% กลายเป็น "ไม่ผ่าน"

   แก้อะไรบ้าง (คิดใหม่จาก staging table ที่ยังอยู่ ไม่ต้อง import ใหม่ Id งานไม่เปลี่ยน)
     - AuditRecords  TotalScore / MaxScore / PercentageScore / IsPassed  ตามสูตรระบบเดิม
                     (คิดจาก JobDetail ทุกแถว ตรงระบบเดิม 100%)
     - AuditResponses.ScoreGiven  ข้อผ่าน = scoreGet, ไม่ผ่าน/N/A = 0 (แบบเดียวกับแอป)
     - SurveyItems.FullScore ของฟอร์มประวัติ = ค่า scoreGet ที่พบบ่อยที่สุดของข้อนั้น
       (เสมอกันเลือกค่าที่ใช้ล่าสุด) — ตรง ~93.65% ของรายข้อ ที่เหลือคืองานช่วงที่
       ฟอร์มเคยใช้คะแนนอื่น ระบบใหม่เก็บคะแนนเต็มไว้ที่ตัวคำถาม 1 ค่าต่อข้อ จึงตรง
       ทุกยุคไม่ได้ (คะแนนรวมไม่กระทบ เพราะคิดจาก staging ตรงๆ)
     - Locations.LastScore / LastAuditDate  = งานล่าสุด ตามตรรกะเดียวกับ
       LocationStatsHelper.UpdateLocationLastAuditStatsAsync
     - AuditRecords.AiAnalysisJson  ล้างทิ้งเฉพาะงานที่คะแนนเปลี่ยน (อ้างคะแนนเก่า)
       ระบบจะสร้างใหม่เมื่อมีคนเปิดดู

   ไม่แตะ UpdatedAt — หน้าประวัติใช้ค่านี้แสดงว่างานถูกแก้ไข ซึ่งไม่ใช่กรณีนี้

   เก็บค่าเดิมไว้ใน 4 ตาราง bak_fixscore_* (สร้างเฉพาะตอน DryRun=0) ย้อนกลับได้ถ้าจำเป็น

   ต้องมี stg_JobHead / stg_JobDetail (จาก Run-JobHistoryBcp.ps1) อยู่ใน DB
   ไม่มีตัวอักษรไทยใน string literal เลย จึงรันได้ไม่ว่า sqlcmd จะอ่าน encoding แบบไหน

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=1 -i fix-job-history-scores.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=0 -i fix-job-history-scores.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - rolls everything back at the end ***'
                            ELSE '*** LIVE RUN - commits ***' END;

IF OBJECT_ID('dbo.stg_JobHead') IS NULL OR OBJECT_ID('dbo.stg_JobDetail') IS NULL
    THROW 50060, 'stg_JobHead / stg_JobDetail not found - run Run-JobHistoryBcp.ps1 first', 1;

BEGIN TRANSACTION;

/* -------------------------------------------------------------------------
   0. ฟอร์มประวัติ (เวอร์ชัน legacy-history + ฟอร์มเดี่ยว OP001/OP002/OP005)
   ------------------------------------------------------------------------- */
CREATE TABLE #HistForm (FormId int PRIMARY KEY);
INSERT INTO #HistForm (FormId)
SELECT Id FROM SurveyForms
WHERE  Version = 'legacy-history' OR Title LIKE '% (legacy-history)';

/* -------------------------------------------------------------------------
   1. คะแนนต่องานตามสูตรระบบเดิม — คิดจาก JobDetail ทุกแถวของงาน
      (รวม 24 แถวของ OP004 ที่ไม่มีเลขข้อ ซึ่ง import ข้ามไปเพราะไม่รู้ว่าเป็นข้อไหน
       แต่ระบบเดิมนับเข้าคะแนน)
      N/A = ไม่ได้ติ๊กทั้งผ่านและไม่ผ่าน → ไม่นับทั้งตัวตั้งและตัวหาร
   ------------------------------------------------------------------------- */
CREATE TABLE #Job (
    JobId       uniqueidentifier NOT NULL PRIMARY KEY,
    Branch_Code varchar(10)      NOT NULL,
    As_code     varchar(50)      NULL,
    dt          datetime         NULL,
    criterion   decimal(5,2)     NULL,
    Got         float            NOT NULL,
    FullPts     float            NOT NULL
);
INSERT INTO #Job (JobId, Branch_Code, As_code, dt, criterion, Got, FullPts)
SELECT h.JobId, h.Branch_Code, h.As_code, COALESCE(h.CheckOn, h.CheckOut), h.criterion,
       ISNULL(SUM(CASE WHEN d.IsCheck = 1 THEN d.scoreGet ELSE 0 END), 0),
       ISNULL(SUM(CASE WHEN ISNULL(d.IsCheck, 0) = 0 AND ISNULL(d.IsNotCheck, 0) = 0 THEN 0
                       ELSE ISNULL(d.scoreGet, 0) END), 0)
FROM   stg_JobHead h
LEFT   JOIN stg_JobDetail d ON d.JobId = h.JobId
GROUP  BY h.JobId, h.Branch_Code, h.As_code, COALESCE(h.CheckOn, h.CheckOut), h.criterion;

/* -------------------------------------------------------------------------
   2. จับคู่งานเดิม (JobId) → งานใหม่ (AuditRecords.Id)
      import ไม่ได้เก็บ JobId ไว้ จึงจับด้วย สาขา + เวลาเริ่มตรวจ + ฟอร์มประวัติ
      ต้องยอมคลาด ≤ 1 วินาที เพราะ datetime (staging) กับ datetime2 (AuditDate)
      ปัดเศษมิลลิวินาทีต่างกัน — เทียบเท่ากันตรงๆ จับได้แค่ ~40%
   ------------------------------------------------------------------------- */
CREATE TABLE #MapRaw (JobId uniqueidentifier NOT NULL, AuditRecordId int NOT NULL, FormId int NOT NULL);
INSERT INTO #MapRaw (JobId, AuditRecordId, FormId)
SELECT j.JobId, ar.Id, ar.SurveyFormId
FROM   #Job j
JOIN   Locations    l  ON l.Code = j.Branch_Code
JOIN   AuditRecords ar ON ar.LocationId = l.Id
                      /* เงื่อนไขช่วงแทน DATEDIFF(millisecond) — DATEDIFF ล้นเมื่อ
                         เทียบคู่ที่ห่างกันหลายปีก่อนถูกกรองออก */
                      AND ar.AuditDate BETWEEN DATEADD(second, -1, CAST(j.dt AS datetime2))
                                           AND DATEADD(second,  1, CAST(j.dt AS datetime2))
JOIN   #HistForm    hf ON hf.FormId = ar.SurveyFormId;

DECLARE @Jobs int = (SELECT COUNT(*) FROM #Job);
DECLARE @Mapped int = (SELECT COUNT(DISTINCT JobId) FROM #MapRaw);
IF @Mapped <> @Jobs
    THROW 50061, 'some legacy jobs did not match exactly one AuditRecord - aborting', 1;
IF EXISTS (SELECT 1 FROM #MapRaw GROUP BY JobId HAVING COUNT(*) > 1)
    THROW 50062, 'a legacy job matched more than one AuditRecord - aborting', 1;
IF EXISTS (SELECT 1 FROM #MapRaw GROUP BY AuditRecordId HAVING COUNT(*) > 1)
    THROW 50063, 'an AuditRecord matched more than one legacy job - aborting', 1;

CREATE TABLE #Map (JobId uniqueidentifier NOT NULL PRIMARY KEY, AuditRecordId int NOT NULL UNIQUE, FormId int NOT NULL);
INSERT INTO #Map SELECT JobId, AuditRecordId, FormId FROM #MapRaw;

/* As_code → ฟอร์มประวัติ ได้จากงานที่จับคู่แล้ว (ไม่ต้องอ้างชื่อฟอร์มภาษาไทย)
   แต่ละ As_code ต้องชี้ฟอร์มเดียว */
IF EXISTS (SELECT 1 FROM #Job j JOIN #Map m ON m.JobId = j.JobId
           GROUP BY j.As_code HAVING COUNT(DISTINCT m.FormId) > 1)
    THROW 50064, 'an As_code maps to more than one history form - aborting', 1;

CREATE TABLE #AsForm (As_code varchar(50) NOT NULL PRIMARY KEY, FormId int NOT NULL);
INSERT INTO #AsForm (As_code, FormId)
SELECT j.As_code, MIN(m.FormId)
FROM   #Job j JOIN #Map m ON m.JobId = j.JobId
GROUP  BY j.As_code;

/* -------------------------------------------------------------------------
   3. ข้อของฟอร์มประวัติ ↔ (As_code, Toppic_num, Subtoppic_no)
      ฟอร์มประวัติสร้าง Section.OrderIndex = Toppic_num, Item.OrderIndex = Subtoppic_no
   ------------------------------------------------------------------------- */
CREATE TABLE #Item (
    As_code      varchar(50) NOT NULL,
    Toppic_num   int         NOT NULL,
    Subtoppic_no int         NOT NULL,
    SurveyItemId int         NOT NULL PRIMARY KEY
);
INSERT INTO #Item (As_code, Toppic_num, Subtoppic_no, SurveyItemId)
SELECT af.As_code, sec.OrderIndex, si.OrderIndex, si.Id
FROM   #AsForm af
JOIN   SurveySections sec ON sec.SurveyFormId = af.FormId
JOIN   SurveyItems    si  ON si.SurveySectionId = sec.Id;

IF EXISTS (SELECT 1 FROM #Item GROUP BY As_code, Toppic_num, Subtoppic_no HAVING COUNT(*) > 1)
    THROW 50065, 'duplicate (As_code, Toppic_num, Subtoppic_no) in history forms - aborting', 1;

/* -------------------------------------------------------------------------
   4. เก็บค่าเดิมไว้ย้อนกลับ (เฉพาะรันจริง — DryRun ไม่ทิ้งตารางค้าง)
   ------------------------------------------------------------------------- */
IF @DryRun = 0
BEGIN
    IF OBJECT_ID('dbo.bak_fixscore_AuditRecords') IS NOT NULL
        THROW 50066, 'bak_fixscore_* already exists - this fix was already applied', 1;

    SELECT ar.Id, ar.TotalScore, ar.MaxScore, ar.PercentageScore, ar.IsPassed,
           ar.AiAnalysisJson, ar.AiAnalysisGeneratedAt, SYSUTCDATETIME() AS BackedUpAt
    INTO   dbo.bak_fixscore_AuditRecords
    FROM   AuditRecords ar JOIN #Map m ON m.AuditRecordId = ar.Id;

    SELECT si.Id, si.FullScore, SYSUTCDATETIME() AS BackedUpAt
    INTO   dbo.bak_fixscore_SurveyItems
    FROM   SurveyItems si JOIN #Item it ON it.SurveyItemId = si.Id;

    SELECT r.Id, r.ScoreGiven, SYSUTCDATETIME() AS BackedUpAt
    INTO   dbo.bak_fixscore_AuditResponses
    FROM   AuditResponses r JOIN #Map m ON m.AuditRecordId = r.AuditRecordId;

    SELECT l.Id, l.LastScore, l.LastAuditDate, SYSUTCDATETIME() AS BackedUpAt
    INTO   dbo.bak_fixscore_Locations
    FROM   Locations l;
END

PRINT '';
PRINT '--- before: sample ASB 2026-09-19 (AuditRecord 5134) ---';
SELECT Id, TotalScore, MaxScore, ROUND(PercentageScore, 2) AS pct, IsPassed
FROM   AuditRecords WHERE Id = 5134;

PRINT '--- before: how wrong the imported scores are ---';
SELECT COUNT(*) AS jobs,
       SUM(CASE WHEN ABS(ar.PercentageScore - CASE WHEN j.FullPts > 0 THEN j.Got / j.FullPts * 100 ELSE 0 END) >= 0.01
                THEN 1 ELSE 0 END) AS pct_wrong,
       SUM(CASE WHEN ar.IsPassed <> CASE WHEN j.FullPts > 0
                                          AND j.Got / j.FullPts * 100 >= ISNULL(j.criterion, 0.85) * 100
                                         THEN 1 ELSE 0 END
                THEN 1 ELSE 0 END) AS passfail_wrong
FROM   #Job j JOIN #Map m ON m.JobId = j.JobId JOIN AuditRecords ar ON ar.Id = m.AuditRecordId;

/* -------------------------------------------------------------------------
   5. คะแนนเต็มรายข้อของฟอร์มประวัติ = ค่าที่พบบ่อยที่สุด (ไม่นับแถว N/A)
      เสมอกัน → ค่าที่ใช้ล่าสุด (ใกล้ฟอร์มปัจจุบันที่สุด)
      ข้อที่มีแต่แถว N/A ตลอดประวัติ → คงค่าเดิม
   ------------------------------------------------------------------------- */
PRINT '5) SurveyItems.FullScore (history forms) = most common item value';
;WITH c AS (
    SELECT h.As_code, d.Toppic_num, d.Subtoppic_no, d.scoreGet,
           COUNT(*) AS cnt, MAX(COALESCE(h.CheckOn, h.CheckOut)) AS lastUsed
    FROM   stg_JobHead h
    JOIN   stg_JobDetail d ON d.JobId = h.JobId
    WHERE  d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL AND d.scoreGet IS NOT NULL
    AND    NOT (ISNULL(d.IsCheck, 0) = 0 AND ISNULL(d.IsNotCheck, 0) = 0)
    GROUP  BY h.As_code, d.Toppic_num, d.Subtoppic_no, d.scoreGet
), ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY As_code, Toppic_num, Subtoppic_no
                                 ORDER BY cnt DESC, lastUsed DESC) AS rn
    FROM   c
)
UPDATE si
SET    si.FullScore = rk.scoreGet
FROM   SurveyItems si
JOIN   #Item  it ON it.SurveyItemId = si.Id
JOIN   ranked rk ON rk.As_code = it.As_code AND rk.Toppic_num = it.Toppic_num
                AND rk.Subtoppic_no = it.Subtoppic_no AND rk.rn = 1
WHERE  si.FullScore <> rk.scoreGet;
PRINT CONCAT('   items changed: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   6. คะแนนที่ได้รายข้อ — ผ่าน = scoreGet, ไม่ผ่าน/N/A = 0 (แบบเดียวกับแอป)
   ------------------------------------------------------------------------- */
PRINT '6) AuditResponses.ScoreGiven';
UPDATE r
SET    r.ScoreGiven = CASE WHEN d.IsCheck = 1 THEN ISNULL(d.scoreGet, 0) ELSE 0 END
FROM   AuditResponses r
JOIN   #Map  m  ON m.AuditRecordId = r.AuditRecordId
JOIN   #Job  j  ON j.JobId = m.JobId
JOIN   #Item it ON it.SurveyItemId = r.SurveyItemId AND it.As_code = j.As_code
JOIN   stg_JobDetail d ON d.JobId = m.JobId
                      AND d.Toppic_num = it.Toppic_num AND d.Subtoppic_no = it.Subtoppic_no
WHERE  r.ScoreGiven <> CASE WHEN d.IsCheck = 1 THEN ISNULL(d.scoreGet, 0) ELSE 0 END;
PRINT CONCAT('   responses changed: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   7. คะแนนรวมของงาน — สูตรระบบเดิม คิดจาก staging ตรงๆ (ไม่พึ่ง FullScore รายข้อ)
      MaxScore = 0 (ทุกข้อเป็น N/A) → 0% / ไม่ผ่าน เหมือน import เดิม
   ------------------------------------------------------------------------- */
PRINT '7) AuditRecords totals';
UPDATE ar
SET    ar.TotalScore      = j.Got,
       ar.MaxScore        = j.FullPts,
       ar.PercentageScore = CASE WHEN j.FullPts > 0 THEN j.Got / j.FullPts * 100 ELSE 0 END,
       ar.IsPassed        = CASE WHEN j.FullPts > 0
                                  AND j.Got / j.FullPts * 100 >= ISNULL(j.criterion, 0.85) * 100
                                 THEN 1 ELSE 0 END,
       /* บทวิเคราะห์ AI อ้างคะแนนเก่า — ล้างให้สร้างใหม่ */
       ar.AiAnalysisJson        = NULL,
       ar.AiAnalysisGeneratedAt = NULL
FROM   AuditRecords ar
JOIN   #Map m ON m.AuditRecordId = ar.Id
JOIN   #Job j ON j.JobId = m.JobId
WHERE  ar.TotalScore <> j.Got OR ar.MaxScore <> j.FullPts;
PRINT CONCAT('   audit records changed: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   8. คะแนนล่าสุดของสาขา — งานที่ AuditDate ล่าสุด (เสมอ → Id มากสุด)
      ตรรกะเดียวกับ LocationStatsHelper.UpdateLocationLastAuditStatsAsync
   ------------------------------------------------------------------------- */
PRINT '8) Locations.LastScore / LastAuditDate';
;WITH latest AS (
    SELECT LocationId, PercentageScore, AuditDate,
           ROW_NUMBER() OVER (PARTITION BY LocationId ORDER BY AuditDate DESC, Id DESC) AS rn
    FROM   AuditRecords
)
UPDATE l
SET    l.LastScore     = la.PercentageScore,
       l.LastAuditDate = la.AuditDate
FROM   Locations l
JOIN   latest la ON la.LocationId = l.Id AND la.rn = 1
WHERE  l.LastScore <> la.PercentageScore OR l.LastAuditDate IS NULL OR l.LastAuditDate <> la.AuditDate;
PRINT CONCAT('   locations changed: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   9. รายงานผล
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '--- after: sample ASB 2026-09-19 (AuditRecord 5134) - expect 267 / 285 / 93.68 / 1 ---';
SELECT Id, TotalScore, MaxScore, ROUND(PercentageScore, 2) AS pct, IsPassed
FROM   AuditRecords WHERE Id = 5134;

PRINT '--- after: pass / fail split of imported audits ---';
SELECT SUM(CASE WHEN ar.IsPassed = 1 THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN ar.IsPassed = 0 THEN 1 ELSE 0 END) AS failed
FROM   AuditRecords ar JOIN #Map m ON m.AuditRecordId = ar.Id;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM #Job j JOIN #Map m ON m.JobId = j.JobId JOIN AuditRecords ar ON ar.Id = m.AuditRecordId
    WHERE ABS(ar.PercentageScore - CASE WHEN j.FullPts > 0 THEN j.Got / j.FullPts * 100 ELSE 0 END) >= 0.01)
                                                                                   AS [pct_wrong],
  (SELECT COUNT(*) FROM #Job j JOIN #Map m ON m.JobId = j.JobId JOIN AuditRecords ar ON ar.Id = m.AuditRecordId
    WHERE ar.IsPassed <> CASE WHEN j.FullPts > 0
                               AND j.Got / j.FullPts * 100 >= ISNULL(j.criterion, 0.85) * 100
                              THEN 1 ELSE 0 END)                                   AS [passfail_wrong],
  (SELECT COUNT(*) FROM AuditResponses r JOIN #Map m ON m.AuditRecordId = r.AuditRecordId
    WHERE r.IsPassed = 0 AND r.IsNa = 0 AND r.ScoreGiven > 0)                      AS [failed_item_with_points],
  (SELECT COUNT(*) FROM AuditResponses r JOIN #Map m ON m.AuditRecordId = r.AuditRecordId
    WHERE r.IsNa = 1 AND r.ScoreGiven > 0)                                         AS [na_item_with_points],
  (SELECT COUNT(*) FROM Locations l
    CROSS APPLY (SELECT TOP 1 a.PercentageScore, a.AuditDate FROM AuditRecords a
                 WHERE a.LocationId = l.Id ORDER BY a.AuditDate DESC, a.Id DESC) la
    WHERE l.LastScore <> la.PercentageScore OR l.LastAuditDate IS NULL
       OR l.LastAuditDate <> la.AuditDate)                                         AS [location_lastscore_wrong];

IF @DryRun = 1
BEGIN
    ROLLBACK TRANSACTION;
    PRINT '*** DRY RUN finished - rolled back, nothing was saved ***';
END
ELSE
BEGIN
    COMMIT TRANSACTION;
    PRINT '*** COMMITTED ***';
END
