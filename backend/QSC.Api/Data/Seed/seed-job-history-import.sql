/* =============================================================================
   seed-job-history-import.sql   (มือ — ไม่ใช่ไฟล์ generated)

   ขั้นตอนสุดท้าย: แปลง staging table (stg_JobHead / stg_JobDetail ที่ bcp
   ใส่ไว้แล้ว) เป็น AuditRecords / AuditResponses จริง

   ต้องรันหลัง (เรียงตามลำดับ):
     1. seed-brand-split.sql
     2. seed-job-history-setup.sql   (สร้างฟอร์มประวัติ + ผู้ใช้ + staging table)
     3. bcp JobHead/JobDetail เข้า stg_JobHead / stg_JobDetail (ดู README.md)
     4. ไฟล์นี้

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i seed-job-history-import.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i seed-job-history-import.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

IF OBJECT_ID('tempdb..#Auditor')  IS NOT NULL DROP TABLE #Auditor;
IF OBJECT_ID('tempdb..#HistForm') IS NOT NULL DROP TABLE #HistForm;
IF OBJECT_ID('tempdb..#ItemMap')  IS NOT NULL DROP TABLE #ItemMap;
IF OBJECT_ID('tempdb..#JobScore') IS NOT NULL DROP TABLE #JobScore;
IF OBJECT_ID('tempdb..#JobIdMap') IS NOT NULL DROP TABLE #JobIdMap;

BEGIN TRANSACTION;

/* --- 0. ผู้ตรวจในประวัติ (GUID -> Username, ตรงกับที่ seed-job-history-setup.sql สร้างไว้) --- */
CREATE TABLE #Auditor (LegacyId varchar(50) NOT NULL PRIMARY KEY, Username nvarchar(100) NOT NULL);
INSERT INTO #Auditor (LegacyId, Username) VALUES
    ('46FA9113-AC46-4B6A-A622-13407155D4F4', N'10016'),
    ('CEF16F18-94C5-49FB-8CA3-6BF3795196FE', N'10020'),
    ('9D531CD0-315A-4DDC-B7E4-4D015944ED3C', N'10097'),
    ('F0E6BC12-89CE-4FE4-9A49-B02C42F58B21', N'10668'),
    ('0BFFE7E9-AFD9-4005-B403-8EF13537F764', N'11074'),
    ('3E5CA34C-6BB5-4C6D-994F-9D3BDD5322D5', N'11430'),
    ('3701A212-C91B-49DF-8C57-12ECA79F9C09', N'11792'),
    ('263E2FAF-C50C-4894-BA37-1EEE01729F6B', N'12747'),
    ('43273EF3-0B42-470E-866A-BDA794F57703', N'12979'),
    ('0A595924-CB4F-4C0D-A45F-B756F124A8FF', N'14270'),
    ('54D5899B-0E02-4585-96D8-0D2F49A439C3', N'15347'),
    ('8CC87FE3-2729-4022-8519-F05184D18A98', N'15347'),
    ('B4766DDC-52A5-452F-9746-889B2529F3A5', N'15861'),
    ('A0A7F737-0B66-45B4-B740-3E7C4A9E7E45', N'17302'),
    ('AD6F9080-72BA-4ED1-B483-5448D76489CB', N'18127'),
    ('C72F1960-DC09-4B8F-91D3-235C297FC763', N'19231'),
    ('5E88AFE1-9133-4AA2-824D-F98847BD3EA8', N'21624'),
    ('0FD182E1-0681-4EB6-ABB9-4F3E28D24CE6', N'A01'),
    ('9FD182E1-0681-4EB6-ABB9-4F3E28D24CE6', N'A02');

DECLARE @LegacyImportUserId int = (SELECT Id FROM Users WHERE Username = 'legacy-import');
IF @LegacyImportUserId IS NULL THROW 50030, 'ไม่พบผู้ใช้ legacy-import — ต้องรัน seed-job-history-setup.sql ก่อน', 1;

/* --- 1. resolve FormId ของฟอร์มประวัติแต่ละ As_code --- */
PRINT '1) resolve ฟอร์มประวัติ';
CREATE TABLE #HistForm (AsCode varchar(50) NOT NULL PRIMARY KEY, FormId int NOT NULL);

INSERT INTO #HistForm (AsCode, FormId)
SELECT v.AsCode, sf.Id
FROM (VALUES
    ('LG001', N'ลูกก๊อ Cashless Store'),
    ('LG002', N'ลูกก๊อ Cash Store'),
    ('OP003', N'Operation Excellence  (กันยายน 2569)'),
    ('OP004', N'Operation Excellence(EV. / Catering)'),
    ('OP006', N'Booth, Mini Shop'),
    ('OP008', N'AMJ.(Cashless Store)'),
    ('OP009', N'ทรงวาดคอฟฟี่')
) AS v(AsCode, LiveTitle)
JOIN SurveyForms live ON live.Title = v.LiveTitle AND live.IsLatest = 1
JOIN SurveyForms sf ON sf.FormGroupId = live.Id AND sf.Version = 'legacy-history';

