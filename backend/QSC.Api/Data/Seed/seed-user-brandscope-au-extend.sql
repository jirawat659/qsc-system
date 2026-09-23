/* =============================================================================
   seed-user-brandscope-au-extend.sql   (มือ — ไม่ใช่ไฟล์ generated)

   ให้ผู้ตรวจที่เป็น After You (มีแบรนด์ AU ใน UserBrands) เห็นแบรนด์จริงทั้งหมด
   ยกเว้น Mikka — คือ AU, LG, SAM, SCR, SD (23 ก.ย. 2026 ตามที่ผู้ใช้กำหนด)

   ทำไมเพิ่มแค่ UserBrands: เป้าหมายทุกคนเป็น BrandScope = 'SPECIFIC' อยู่แล้ว ซึ่ง
   AuthController.cs:99-105 อ่าน UserBrands แล้วส่งเป็น allowedBrandIds
   (ถ้าเปลี่ยนเป็น 'ALL' จะเห็น MK ด้วย ซึ่งไม่ต้องการ)

   เป้าหมาย = BrandScope = 'SPECIFIC' + มีแถว UserBrands ชี้ AU
              ยกเว้น test1 / test2 (บัญชีทดสอบที่มีคนตั้งแบรนด์ไว้เอง ไม่แตะ)
   admin เป็น BrandScope = 'ALL' จึงไม่อยู่ในเป้าหมายโดยอัตโนมัติ

   เพิ่มอย่างเดียว ไม่ลบแถวใด — รันซ้ำได้ (เพิ่มเฉพาะคู่ user-แบรนด์ที่ยังไม่มี)
   กฎเดียวกันอยู่ใน Generate-UserBrandScope.ps1 แล้ว รัน generator ใหม่จะไม่ทำให้ค่ากลับ

   ไม่มีตัวอักษรไทยใน string literal จึงรันได้ไม่ว่า sqlcmd อ่าน encoding แบบไหน

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=1 -i seed-user-brandscope-au-extend.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -f 65001 -v DryRun=0 -i seed-user-brandscope-au-extend.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - rolls everything back at the end ***'
                            ELSE '*** LIVE RUN - commits ***' END;

/* จำนวนเป้าหมายที่คาดไว้ตอนเขียนสคริปต์ — กันเลือกกลุ่มผิดโดยไม่รู้ตัว
   ถ้ามีผู้ตรวจ AU เพิ่ม/ลด ให้ตรวจรายชื่อแล้วแก้เลขนี้ */
DECLARE @ExpectedTargets int = 28;

BEGIN TRANSACTION;

/* แบรนด์ที่ผู้ตรวจ AU ต้องเห็น — ทุกแบรนด์จริงยกเว้น MK */
DECLARE @Grant TABLE (Code nvarchar(20) PRIMARY KEY, BrandId int NULL);
INSERT INTO @Grant (Code) VALUES (N'AU'), (N'LG'), (N'SAM'), (N'SCR'), (N'SD');
UPDATE g SET g.BrandId = b.Id FROM @Grant g JOIN Brands b ON b.Code = g.Code;
IF EXISTS (SELECT 1 FROM @Grant WHERE BrandId IS NULL)
    THROW 50070, 'one of AU/LG/SAM/SCR/SD is missing from Brands - aborting', 1;

DECLARE @AuId int = (SELECT BrandId FROM @Grant WHERE Code = N'AU');
DECLARE @MkId int = (SELECT Id FROM Brands WHERE Code = N'MK');

/* บัญชีทดสอบที่ไม่แตะ */
DECLARE @Skip TABLE (Username nvarchar(100) PRIMARY KEY);
INSERT INTO @Skip (Username) VALUES (N'test1'), (N'test2');

/* เป้าหมาย */
DECLARE @Target TABLE (UserId int PRIMARY KEY, Username nvarchar(100) NOT NULL);
INSERT INTO @Target (UserId, Username)
SELECT u.Id, u.Username
FROM   Users u
WHERE  u.BrandScope = 'SPECIFIC'
AND    EXISTS (SELECT 1 FROM UserBrands ub WHERE ub.UserId = u.Id AND ub.BrandId = @AuId)
AND    NOT EXISTS (SELECT 1 FROM @Skip s WHERE s.Username = u.Username);

