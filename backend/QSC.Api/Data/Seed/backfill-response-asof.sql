/* =============================================================================
   backfill-response-asof.sql   (มือ — ไม่ใช่ไฟล์ generated)

   เติม AuditResponses.MaxScore และ AuditResponses.CategoryCode/CategoryName
   = "คะแนนเต็มและหมวดของข้อ ณ วันตรวจ" ให้คำตอบที่มีอยู่แล้ว
   ต้องรันหลัง deploy migration AddMaxScoreAndCategoryCodeToAuditResponse (ต้องมีคอลัมน์ก่อน)

   ทำไมต้องมี: SurveyItem เก็บคะแนนเต็ม/หมวดได้ค่าเดียวต่อข้อ แต่ระบบเดิมเคยปรับคะแนนของข้อเดิม
   และย้ายข้อเดิมไปหมวดอื่นหลายรอบตามยุค คะแนนแยกหมวดของงานประวัติจึงผิด
   (เช่น ACW 21 ก.ย. 2026 Service แสดง 73/72 = 101% แต่ระบบเดิม 73/77 = 95%)
   วัดก่อนแก้: หมวด % ผิด 3,401 จาก 3,584 งาน, คำตอบอยู่ผิดหมวด 34,583 ข้อใน 2,794 งาน

   แก้อะไร (เฉพาะแถวที่ยังเป็น NULL — รันซ้ำได้)
     งานประวัติ (จับคู่กับ stg_JobHead/stg_JobDetail แบบเดียวกับ fix-job-history-scores.sql)
       MaxScore     = scoreGet ของแถวนั้น (คะแนนของข้อ ณ วันตรวจ)
       CategoryCode = tsCode ของแถวนั้น แปลงเป็นรหัสระบบใหม่
                      C→CLN, DM→DOC, PC→OPS, PD/Q→QLT, S→SVC (ตาม README)
       CategoryName = ชื่อหมวดของรหัสนั้น (ดึงจาก SurveyItems ไม่พิมพ์ชื่อไทยในสคริปต์)
     งานที่สร้างในระบบใหม่
       MaxScore = SurveyItem.FullScore, CategoryCode = SurveyItem.CategoryCode
       (ฟอร์มที่มีคนตรวจแล้วจะสร้างเวอร์ชันใหม่เมื่อแก้ ค่าปัจจุบันของข้อจึงเท่ากับตอนตรวจ)

   ไม่แตะ ScoreGiven / คะแนนรวมของงาน (แก้แล้วใน fix-job-history-scores.sql)

   ไม่มีตัวอักษรไทยใน string literal จึงรันได้ไม่ว่า sqlcmd อ่าน encoding แบบไหน

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=1 -i backfill-response-asof.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=0 -i backfill-response-asof.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - rolls everything back at the end ***'
                            ELSE '*** LIVE RUN - commits ***' END;

IF COL_LENGTH('dbo.AuditResponses', 'MaxScore') IS NULL OR COL_LENGTH('dbo.AuditResponses', 'CategoryCode') IS NULL
    THROW 50080, 'AuditResponses.MaxScore / CategoryCode not found - deploy the migration first', 1;
IF OBJECT_ID('dbo.stg_JobHead') IS NULL OR OBJECT_ID('dbo.stg_JobDetail') IS NULL
    THROW 50081, 'stg_JobHead / stg_JobDetail not found', 1;

BEGIN TRANSACTION;

/* -------------------------------------------------------------------------
   0. แปลง tsCode ระบบเดิม → รหัสหมวดระบบใหม่ และชื่อหมวดของแต่ละรหัส
   ------------------------------------------------------------------------- */
DECLARE @TsMap TABLE (tsCode varchar(10) PRIMARY KEY, CategoryCode nvarchar(20) NOT NULL);
INSERT INTO @TsMap (tsCode, CategoryCode) VALUES
    ('C', N'CLN'), ('DM', N'DOC'), ('PC', N'OPS'), ('PD', N'QLT'), ('Q', N'QLT'), ('S', N'SVC');

IF EXISTS (SELECT 1 FROM stg_JobDetail d
           WHERE d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM @TsMap m WHERE m.tsCode = d.tsCode))
    THROW 50082, 'stg_JobDetail has a tsCode not in the mapping - extend @TsMap', 1;

/* ชื่อหมวดของแต่ละรหัส = ชื่อที่ SurveyItems ใช้กับรหัสนั้นบ่อยที่สุด */
DECLARE @CatName TABLE (CategoryCode nvarchar(20) PRIMARY KEY, CategoryName nvarchar(100) NOT NULL);
INSERT INTO @CatName (CategoryCode, CategoryName)
SELECT CategoryCode, CategoryName FROM (
    SELECT CategoryCode, CategoryName,
           ROW_NUMBER() OVER (PARTITION BY CategoryCode ORDER BY COUNT(*) DESC) AS rn
    FROM   SurveyItems
    WHERE  CategoryCode IN (SELECT CategoryCode FROM @TsMap) AND CategoryName IS NOT NULL
    GROUP  BY CategoryCode, CategoryName) x
