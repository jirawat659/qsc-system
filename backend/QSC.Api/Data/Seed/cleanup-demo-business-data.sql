/* =============================================================================
   cleanup-demo-business-data.sql   (มือ — ไม่ใช่ไฟล์ generated)

   ล้าง "ข้อมูลธุรกิจ" demo ทั้งหมดออกจาก QSCDB ให้เหลือฐานว่างพร้อม seed
   ข้อมูลจริงจากระบบเดิม — ใช้ตอน cutover จาก demo ไป production

   ต่างจาก cleanup-demo-brands.sql อย่างไร
     cleanup-demo-brands.sql  ลบแค่แบรนด์ demo ที่โผล่ "ปน" กับข้อมูลจริง
                              (ใช้ตอน dev DB ที่มีทั้งสองชุด) และยังอ้าง
                              LocationBrands.IsPrimary ที่ถูก migration
                              RemoveIsPrimaryFromLocationBrand ลบไปแล้ว
     ไฟล์นี้                  ลบข้อมูลธุรกิจ "ทั้งหมด" ไม่เลือกแบรนด์ —
                              Brands, Locations, SurveyForms, ประวัติการตรวจ,
                              CAP tasks, ตารางตรวจ

   เก็บอะไรไว้ (ไม่แตะ)
     Users, Roles, Permissions, RolePermissions, LocationTypes
     — เป็น "การตั้งค่าระบบ" ที่ DatabaseSeeder.cs ดูแล (ดู README.md)

   ลำดับการลบไล่จาก leaf ไป root ตาม FK จริงใน DB (เช็คด้วย sys.foreign_keys)
   ถึงจะมี CASCADE อยู่หลายเส้นก็ลบเองให้ครบทุกตาราง เพื่อให้จำนวนแถวที่ลบ
   แสดงออกมาตรวจตาได้ และไม่ต้องพึ่งพฤติกรรม cascade ที่อาจเปลี่ยนตาม migration

   วิธีรัน
     ทดสอบ (rollback)  sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=1 -i cleanup-demo-business-data.sql
     บันทึกจริง        sqlcmd -S <server> -U <user> -P <pass> -d QSCDB -C -b -v DryRun=0 -i cleanup-demo-business-data.sql
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun bit = CASE WHEN '$(DryRun)' = '0' THEN 0 ELSE 1 END;
PRINT CASE WHEN @DryRun = 1 THEN '*** DRY RUN - จะ ROLLBACK ทุกอย่างเมื่อจบ ***'
                            ELSE '*** LIVE RUN - จะ COMMIT ***' END;

BEGIN TRANSACTION;

PRINT '';
PRINT '--- ก่อนลบ ---';
SELECT 'Brands' AS [ตาราง], COUNT(*) AS [แถว] FROM Brands
UNION ALL SELECT 'Locations',                 COUNT(*) FROM Locations
UNION ALL SELECT 'LocationBrands',            COUNT(*) FROM LocationBrands
UNION ALL SELECT 'SurveyForms',               COUNT(*) FROM SurveyForms
UNION ALL SELECT 'SurveySections',            COUNT(*) FROM SurveySections
UNION ALL SELECT 'SurveyItems',               COUNT(*) FROM SurveyItems
UNION ALL SELECT 'SurveyFormBrands',          COUNT(*) FROM SurveyFormBrands
UNION ALL SELECT 'SurveyFormTargetLocations', COUNT(*) FROM SurveyFormTargetLocations
UNION ALL SELECT 'AuditRecords',              COUNT(*) FROM AuditRecords
UNION ALL SELECT 'AuditResponses',            COUNT(*) FROM AuditResponses
UNION ALL SELECT 'AuditResponseImages',       COUNT(*) FROM AuditResponseImages
UNION ALL SELECT 'AuditRecordEditLogs',       COUNT(*) FROM AuditRecordEditLogs
UNION ALL SELECT 'AuditSchedules',            COUNT(*) FROM AuditSchedules
UNION ALL SELECT 'AuditScheduleAuditors',     COUNT(*) FROM AuditScheduleAuditors
UNION ALL SELECT 'AuditDrafts',               COUNT(*) FROM AuditDrafts
UNION ALL SELECT 'CapTasks',                  COUNT(*) FROM CapTasks
UNION ALL SELECT 'CapTaskComments',           COUNT(*) FROM CapTaskComments
UNION ALL SELECT 'CapTaskImages',             COUNT(*) FROM CapTaskImages
UNION ALL SELECT 'Users (เก็บไว้)',            COUNT(*) FROM Users
UNION ALL SELECT 'Roles (เก็บไว้)',            COUNT(*) FROM Roles
UNION ALL SELECT 'LocationTypes (เก็บไว้)',    COUNT(*) FROM LocationTypes;

/* -------------------------------------------------------------------------
   1. CAP tasks — ลูกก่อนแม่
   ------------------------------------------------------------------------- */
DELETE FROM CapTaskComments;
DELETE FROM CapTaskImages;
DELETE FROM CapTasks;

