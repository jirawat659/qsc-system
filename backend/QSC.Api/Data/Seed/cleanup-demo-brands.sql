/* =============================================================================
   cleanup-demo-brands.sql   (มือ — ไม่ใช่ไฟล์ generated)

   ลบร่องรอยของแบรนด์ demo (UB / CL / AB / CS / QSCH) ที่ถูก re-seed กลับมา
   โดย process เก่าที่ยังรันโค้ดก่อนแก้ (ดูรายละเอียดใน README.md หัวข้อ
   "instance เก่าค้างอยู่")

   ลบเฉพาะสิ่งที่แบรนด์ demo สร้างขึ้นมา — ไม่แตะ Brands/LocationBrands ของ
   AU/MK/LG ที่ถูกต้องอยู่แล้ว

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i cleanup-demo-brands.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i cleanup-demo-brands.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

DECLARE @DemoCodes TABLE (Code nvarchar(10));
INSERT INTO @DemoCodes (Code) VALUES (N'UB'), (N'CL'), (N'AB'), (N'CS'), (N'QSCH');

PRINT 'ก่อนลบ:';
SELECT 'Brands (demo)' AS [ตาราง], COUNT(*) AS [แถว]
FROM   Brands b WHERE b.Code IN (SELECT Code FROM @DemoCodes)
UNION ALL
SELECT 'LocationBrands (ชี้แบรนด์ demo)', COUNT(*)
FROM   LocationBrands lb JOIN Brands b ON b.Id = lb.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes)
UNION ALL
SELECT 'UserBrands (ชี้แบรนด์ demo)', COUNT(*)
FROM   UserBrands ub JOIN Brands b ON b.Id = ub.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes)
UNION ALL
SELECT 'SurveyFormBrands (ชี้แบรนด์ demo)', COUNT(*)
FROM   SurveyFormBrands fb JOIN Brands b ON b.Id = fb.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes);

/* สาขาที่จะเหลือแบรนด์ถูกต้องอย่างเดียวหลังลบ (ไว้ตรวจตา) */
SELECT l.Code AS [สาขาที่มีลิงก์แบรนด์ demo ผิด], b.Code AS [แบรนด์ demo ที่จะถูกลบ]
FROM   LocationBrands lb
JOIN   Brands b   ON b.Id = lb.BrandId
JOIN   Locations l ON l.Id = lb.LocationId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes)
ORDER  BY l.Code;

/* --- ลบ child ก่อน parent --- */
DELETE lb
FROM   LocationBrands lb
JOIN   Brands b ON b.Id = lb.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes);

DELETE ub
FROM   UserBrands ub
JOIN   Brands b ON b.Id = ub.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes);

DELETE fb
FROM   SurveyFormBrands fb
JOIN   Brands b ON b.Id = fb.BrandId
WHERE  b.Code IN (SELECT Code FROM @DemoCodes);

DELETE FROM Brands WHERE Code IN (SELECT Code FROM @DemoCodes);

PRINT 'หลังลบ:';
SELECT 'Brands' AS [ตาราง], COUNT(*) AS [แถว] FROM Brands
UNION ALL SELECT 'LocationBrands', COUNT(*) FROM LocationBrands
UNION ALL SELECT 'Locations',      COUNT(*) FROM Locations
UNION ALL SELECT 'Users',          COUNT(*) FROM Users;

SELECT Code AS [แบรนด์คงเหลือ] FROM Brands ORDER BY Code;

/* ตรวจ ABH/ABK/ABP ต้องเหลือแถวเดียว ชี้ AU เท่านั้น */
SELECT l.Code AS [สาขา], b.Code AS [แบรนด์]
FROM   LocationBrands lb
JOIN   Brands b    ON b.Id = lb.BrandId
JOIN   Locations l ON l.Id = lb.LocationId
WHERE  l.Code IN ('ABH','ABK','ABP')
ORDER  BY l.Code;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM Brands WHERE Code IN ('UB','CL','AB','CS','QSCH'))                                          AS [แบรนด์ demo คงเหลือ],
  (SELECT COUNT(*) FROM Locations l WHERE NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id))  AS [สาขาไม่มีแบรนด์],
  (SELECT COUNT(*) FROM (
        SELECT LocationId, BrandId FROM LocationBrands GROUP BY LocationId, BrandId HAVING COUNT(*) > 1
   ) x)                                                                                                             AS [ลิงก์สาขา-แบรนด์ซ้ำ];

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