WHERE rn = 1;

IF (SELECT COUNT(*) FROM @CatName) <> (SELECT COUNT(DISTINCT CategoryCode) FROM @TsMap)
    THROW 50083, 'could not resolve a category name for every category code', 1;

/* -------------------------------------------------------------------------
   1. จับคู่งานเดิม ↔ งานใหม่ และข้อ ↔ (As_code, Toppic_num, Subtoppic_no)
      ตรรกะเดียวกับ fix-job-history-scores.sql ขั้น 0-3
   ------------------------------------------------------------------------- */
CREATE TABLE #HistForm (FormId int PRIMARY KEY);
INSERT INTO #HistForm (FormId)
SELECT Id FROM SurveyForms WHERE Version LIKE 'legacy-history%' OR Title LIKE '% (legacy-history)';

CREATE TABLE #MapRaw (JobId uniqueidentifier NOT NULL, As_code varchar(50) NULL, AuditRecordId int NOT NULL, FormId int NOT NULL);
INSERT INTO #MapRaw (JobId, As_code, AuditRecordId, FormId)
SELECT h.JobId, h.As_code, ar.Id, ar.SurveyFormId
FROM   stg_JobHead h
JOIN   Locations    l  ON l.Code = h.Branch_Code
JOIN   AuditRecords ar ON ar.LocationId = l.Id
                      AND ar.AuditDate BETWEEN DATEADD(second, -1, CAST(COALESCE(h.CheckOn, h.CheckOut) AS datetime2))
                                           AND DATEADD(second,  1, CAST(COALESCE(h.CheckOn, h.CheckOut) AS datetime2))
JOIN   #HistForm    hf ON hf.FormId = ar.SurveyFormId;