/* -------------------------------------------------------------------------
   2. ประวัติการตรวจ
      AuditResponseImages -> AuditResponses -> AuditRecordEditLogs -> AuditRecords
      (CapTasks ถูกลบไปแล้วข้างบน จึงไม่มีใครค้าง FK ไป AuditResponses)
   ------------------------------------------------------------------------- */
DELETE FROM AuditResponseImages;
DELETE FROM AuditResponses;
DELETE FROM AuditRecordEditLogs;
DELETE FROM AuditRecords;

/* -------------------------------------------------------------------------
   3. ตารางตรวจ + ร่าง
      AuditDrafts/AuditScheduleAuditors ชี้ AuditSchedules
      AuditRecords ที่ชี้ AuditSchedules ถูกลบไปแล้ว
   ------------------------------------------------------------------------- */
DELETE FROM AuditDrafts;
DELETE FROM AuditScheduleAuditors;
DELETE FROM AuditSchedules;

/* -------------------------------------------------------------------------
   4. ฟอร์มตรวจ
      SurveyItems -> SurveySections -> ตารางเชื่อม -> SurveyForms
      SurveyForms.FormGroupId ชี้ SurveyForms เอง (self-FK) — เคลียร์ก่อนลบ
   ------------------------------------------------------------------------- */
DELETE FROM SurveyFormTargetLocations;
DELETE FROM SurveyFormBrands;
DELETE FROM SurveyItems;
DELETE FROM SurveySections;
UPDATE SurveyForms SET FormGroupId = NULL WHERE FormGroupId IS NOT NULL;
DELETE FROM SurveyForms;

/* -------------------------------------------------------------------------
   5. สาขา + แบรนด์
      UserLocations/LocationBrands ชี้ Locations
      Locations.ManagerUserId ชี้ Users — ลบ Locations ไม่กระทบ Users
   ------------------------------------------------------------------------- */
DELETE FROM UserLocations;
DELETE FROM LocationBrands;
DELETE FROM Locations;
DELETE FROM UserBrands;
DELETE FROM Brands;

PRINT '';
PRINT '--- หลังลบ (ข้อมูลธุรกิจต้องเป็น 0 ทุกตาราง) ---';
SELECT 'Brands' AS [ตาราง], COUNT(*) AS [แถว] FROM Brands
UNION ALL SELECT 'Locations',                 COUNT(*) FROM Locations
UNION ALL SELECT 'LocationBrands',            COUNT(*) FROM LocationBrands
UNION ALL SELECT 'SurveyForms',               COUNT(*) FROM SurveyForms
UNION ALL SELECT 'SurveySections',            COUNT(*) FROM SurveySections
UNION ALL SELECT 'SurveyItems',               COUNT(*) FROM SurveyItems
UNION ALL SELECT 'SurveyFormBrands',          COUNT(*) FROM SurveyFormBrands
UNION ALL SELECT 'SurveyFormTargetLocations', COUNT(*) FROM SurveyFormTargetLocations
UNION ALL SELECT 'AuditRecords',              COUNT(*) FROM AuditRecords
UNION ALL SELECT 'AuditResponses',            COUNT(*) FROM AuditResponses
UNION ALL SELECT 'AuditResponseImages',       COUNT(*) FROM AuditResponseImages
UNION ALL SELECT 'AuditRecordEditLogs',       COUNT(*) FROM AuditRecordEditLogs
UNION ALL SELECT 'AuditSchedules',            COUNT(*) FROM AuditSchedules
UNION ALL SELECT 'AuditScheduleAuditors',     COUNT(*) FROM AuditScheduleAuditors
UNION ALL SELECT 'AuditDrafts',               COUNT(*) FROM AuditDrafts
UNION ALL SELECT 'CapTasks',                  COUNT(*) FROM CapTasks
UNION ALL SELECT 'CapTaskComments',           COUNT(*) FROM CapTaskComments
UNION ALL SELECT 'CapTaskImages',             COUNT(*) FROM CapTaskImages
UNION ALL SELECT 'UserBrands',                COUNT(*) FROM UserBrands
UNION ALL SELECT 'UserLocations',             COUNT(*) FROM UserLocations;

PRINT '';
PRINT '--- ที่เก็บไว้ (ต้องเท่าเดิม) ---';
SELECT 'Users' AS [ตาราง], COUNT(*) AS [แถว] FROM Users
UNION ALL SELECT 'Roles',           COUNT(*) FROM Roles
UNION ALL SELECT 'Permissions',     COUNT(*) FROM Permissions
UNION ALL SELECT 'RolePermissions', COUNT(*) FROM RolePermissions
UNION ALL SELECT 'LocationTypes',   COUNT(*) FROM LocationTypes;

/* ตรวจความถูกต้อง — ทุกค่าต้องเป็น 0 */
SELECT
  (SELECT COUNT(*) FROM Brands)       AS [แบรนด์คงเหลือ],
  (SELECT COUNT(*) FROM Locations)    AS [สาขาคงเหลือ],
  (SELECT COUNT(*) FROM SurveyForms)  AS [ฟอร์มคงเหลือ],
  (SELECT COUNT(*) FROM AuditRecords) AS [ประวัติตรวจคงเหลือ];

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