INSERT INTO #HistForm (AsCode, FormId)
SELECT v.AsCode, sf.Id
FROM (VALUES ('OP001'), ('OP002'), ('OP005')) AS v(AsCode)
JOIN SurveyForms sf ON sf.Title = v.AsCode + N' (legacy-history)';

IF (SELECT COUNT(*) FROM #HistForm) <> 10
    THROW 50031, 'resolve ฟอร์มประวัติได้ไม่ครบ 10 ฟอร์ม — ต้องรัน seed-job-history-setup.sql ก่อน', 1;

/* --- 2. resolve SurveyItemId ของแต่ละ (As_code, Toppic_num, Subtoppic_no) --- */
PRINT '2) resolve ข้อคำถามฟอร์มประวัติ';
CREATE TABLE #ItemMap (
    AsCode       varchar(50) NOT NULL,
    Toppic_num   int NOT NULL,
    Subtoppic_no int NOT NULL,
    SurveyItemId int NOT NULL,
    FullScore    float NOT NULL,
    CategoryName nvarchar(100) NULL
);
INSERT INTO #ItemMap (AsCode, Toppic_num, Subtoppic_no, SurveyItemId, FullScore, CategoryName)
SELECT hf.AsCode, sec.OrderIndex, si.OrderIndex, si.Id, si.FullScore, si.CategoryName
FROM   #HistForm hf
JOIN   SurveySections sec ON sec.SurveyFormId = hf.FormId
JOIN   SurveyItems si ON si.SurveySectionId = sec.Id;

CREATE UNIQUE INDEX IX_ItemMap ON #ItemMap (AsCode, Toppic_num, Subtoppic_no);

/* --- 3. เช็คสาขา/As_code ที่ยัง map ไม่ได้ (ควรว่างทั้งคู่) --- */
PRINT '3) ตรวจสาขา/ฟอร์มที่ map ไม่ได้ (ก่อน insert จริง)';
SELECT DISTINCT h.Branch_Code AS [สาขาที่ไม่มีใน Locations]
FROM stg_JobHead h
WHERE NOT EXISTS (SELECT 1 FROM Locations l WHERE l.Code = h.Branch_Code);

