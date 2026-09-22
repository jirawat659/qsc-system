/* =============================================================================
   seed-brand-split.sql   (มือ — ไม่ใช่ไฟล์ generated)

   แยกแบรนด์ที่ซ่อนอยู่ใต้ฟอร์ม OP009 ("ทรงวาดคอฟฟี่") ออกจากก้อน AU:
     - ASW  (ทรงวาด)              -> แบรนด์ SCR (Songwad Coffee)
     - ASW2 (ท่าเตียน)             -> แบรนด์ SCR (กลุ่มเดียวกับทรงวาด)
     - ASD1 (Someday)             -> แบรนด์ SD  (Someday)
     - SAM1 (Sam Coffee Roasters) -> แบรนด์ SAM (Sam Coffee Roasters)

   ทั้ง 4 สาขานี้ StateCode=0 ในระบบเดิม (ดูเหมือนปิด) แต่ยังมีงานตรวจล่าสุด
   เดือนก่อน (ส.ค. 2569) จึงต้อง seed เป็น IsActive=1

   ต้องรันก่อน seed-job-history.sql เสมอ (ต้องมีสาขา+แบรนด์เหล่านี้ก่อนถึงจะ
   import ประวัติการตรวจของมันได้)

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i seed-brand-split.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i seed-brand-split.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

DECLARE @AuId  int = (SELECT Id FROM Brands WHERE Code = N'AU');
DECLARE @StoreTypeId int = (SELECT MIN(Id) FROM LocationTypes WHERE Code = 'STORE');
DECLARE @OP009FormId int = (SELECT Id FROM SurveyForms WHERE Title = N'ทรงวาดคอฟฟี่' AND IsLatest = 1);

IF @AuId IS NULL THROW 50010, 'ไม่พบแบรนด์ AU — ต้อง seed master data (seed-legacy-master.sql) ก่อน', 1;
IF @StoreTypeId IS NULL THROW 50011, 'ไม่พบ LocationType STORE', 1;
IF @OP009FormId IS NULL THROW 50012, 'ไม่พบฟอร์ม "ทรงวาดคอฟฟี่" (OP009) — ต้อง seed master data ก่อน', 1;

/* --- 1. เพิ่ม 3 แบรนด์ใหม่ (ข้ามถ้ามีอยู่แล้ว — รันซ้ำได้) --------------- */
PRINT '1) เพิ่มแบรนด์ SCR / SD / SAM';
INSERT INTO Brands (Code, Name, Description, IsActive, CreatedAt)
SELECT v.Code, v.Name, v.Description, 1, SYSUTCDATETIME()
FROM (VALUES
    (N'SCR', N'Songwad Coffee',        N'ร้านกาแฟย่านทรงวาด แยกจากกลุ่ม After You เดิม'),
    (N'SD',  N'Someday',               N'คาเฟ่ Someday แยกจากกลุ่ม After You เดิม'),
    (N'SAM', N'Sam Coffee Roasters',   N'ร้านกาแฟ Sam Coffee Roasters แยกจากกลุ่ม After You เดิม')
) AS v(Code, Name, Description)
WHERE NOT EXISTS (SELECT 1 FROM Brands b WHERE b.Code = v.Code);

DECLARE @ScrId int = (SELECT Id FROM Brands WHERE Code = N'SCR');
DECLARE @SdId  int = (SELECT Id FROM Brands WHERE Code = N'SD');
DECLARE @SamId int = (SELECT Id FROM Brands WHERE Code = N'SAM');

/* --- 2. เพิ่ม/อัปเดต 4 สาขา (backfill — StateCode=0 ใน legacy แต่ยังมีงานตรวจจริง) */
PRINT '2) เพิ่มสาขา ASW / ASW2 / ASD1 / SAM1';
DECLARE @NewSites TABLE (Code nvarchar(50), Name nvarchar(200), BrandId int);
INSERT INTO @NewSites (Code, Name, BrandId) VALUES
    (N'ASW',  N'ทรงวาด',              @ScrId),
    (N'ASW2', N'ท่าเตียน',             @ScrId),
    (N'ASD1', N'Someday',             @SdId),
    (N'SAM1', N'Sam Coffee Roasters', @SamId);

