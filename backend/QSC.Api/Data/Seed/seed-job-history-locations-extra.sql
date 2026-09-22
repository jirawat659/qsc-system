/* =============================================================================
   seed-job-history-locations-extra.sql   (มือ — ไม่ใช่ไฟล์ generated)

   Backfill สาขาที่ปรากฏในประวัติ JobHead แต่ไม่มีอยู่ในสาขาที่ seed ไว้แล้ว
   (163 + 5 จากรอบก่อน) — พบระหว่างทดสอบ seed-job-history-import.sql

   ทั้งหมดปิดกิจการ/ไม่มีการตรวจมานานแล้ว (ล่าสุดของ APL1/EV01 คือ ม.ค. 2569
   ที่เหลือ Isclosed=1 ชัดเจน) จึง seed เป็น IsActive=0 ทั้งหมด

   ต้องรันก่อน seed-job-history-import.sql เสมอ

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i seed-job-history-locations-extra.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i seed-job-history-locations-extra.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

DECLARE @AuId int = (SELECT Id FROM Brands WHERE Code = N'AU');
DECLARE @LgId int = (SELECT Id FROM Brands WHERE Code = N'LG');
DECLARE @StoreTypeId int = (SELECT MIN(Id) FROM LocationTypes WHERE Code = 'STORE');
IF @AuId IS NULL OR @LgId IS NULL OR @StoreTypeId IS NULL
    THROW 50040, 'ไม่พบแบรนด์ AU/LG หรือ LocationType STORE', 1;

DECLARE @NewSites TABLE (Code nvarchar(50), Name nvarchar(200), BrandId int);
INSERT INTO @NewSites (Code, Name, BrandId) VALUES
    (N'ACB',   N'เซ็นทรัลบางนา',                @AuId),
    (N'AIP',   N'อิมแพ็คอารีน่า เมืองทองธานี',    @AuId),
    (N'AMP2',  N'ปตท. พระราม 2',               @AuId),
    (N'AMP6',  N'ปตท. ติวานนท์',                @AuId),
    (N'AMPT',  N'พอร์โต้ชิโน่ พระราม 2',          @AuId),
    (N'APL1',  N'เซ็นทรัลพิษณุโลก',              @AuId),
    (N'ARY1',  N'แพชชั่น ระยอง',                 @AuId),
    (N'ASB2',  N'สนามบินสุวรรณภูมิ (ด้านใน)',      @AuId),
    (N'AWD',   N'วิสดอม 101',                   @AuId),
    (N'EV01',  N'ออกบูธอาฟเตอร์ 1 (เขาใหญ่)',     @AuId),
    (N'EV05',  N'ออกบูธอาฟเตอร์ 5',              @AuId),
    (N'EV08',  N'ออกบูธอาฟเตอร์ 8',              @AuId),
    (N'EV16',  N'ออกบูธอาฟเตอร์ 16',             @AuId),
    (N'EV20',  N'ออกบูธอาฟเตอร์ 20',             @AuId),
    (N'LG1005', N'LG1005',                      @LgId);  -- ไม่มีชื่อใน master แล้ว (ไม่พบใน LGDB.Site)

INSERT INTO Locations (Code, Name, LocationTypeId, ManagerUserId, Latitude, Longitude, Region,
                        Address, Phone, LastScore, LastAuditDate, IsActive, CreatedAt)
SELECT ns.Code, ns.Name, @StoreTypeId, NULL, 0, 0, N'กรุงเทพฯ และปริมณฑล',
       N'', N'', 0, NULL, 0, SYSUTCDATETIME()
FROM   @NewSites ns
WHERE  NOT EXISTS (SELECT 1 FROM Locations l WHERE l.Code = ns.Code);

INSERT INTO LocationBrands (LocationId, BrandId, CreatedAt)
SELECT l.Id, ns.BrandId, SYSUTCDATETIME()
FROM   @NewSites ns
JOIN   Locations l ON l.Code = ns.Code
WHERE  NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id AND lb.BrandId = ns.BrandId);

PRINT 'สรุปผล';
SELECT COUNT(*) AS [สาขาที่เพิ่ม] FROM Locations WHERE Code IN (SELECT Code FROM @NewSites);
SELECT (SELECT COUNT(*) FROM Locations l WHERE l.Code IN (SELECT Code FROM @NewSites)
          AND NOT EXISTS (SELECT 1 FROM LocationBrands lb WHERE lb.LocationId = l.Id)) AS [สาขาใหม่ไม่มีแบรนด์];

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