DECLARE @Targets int = (SELECT COUNT(*) FROM @Target);
PRINT CONCAT('targets: ', @Targets, ' (expected ', @ExpectedTargets, ')');
IF @Targets <> @ExpectedTargets
    THROW 50071, 'target user count differs from expected - check the list, then update @ExpectedTargets', 1;

/* สำรองแบรนด์ของบัญชีที่ไม่แตะ ไว้เทียบว่าไม่เปลี่ยน */
DECLARE @SkipBefore TABLE (UserId int, BrandId int);
INSERT INTO @SkipBefore (UserId, BrandId)
SELECT ub.UserId, ub.BrandId FROM UserBrands ub JOIN Users u ON u.Id = ub.UserId
WHERE  u.Username IN (SELECT Username FROM @Skip);

PRINT '--- before ---';
SELECT t.Username,
       STUFF((SELECT ',' + b.Code FROM UserBrands ub JOIN Brands b ON b.Id = ub.BrandId
              WHERE ub.UserId = t.UserId ORDER BY b.Code FOR XML PATH('')), 1, 1, '') AS brands
FROM   @Target t ORDER BY t.Username;

/* เพิ่มคู่ที่ยังไม่มี */
INSERT INTO UserBrands (UserId, BrandId, CreatedAt)
SELECT t.UserId, g.BrandId, SYSUTCDATETIME()
FROM   @Target t CROSS JOIN @Grant g
WHERE  NOT EXISTS (SELECT 1 FROM UserBrands ub WHERE ub.UserId = t.UserId AND ub.BrandId = g.BrandId);
PRINT CONCAT('UserBrands rows added: ', @@ROWCOUNT);

PRINT '--- after ---';
SELECT t.Username,
       STUFF((SELECT ',' + b.Code FROM UserBrands ub JOIN Brands b ON b.Id = ub.BrandId
              WHERE ub.UserId = t.UserId ORDER BY b.Code FOR XML PATH('')), 1, 1, '') AS brands
FROM   @Target t ORDER BY t.Username;

SELECT b.Code AS brand, COUNT(ub.UserId) AS users
FROM   Brands b LEFT JOIN UserBrands ub ON ub.BrandId = b.Id
GROUP  BY b.Code ORDER BY b.Code;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
SELECT
  /* เป้าหมายที่ชุดแบรนด์ไม่ใช่ AU,LG,SAM,SCR,SD พอดี */
  (SELECT COUNT(*) FROM @Target t
    WHERE (SELECT COUNT(*) FROM UserBrands ub WHERE ub.UserId = t.UserId) <> 5
       OR EXISTS (SELECT 1 FROM @Grant g WHERE NOT EXISTS
                   (SELECT 1 FROM UserBrands ub WHERE ub.UserId = t.UserId AND ub.BrandId = g.BrandId)))
                                                                                   AS [target_wrong_set],
  /* ใครเห็น MK ผ่าน UserBrands (admin เป็น ALL ไม่นับ) */
  (SELECT COUNT(*) FROM UserBrands WHERE BrandId = @MkId)                         AS [users_seeing_mk],
  /* แถวที่ชี้แบรนด์ไม่มีจริง */
  (SELECT COUNT(*) FROM UserBrands ub WHERE NOT EXISTS (SELECT 1 FROM Brands b WHERE b.Id = ub.BrandId))
                                                                                   AS [orphan_brand_link],
  /* บัญชีทดสอบแบรนด์เปลี่ยน */
  (SELECT COUNT(*) FROM (
      SELECT ub.UserId, ub.BrandId FROM UserBrands ub JOIN Users u ON u.Id = ub.UserId
      WHERE u.Username IN (SELECT Username FROM @Skip)
      EXCEPT SELECT UserId, BrandId FROM @SkipBefore) added)
  + (SELECT COUNT(*) FROM (
      SELECT UserId, BrandId FROM @SkipBefore
      EXCEPT SELECT ub.UserId, ub.BrandId FROM UserBrands ub JOIN Users u ON u.Id = ub.UserId
      WHERE u.Username IN (SELECT Username FROM @Skip)) removed)                   AS [skipped_users_changed];

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