INSERT INTO Locations
      (Code, Name, LocationTypeId, ManagerUserId, Latitude, Longitude, Region,
       Address, Phone, LastScore, LastAuditDate, IsActive, CreatedAt)
SELECT ns.Code, ns.Name, @StoreTypeId, NULL, 0, 0, N'กรุงเทพฯ และปริมณฑล',
       N'', N'', 0, NULL, 1, SYSUTCDATETIME()
FROM   @NewSites ns
JOIN   Brands b ON b.Id = ns.BrandId
WHERE  NOT EXISTS (SELECT 1 FROM Locations l WHERE l.Code = ns.Code);

INSERT INTO LocationBrands (LocationId, BrandId, CreatedAt)
SELECT l.Id, ns.BrandId, SYSUTCDATETIME()
FROM   @NewSites ns
JOIN   Locations l ON l.Code = ns.Code
WHERE  NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id AND lb.BrandId = ns.BrandId);

/* --- 3. ย้ายฟอร์ม OP009 ออกจาก AU เดี่ยว ไปผูกทั้ง 3 แบรนด์ใหม่ --------- */
PRINT '3) ย้ายฟอร์ม "ทรงวาดคอฟฟี่" ไปผูก SCR/SD/SAM';
UPDATE SurveyForms SET BrandId = NULL WHERE Id = @OP009FormId;  -- เดิมผูก AU เดี่ยว เอาออก ให้ผูกผ่าน SurveyFormBrands แทน

DELETE FROM SurveyFormBrands WHERE SurveyFormId = @OP009FormId AND BrandId = @AuId;

INSERT INTO SurveyFormBrands (SurveyFormId, BrandId, CreatedAt)
SELECT @OP009FormId, b.Id, SYSUTCDATETIME()
FROM   Brands b WHERE b.Code IN (N'SCR', N'SD', N'SAM')
AND    NOT EXISTS (SELECT 1 FROM SurveyFormBrands fb WHERE fb.SurveyFormId = @OP009FormId AND fb.BrandId = b.Id);

/* --- 4. รายงานผล ------------------------------------------------------- */
PRINT '4) สรุปผล';
SELECT Code AS [แบรนด์], Id FROM Brands ORDER BY Code;

SELECT l.Code AS [สาขา], b.Code AS [แบรนด์]
FROM   Locations l
JOIN   LocationBrands lb ON lb.LocationId = l.Id
JOIN   Brands b ON b.Id = lb.BrandId
WHERE  l.Code IN ('ASW','ASW2','ASD1','SAM1')
ORDER  BY l.Code;

SELECT sf.Title AS [ฟอร์ม], sf.BrandId AS [BrandId เดี่ยว (ควรเป็น NULL)], b.Code AS [แบรนด์ผ่าน SurveyFormBrands]
FROM   SurveyForms sf
LEFT   JOIN SurveyFormBrands fb ON fb.SurveyFormId = sf.Id
LEFT   JOIN Brands b ON b.Id = fb.BrandId
WHERE  sf.Id = @OP009FormId;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM Locations l WHERE l.Code IN ('ASW','ASW2','ASD1','SAM1')
     AND NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id)) AS [สาขาใหม่ไม่มีแบรนด์],
  (SELECT COUNT(*) FROM SurveyForms WHERE Id = @OP009FormId AND BrandId IS NOT NULL) AS [OP009 ยังมี BrandId เดี่ยวค้าง],
  (SELECT COUNT(*) FROM SurveyFormBrands WHERE SurveyFormId = @OP009FormId AND BrandId = @AuId) AS [OP009 ยังผูก AU ค้าง];

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