SELECT DISTINCT h.As_code AS [As_code ที่ไม่มีฟอร์มประวัติ]
FROM stg_JobHead h
WHERE h.As_code IS NULL OR NOT EXISTS (SELECT 1 FROM #HistForm hf WHERE hf.AsCode = h.As_code);

/* --- 4. รวมคะแนนต่องาน --- */
PRINT '4) รวมคะแนนต่องานตรวจ';
CREATE TABLE #JobScore (JobId uniqueidentifier NOT NULL PRIMARY KEY, TotalScore float NOT NULL, MaxScore float NOT NULL);
INSERT INTO #JobScore (JobId, TotalScore, MaxScore)
SELECT h.JobId, SUM(ISNULL(d.scoreGet, 0)), SUM(im.FullScore)
FROM   stg_JobHead h
JOIN   stg_JobDetail d ON d.JobId = h.JobId AND d.Toppic_num IS NOT NULL AND d.Subtoppic_no IS NOT NULL
JOIN   #ItemMap im ON im.AsCode = h.As_code AND im.Toppic_num = d.Toppic_num AND im.Subtoppic_no = d.Subtoppic_no
GROUP  BY h.JobId;

/* --- 5. AuditRecords (ใช้ MERGE เพื่อจับคู่ JobId(GUID) เดิม กับ Id(int) ใหม่ ผ่าน OUTPUT) --- */
PRINT '5) สร้าง AuditRecords';
CREATE TABLE #JobIdMap (JobId uniqueidentifier NOT NULL PRIMARY KEY, AuditRecordId int NOT NULL);

MERGE INTO AuditRecords AS tgt
USING (
    SELECT h.JobId, h.Branch_Code, h.As_code, h.CheckBy, h.latOn, h.lonOn, h.CheckOn, h.CheckOut,
           h.latColse, h.lonColse, h.managerName, h.empNum, h.Comment, h.criterion,
           loc.Id AS LocationId, hf.FormId AS SurveyFormId,
           ISNULL(u.Id, @LegacyImportUserId) AS AuditorId,
           ISNULL(js.TotalScore, 0) AS TotalScore, ISNULL(js.MaxScore, 0) AS MaxScore
    FROM   stg_JobHead h
    JOIN   Locations loc ON loc.Code = h.Branch_Code
    JOIN   #HistForm hf ON hf.AsCode = h.As_code
    LEFT   JOIN #Auditor a ON a.LegacyId = CAST(h.CheckBy AS varchar(50))
    LEFT   JOIN Users u ON u.Username = a.Username
    LEFT   JOIN #JobScore js ON js.JobId = h.JobId
) AS src
ON 1 = 0
WHEN NOT MATCHED THEN
INSERT (LocationId, SurveyFormId, PrimaryAuditorId, AuditeeUserId, AuditeeNameText, AuditScheduleId,
        AuditDate, TotalScore, MaxScore, PercentageScore, IsPassed, HasCriticalDefect,
        AuditType, Notes, MetadataValuesJson, AuditorSignatureUrl, AuditeeSignatureUrl, SignedAt,
        StartLatitude, StartLongitude, EndLatitude, EndLongitude,
        IsBackdated, StartedAt, SubmittedAt, CreatedAt)
VALUES (
    src.LocationId, src.SurveyFormId, src.AuditorId, NULL, src.managerName, NULL,
    COALESCE(src.CheckOn, src.CheckOut, SYSUTCDATETIME()),
    src.TotalScore, src.MaxScore,
    CASE WHEN src.MaxScore > 0 THEN src.TotalScore / src.MaxScore * 100 ELSE 0 END,
    CASE WHEN src.MaxScore > 0 AND (src.TotalScore / src.MaxScore * 100) >= ISNULL(src.criterion, 0.85) * 100 THEN 1 ELSE 0 END,
    0,
    'spot', src.Comment, NULL, NULL, NULL, NULL,
    src.latOn, src.lonOn, src.latColse, src.lonColse,
    0, src.CheckOn, COALESCE(src.CheckOut, src.CheckOn, SYSUTCDATETIME()), SYSUTCDATETIME()
)
OUTPUT src.JobId, inserted.Id INTO #JobIdMap (JobId, AuditRecordId);

/* --- 6. AuditResponses --- */
PRINT '6) สร้าง AuditResponses';
INSERT INTO AuditResponses (AuditRecordId, SurveyItemId, ScoreGiven, IsPassed, IsNa, CategoryName, Notes, CreatedAt)
SELECT jim.AuditRecordId, im.SurveyItemId, ISNULL(d.scoreGet, 0),
       CASE WHEN d.IsCheck = 1 THEN 1 ELSE 0 END,
       CASE WHEN ISNULL(d.IsCheck, 0) = 0 AND ISNULL(d.IsNotCheck, 0) = 0 THEN 1 ELSE 0 END,
       im.CategoryName, d.comment, SYSUTCDATETIME()
FROM   stg_JobDetail d
JOIN   stg_JobHead h ON h.JobId = d.JobId
JOIN   #JobIdMap jim ON jim.JobId = d.JobId
JOIN   #ItemMap im ON im.AsCode = h.As_code AND im.Toppic_num = d.Toppic_num AND im.Subtoppic_no = d.Subtoppic_no;

/* --- 7. รายงานผล --- */
PRINT '7) สรุปผล';
SELECT 'stg_JobHead'    AS [ตาราง], COUNT(*) AS [แถว] FROM stg_JobHead
UNION ALL SELECT 'stg_JobDetail',   COUNT(*) FROM stg_JobDetail
UNION ALL SELECT 'AuditRecords (ใหม่)', COUNT(*) FROM #JobIdMap
UNION ALL SELECT 'AuditRecords (รวมทั้งหมด)', COUNT(*) FROM AuditRecords
UNION ALL SELECT 'AuditResponses (รวมทั้งหมด)', COUNT(*) FROM AuditResponses;

SELECT sf.Title AS [ฟอร์ม], COUNT(*) AS [จำนวนงานตรวจที่ import]
FROM   AuditRecords ar JOIN SurveyForms sf ON sf.Id = ar.SurveyFormId
WHERE  ar.Id IN (SELECT AuditRecordId FROM #JobIdMap)
GROUP  BY sf.Title ORDER BY sf.Title;

/* ตรวจความถูกต้อง — ทุกค่าควรเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM stg_JobHead h WHERE NOT EXISTS (SELECT 1 FROM Locations l WHERE l.Code = h.Branch_Code)) AS [สาขา map ไม่ได้],
  (SELECT COUNT(*) FROM stg_JobHead h WHERE h.As_code IS NULL OR NOT EXISTS (SELECT 1 FROM #HistForm hf WHERE hf.AsCode = h.As_code)) AS [ฟอร์ม map ไม่ได้],
  (SELECT COUNT(*) FROM stg_JobHead) - (SELECT COUNT(*) FROM #JobIdMap) AS [JobHead ที่ไม่ถูก insert],
  (SELECT COUNT(*) FROM AuditRecords WHERE PrimaryAuditorId IS NULL) AS [AuditRecords ไม่มีผู้ตรวจ];

/* ตัวอย่างคะแนนสุ่มเช็ค 5 รายการ */
SELECT TOP 5 ar.Id, l.Code AS [สาขา], sf.Title AS [ฟอร์ม], ar.TotalScore, ar.MaxScore,
       ROUND(ar.PercentageScore, 2) AS [%], ar.IsPassed, ar.SubmittedAt
FROM   AuditRecords ar
JOIN   Locations l ON l.Id = ar.LocationId
JOIN   SurveyForms sf ON sf.Id = ar.SurveyFormId
WHERE  ar.Id IN (SELECT AuditRecordId FROM #JobIdMap)
ORDER  BY ar.SubmittedAt DESC;

/* --- 8. commit / rollback --- */
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