IF (SELECT COUNT(DISTINCT JobId) FROM #MapRaw) <> (SELECT COUNT(*) FROM stg_JobHead)
    THROW 50084, 'some legacy jobs did not match an AuditRecord - aborting', 1;
IF EXISTS (SELECT 1 FROM #MapRaw GROUP BY JobId HAVING COUNT(*) > 1)
   OR EXISTS (SELECT 1 FROM #MapRaw GROUP BY AuditRecordId HAVING COUNT(*) > 1)
    THROW 50085, 'legacy job <-> AuditRecord match is not 1:1 - aborting', 1;

CREATE TABLE #Map (JobId uniqueidentifier NOT NULL PRIMARY KEY, As_code varchar(50) NULL,
                   AuditRecordId int NOT NULL UNIQUE, FormId int NOT NULL);
INSERT INTO #Map SELECT JobId, As_code, AuditRecordId, FormId FROM #MapRaw;

CREATE TABLE #Item (FormId int NOT NULL, Toppic_num int NOT NULL, Subtoppic_no int NOT NULL,
                    SurveyItemId int NOT NULL PRIMARY KEY);
INSERT INTO #Item (FormId, Toppic_num, Subtoppic_no, SurveyItemId)
SELECT DISTINCT sec.SurveyFormId, sec.OrderIndex, si.OrderIndex, si.Id
FROM   SurveySections sec
JOIN   SurveyItems si ON si.SurveySectionId = sec.Id
WHERE  sec.SurveyFormId IN (SELECT FormId FROM #Map);

IF EXISTS (SELECT 1 FROM #Item GROUP BY FormId, Toppic_num, Subtoppic_no HAVING COUNT(*) > 1)
    THROW 50086, 'duplicate (form, Toppic_num, Subtoppic_no) in history forms - aborting', 1;

PRINT '--- before ---';
SELECT COUNT(*) AS responses,
       SUM(CASE WHEN MaxScore IS NULL THEN 1 ELSE 0 END)     AS maxscore_null,
       SUM(CASE WHEN CategoryCode IS NULL THEN 1 ELSE 0 END) AS categorycode_null
FROM   AuditResponses;

/* -------------------------------------------------------------------------
   2. งานประวัติ — ค่า ณ วันตรวจจาก staging
   ------------------------------------------------------------------------- */
UPDATE r
SET    r.MaxScore     = CASE WHEN r.MaxScore IS NULL THEN ISNULL(d.scoreGet, 0) ELSE r.MaxScore END,
       r.CategoryCode = CASE WHEN r.CategoryCode IS NULL THEN tm.CategoryCode ELSE r.CategoryCode END,
       r.CategoryName = CASE WHEN r.CategoryCode IS NULL THEN cn.CategoryName ELSE r.CategoryName END
FROM   AuditResponses r
JOIN   #Map  m  ON m.AuditRecordId = r.AuditRecordId
JOIN   #Item it ON it.SurveyItemId = r.SurveyItemId AND it.FormId = m.FormId
JOIN   stg_JobDetail d ON d.JobId = m.JobId
                      AND d.Toppic_num = it.Toppic_num AND d.Subtoppic_no = it.Subtoppic_no
JOIN   @TsMap   tm ON tm.tsCode = d.tsCode
JOIN   @CatName cn ON cn.CategoryCode = tm.CategoryCode
WHERE  r.MaxScore IS NULL OR r.CategoryCode IS NULL;
PRINT CONCAT('history responses filled: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   3. งานที่สร้างในระบบใหม่ (และคำตอบประวัติที่ยังไม่ได้ค่า ถ้ามี) — ค่าปัจจุบันของข้อ
   ------------------------------------------------------------------------- */
UPDATE r
SET    r.MaxScore     = ISNULL(r.MaxScore, si.FullScore),
       r.CategoryCode = ISNULL(r.CategoryCode, si.CategoryCode)
FROM   AuditResponses r
JOIN   SurveyItems si ON si.Id = r.SurveyItemId
WHERE  (r.MaxScore IS NULL OR r.CategoryCode IS NULL)
AND    r.AuditRecordId NOT IN (SELECT AuditRecordId FROM #Map);
PRINT CONCAT('non-history responses filled: ', @@ROWCOUNT);

/* -------------------------------------------------------------------------
   4. รายงานผล — งานตัวอย่าง ACW 21 ก.ย. 2026 (ระบบเดิม PD 76 / PC 92 / S 95 / C 87 / DM 88)
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '--- after: sample ACW 2026-09-21 by category ---';
SELECT r.CategoryCode, SUM(r.ScoreGiven) AS got,
       SUM(CASE WHEN r.IsNa = 0 THEN r.MaxScore ELSE 0 END) AS fullpts,
       CAST(SUM(r.ScoreGiven) * 100.0 / NULLIF(SUM(CASE WHEN r.IsNa = 0 THEN r.MaxScore ELSE 0 END), 0) AS decimal(6,2)) AS pct
FROM   AuditResponses r
JOIN   AuditRecords ar ON ar.Id = r.AuditRecordId
JOIN   Locations l ON l.Id = ar.LocationId
WHERE  l.Code = 'ACW' AND ar.AuditDate >= '2026-09-21' AND ar.AuditDate < '2026-09-22'
GROUP  BY r.CategoryCode ORDER BY r.CategoryCode;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
;WITH legacyCat AS (      -- ระบบเดิม: คิดจาก staging แยกตาม tsCode ของแต่ละแถว (อิสระจากการ join ข้อ)
    SELECT m.AuditRecordId, tm.CategoryCode,
           SUM(CASE WHEN d.IsCheck = 1 THEN d.scoreGet ELSE 0 END) AS got,
           SUM(CASE WHEN ISNULL(d.IsCheck, 0) = 0 AND ISNULL(d.IsNotCheck, 0) = 0 THEN 0 ELSE d.scoreGet END) AS fullpts
    FROM   #Map m
    JOIN   stg_JobDetail d ON d.JobId = m.JobId
    JOIN   @TsMap tm ON tm.tsCode = d.tsCode
    WHERE  d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
    GROUP  BY m.AuditRecordId, tm.CategoryCode
), newCat AS (            -- ระบบใหม่: คิดจากคำตอบ แบบเดียวกับหน้าจอ (ScoreGiven / MaxScore ไม่นับ N/A)
    SELECT r.AuditRecordId, r.CategoryCode,
           SUM(r.ScoreGiven) AS got,
           SUM(CASE WHEN r.IsNa = 0 THEN r.MaxScore ELSE 0 END) AS fullpts
    FROM   AuditResponses r
    WHERE  r.AuditRecordId IN (SELECT AuditRecordId FROM #Map)
    GROUP  BY r.AuditRecordId, r.CategoryCode
)
SELECT
  (SELECT COUNT(*) FROM AuditResponses WHERE MaxScore IS NULL)                     AS [maxscore_null],
  (SELECT COUNT(*) FROM AuditResponses WHERE CategoryCode IS NULL)                 AS [categorycode_null],
  (SELECT COUNT(*) FROM AuditResponses WHERE IsNa = 0 AND ScoreGiven > MaxScore)   AS [scoregiven_over_max],
  (SELECT COUNT(DISTINCT COALESCE(lc.AuditRecordId, nc.AuditRecordId))
     FROM legacyCat lc
     FULL JOIN newCat nc ON nc.AuditRecordId = lc.AuditRecordId AND nc.CategoryCode = lc.CategoryCode
     WHERE lc.AuditRecordId IS NULL OR nc.AuditRecordId IS NULL
        OR ABS(lc.got - nc.got) > 0.001 OR ABS(lc.fullpts - nc.fullpts) > 0.001)    AS [audits_category_mismatch];

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
