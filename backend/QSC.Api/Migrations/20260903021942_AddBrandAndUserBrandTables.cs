using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandAndUserBrandTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                table: "AuditSchedules");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_LocationId",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_LocationId",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "SopRef",
                table: "SurveyItems");

            migrationBuilder.DropColumn(
                name: "AssignedAuditorsJson",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "FormType",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "TargetMode",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "AuditorFeedback",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "CorrectionAction",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "Deadline",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "RootCause",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "AuditorName",
                table: "AuditSchedules");

            migrationBuilder.DropColumn(
                name: "AnswerValue",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "CapDeadline",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "MaxScore",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "QuestionText",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "QuestionType",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "SectionTitle",
                table: "AuditResponses");

            migrationBuilder.DropColumn(
                name: "AuditeeName",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "AuditorName",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "AuditorRole",
                table: "AuditRecords");

            migrationBuilder.RenameColumn(
                name: "Role",
                table: "Users",
                newName: "FullName");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "SurveyForms",
                newName: "Version");

            migrationBuilder.RenameColumn(
                name: "TargetUnitsJson",
                table: "SurveyForms",
                newName: "TargetingMode");

            migrationBuilder.RenameColumn(
                name: "ManagerName",
                table: "Locations",
                newName: "BrandName");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "CapTasks",
                newName: "SubmissionDeadline");

            migrationBuilder.RenameColumn(
                name: "SubmittedAt",
                table: "CapTasks",
                newName: "CompletedAt");

            migrationBuilder.RenameColumn(
                name: "Severity",
                table: "CapTasks",
                newName: "IssueItem");

            migrationBuilder.RenameColumn(
                name: "EvidencePhotoUrl",
                table: "CapTasks",
                newName: "ClosedAt");

            migrationBuilder.RenameColumn(
                name: "PhotoUrl",
                table: "AuditResponses",
                newName: "CategoryName");

            migrationBuilder.RenameColumn(
                name: "CapRequired",
                table: "AuditResponses",
                newName: "IsNa");

            migrationBuilder.RenameColumn(
                name: "ScheduleId",
                table: "AuditRecords",
                newName: "AuditeeUserId");

            migrationBuilder.RenameColumn(
                name: "ResultStatus",
                table: "AuditRecords",
                newName: "SubmittedAt");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "AuditRecords",
                newName: "AuditType");

            migrationBuilder.RenameColumn(
                name: "AuditorSignature",
                table: "AuditRecords",
                newName: "StartedAt");

            migrationBuilder.RenameColumn(
                name: "AuditeeSignature",
                table: "AuditRecords",
                newName: "SignedAt");

            migrationBuilder.AddColumn<string>(
                name: "BranchScope",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BrandScope",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RoleId",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "SurveySections",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "WeightPercent",
                table: "SurveySections",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AlterColumn<double>(
                name: "FullScore",
                table: "SurveyItems",
                type: "REAL",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<string>(
                name: "CategoryCode",
                table: "SurveyItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CategoryName",
                table: "SurveyItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "SurveyItems",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "SurveyForms",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatorId",
                table: "SurveyForms",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FormGroupId",
                table: "SurveyForms",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLatest",
                table: "SurveyForms",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LocationTypeId",
                table: "SurveyForms",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MetadataConfigJson",
                table: "SurveyForms",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Locations",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAuditDate",
                table: "Locations",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "Locations",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "LocationTypeId",
                table: "Locations",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "Locations",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "ManagerUserId",
                table: "Locations",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AssignedTo",
                table: "CapTasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AssigneeId",
                table: "CapTasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VerifiedBy",
                table: "CapTasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VerifierId",
                table: "CapTasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SurveyFormId",
                table: "AuditSchedules",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditSchedules",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "AuditSchedules",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CreatorId",
                table: "AuditSchedules",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Time",
                table: "AuditSchedules",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SurveyItemId",
                table: "AuditResponses",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditResponses",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditRecords",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<int>(
                name: "AuditScheduleId",
                table: "AuditRecords",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditeeNameText",
                table: "AuditRecords",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditeeSignatureUrl",
                table: "AuditRecords",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditorSignatureUrl",
                table: "AuditRecords",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "EndLatitude",
                table: "AuditRecords",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "EndLongitude",
                table: "AuditRecords",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasCriticalDefect",
                table: "AuditRecords",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPassed",
                table: "AuditRecords",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MetadataValuesJson",
                table: "AuditRecords",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrimaryAuditorId",
                table: "AuditRecords",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "StaffCount",
                table: "AuditRecords",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "StartLatitude",
                table: "AuditRecords",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "StartLongitude",
                table: "AuditRecords",
                type: "REAL",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AuditDrafts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    SurveyFormId = table.Column<int>(type: "INTEGER", nullable: false),
                    AuditorId = table.Column<int>(type: "INTEGER", nullable: false),
                    DraftPayloadJson = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentSectionIdx = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalAnswered = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalQuestions = table.Column<int>(type: "INTEGER", nullable: false),
                    StartLatitude = table.Column<double>(type: "REAL", nullable: true),
                    StartLongitude = table.Column<double>(type: "REAL", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditDrafts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_Users_AuditorId",
                        column: x => x.AuditorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditResponseImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuditResponseId = table.Column<int>(type: "INTEGER", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", nullable: false),
                    UploadedBy = table.Column<int>(type: "INTEGER", nullable: false),
                    UploaderId = table.Column<int>(type: "INTEGER", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditResponseImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditResponseImages_AuditResponses_AuditResponseId",
                        column: x => x.AuditResponseId,
                        principalTable: "AuditResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditResponseImages_Users_UploaderId",
                        column: x => x.UploaderId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AuditScheduleAuditors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuditScheduleId = table.Column<int>(type: "INTEGER", nullable: false),
                    AuditorId = table.Column<int>(type: "INTEGER", nullable: false),
                    IsLead = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditScheduleAuditors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditScheduleAuditors_AuditSchedules_AuditScheduleId",
                        column: x => x.AuditScheduleId,
                        principalTable: "AuditSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditScheduleAuditors_Users_AuditorId",
                        column: x => x.AuditorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Brands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Brands", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CapTaskComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CapTaskId = table.Column<int>(type: "INTEGER", nullable: false),
                    SenderId = table.Column<int>(type: "INTEGER", nullable: false),
                    SenderRole = table.Column<string>(type: "TEXT", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapTaskComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CapTaskComments_CapTasks_CapTaskId",
                        column: x => x.CapTaskId,
                        principalTable: "CapTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CapTaskComments_Users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CapTaskImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CapTaskId = table.Column<int>(type: "INTEGER", nullable: false),
                    Phase = table.Column<string>(type: "TEXT", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", nullable: false),
                    UploadedBy = table.Column<int>(type: "INTEGER", nullable: true),
                    UploaderId = table.Column<int>(type: "INTEGER", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapTaskImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CapTaskImages_CapTasks_CapTaskId",
                        column: x => x.CapTaskId,
                        principalTable: "CapTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CapTaskImages_Users_UploaderId",
                        column: x => x.UploaderId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LocationTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Module = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    NavConfigJson = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SurveyFormTargetLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SurveyFormId = table.Column<int>(type: "INTEGER", nullable: false),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyFormTargetLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyFormTargetLocations_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SurveyFormTargetLocations_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserLocations_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserLocations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LocationBrands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    BrandId = table.Column<int>(type: "INTEGER", nullable: false),
                    IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationBrands", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LocationBrands_Brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LocationBrands_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserBrands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    BrandId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBrands", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserBrands_Brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserBrands_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RoleId = table.Column<int>(type: "INTEGER", nullable: false),
                    PermissionId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_CreatorId",
                table: "SurveyForms",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_FormGroupId",
                table: "SurveyForms",
                column: "FormGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_LocationTypeId",
                table: "SurveyForms",
                column: "LocationTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_LocationTypeId",
                table: "Locations",
                column: "LocationTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_ManagerUserId",
                table: "Locations",
                column: "ManagerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AssignedTo_Status",
                table: "CapTasks",
                columns: new[] { "AssignedTo", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AssigneeId",
                table: "CapTasks",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AuditResponseId",
                table: "CapTasks",
                column: "AuditResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_LocationId_Status",
                table: "CapTasks",
                columns: new[] { "LocationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_VerifierId",
                table: "CapTasks",
                column: "VerifierId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_CreatorId",
                table: "AuditSchedules",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponses_SurveyItemId_IsPassed",
                table: "AuditResponses",
                columns: new[] { "SurveyItemId", "IsPassed" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_AuditDate",
                table: "AuditRecords",
                column: "AuditDate");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_AuditeeUserId",
                table: "AuditRecords",
                column: "AuditeeUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_AuditScheduleId",
                table: "AuditRecords",
                column: "AuditScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_LocationId_AuditDate",
                table: "AuditRecords",
                columns: new[] { "LocationId", "AuditDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_PrimaryAuditorId",
                table: "AuditRecords",
                column: "PrimaryAuditorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_AuditorId",
                table: "AuditDrafts",
                column: "AuditorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_LocationId",
                table: "AuditDrafts",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_SurveyFormId",
                table: "AuditDrafts",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponseImages_AuditResponseId",
                table: "AuditResponseImages",
                column: "AuditResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponseImages_UploaderId",
                table: "AuditResponseImages",
                column: "UploaderId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditorId",
                table: "AuditScheduleAuditors",
                column: "AuditorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId",
                table: "AuditScheduleAuditors",
                column: "AuditScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTaskComments_CapTaskId",
                table: "CapTaskComments",
                column: "CapTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTaskComments_SenderId",
                table: "CapTaskComments",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTaskImages_CapTaskId",
                table: "CapTaskImages",
                column: "CapTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTaskImages_UploaderId",
                table: "CapTaskImages",
                column: "UploaderId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationBrands_BrandId",
                table: "LocationBrands",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationBrands_LocationId",
                table: "LocationBrands",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationBrands_LocationId_BrandId",
                table: "LocationBrands",
                columns: new[] { "LocationId", "BrandId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                table: "RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId",
                table: "RolePermissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormTargetLocations_LocationId",
                table: "SurveyFormTargetLocations",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormTargetLocations_SurveyFormId",
                table: "SurveyFormTargetLocations",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBrands_BrandId",
                table: "UserBrands",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBrands_UserId",
                table: "UserBrands",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBrands_UserId_BrandId",
                table: "UserBrands",
                columns: new[] { "UserId", "BrandId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserLocations_LocationId",
                table: "UserLocations",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_UserLocations_UserId",
                table: "UserLocations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserLocations_UserId_LocationId",
                table: "UserLocations",
                columns: new[] { "UserId", "LocationId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditRecords_AuditSchedules_AuditScheduleId",
                table: "AuditRecords",
                column: "AuditScheduleId",
                principalTable: "AuditSchedules",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditRecords_Users_AuditeeUserId",
                table: "AuditRecords",
                column: "AuditeeUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditRecords_Users_PrimaryAuditorId",
                table: "AuditRecords",
                column: "PrimaryAuditorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditResponses_SurveyItems_SurveyItemId",
                table: "AuditResponses",
                column: "SurveyItemId",
                principalTable: "SurveyItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                table: "AuditSchedules",
                column: "SurveyFormId",
                principalTable: "SurveyForms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditSchedules_Users_CreatorId",
                table: "AuditSchedules",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CapTasks_AuditResponses_AuditResponseId",
                table: "CapTasks",
                column: "AuditResponseId",
                principalTable: "AuditResponses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_CapTasks_Users_AssigneeId",
                table: "CapTasks",
                column: "AssigneeId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CapTasks_Users_VerifierId",
                table: "CapTasks",
                column: "VerifierId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Locations_LocationTypes_LocationTypeId",
                table: "Locations",
                column: "LocationTypeId",
                principalTable: "LocationTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Locations_Users_ManagerUserId",
                table: "Locations",
                column: "ManagerUserId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyForms_LocationTypes_LocationTypeId",
                table: "SurveyForms",
                column: "LocationTypeId",
                principalTable: "LocationTypes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyForms_SurveyForms_FormGroupId",
                table: "SurveyForms",
                column: "FormGroupId",
                principalTable: "SurveyForms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyForms_Users_CreatorId",
                table: "SurveyForms",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users",
                column: "RoleId",
                principalTable: "Roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditRecords_AuditSchedules_AuditScheduleId",
                table: "AuditRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditRecords_Users_AuditeeUserId",
                table: "AuditRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditRecords_Users_PrimaryAuditorId",
                table: "AuditRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditResponses_SurveyItems_SurveyItemId",
                table: "AuditResponses");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                table: "AuditSchedules");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditSchedules_Users_CreatorId",
                table: "AuditSchedules");

            migrationBuilder.DropForeignKey(
                name: "FK_CapTasks_AuditResponses_AuditResponseId",
                table: "CapTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_CapTasks_Users_AssigneeId",
                table: "CapTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_CapTasks_Users_VerifierId",
                table: "CapTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_Locations_LocationTypes_LocationTypeId",
                table: "Locations");

            migrationBuilder.DropForeignKey(
                name: "FK_Locations_Users_ManagerUserId",
                table: "Locations");

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyForms_LocationTypes_LocationTypeId",
                table: "SurveyForms");

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyForms_SurveyForms_FormGroupId",
                table: "SurveyForms");

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyForms_Users_CreatorId",
                table: "SurveyForms");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "AuditDrafts");

            migrationBuilder.DropTable(
                name: "AuditResponseImages");

            migrationBuilder.DropTable(
                name: "AuditScheduleAuditors");

            migrationBuilder.DropTable(
                name: "CapTaskComments");

            migrationBuilder.DropTable(
                name: "CapTaskImages");

            migrationBuilder.DropTable(
                name: "LocationBrands");

            migrationBuilder.DropTable(
                name: "LocationTypes");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "SurveyFormTargetLocations");

            migrationBuilder.DropTable(
                name: "UserBrands");

            migrationBuilder.DropTable(
                name: "UserLocations");

            migrationBuilder.DropTable(
                name: "Permissions");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "Brands");

            migrationBuilder.DropIndex(
                name: "IX_Users_RoleId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_SurveyForms_CreatorId",
                table: "SurveyForms");

            migrationBuilder.DropIndex(
                name: "IX_SurveyForms_FormGroupId",
                table: "SurveyForms");

            migrationBuilder.DropIndex(
                name: "IX_SurveyForms_LocationTypeId",
                table: "SurveyForms");

            migrationBuilder.DropIndex(
                name: "IX_Locations_LocationTypeId",
                table: "Locations");

            migrationBuilder.DropIndex(
                name: "IX_Locations_ManagerUserId",
                table: "Locations");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_AssignedTo_Status",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_AssigneeId",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_AuditResponseId",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_LocationId_Status",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_CapTasks_VerifierId",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_AuditSchedules_CreatorId",
                table: "AuditSchedules");

            migrationBuilder.DropIndex(
                name: "IX_AuditResponses_SurveyItemId_IsPassed",
                table: "AuditResponses");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_AuditDate",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_AuditeeUserId",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_AuditScheduleId",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_LocationId_AuditDate",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_PrimaryAuditorId",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "BranchScope",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BrandScope",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "SurveySections");

            migrationBuilder.DropColumn(
                name: "WeightPercent",
                table: "SurveySections");

            migrationBuilder.DropColumn(
                name: "CategoryCode",
                table: "SurveyItems");

            migrationBuilder.DropColumn(
                name: "CategoryName",
                table: "SurveyItems");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "SurveyItems");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "FormGroupId",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "IsLatest",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "LocationTypeId",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "MetadataConfigJson",
                table: "SurveyForms");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "LastAuditDate",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "LocationTypeId",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "ManagerUserId",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "AssignedTo",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "AssigneeId",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "VerifiedBy",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "VerifierId",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "AuditSchedules");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "AuditSchedules");

            migrationBuilder.DropColumn(
                name: "Time",
                table: "AuditSchedules");

            migrationBuilder.DropColumn(
                name: "AuditScheduleId",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "AuditeeNameText",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "AuditeeSignatureUrl",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "AuditorSignatureUrl",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "EndLatitude",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "EndLongitude",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "HasCriticalDefect",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "IsPassed",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "MetadataValuesJson",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "PrimaryAuditorId",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "StaffCount",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "StartLatitude",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "StartLongitude",
                table: "AuditRecords");

            migrationBuilder.RenameColumn(
                name: "FullName",
                table: "Users",
                newName: "Role");

            migrationBuilder.RenameColumn(
                name: "Version",
                table: "SurveyForms",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "TargetingMode",
                table: "SurveyForms",
                newName: "TargetUnitsJson");

            migrationBuilder.RenameColumn(
                name: "BrandName",
                table: "Locations",
                newName: "ManagerName");

            migrationBuilder.RenameColumn(
                name: "SubmissionDeadline",
                table: "CapTasks",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "IssueItem",
                table: "CapTasks",
                newName: "Severity");

            migrationBuilder.RenameColumn(
                name: "CompletedAt",
                table: "CapTasks",
                newName: "SubmittedAt");

            migrationBuilder.RenameColumn(
                name: "ClosedAt",
                table: "CapTasks",
                newName: "EvidencePhotoUrl");

            migrationBuilder.RenameColumn(
                name: "IsNa",
                table: "AuditResponses",
                newName: "CapRequired");

            migrationBuilder.RenameColumn(
                name: "CategoryName",
                table: "AuditResponses",
                newName: "PhotoUrl");

            migrationBuilder.RenameColumn(
                name: "SubmittedAt",
                table: "AuditRecords",
                newName: "ResultStatus");

            migrationBuilder.RenameColumn(
                name: "StartedAt",
                table: "AuditRecords",
                newName: "AuditorSignature");

            migrationBuilder.RenameColumn(
                name: "SignedAt",
                table: "AuditRecords",
                newName: "AuditeeSignature");

            migrationBuilder.RenameColumn(
                name: "AuditeeUserId",
                table: "AuditRecords",
                newName: "ScheduleId");

            migrationBuilder.RenameColumn(
                name: "AuditType",
                table: "AuditRecords",
                newName: "CreatedAt");

            migrationBuilder.AlterColumn<int>(
                name: "FullScore",
                table: "SurveyItems",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "REAL");

            migrationBuilder.AddColumn<string>(
                name: "SopRef",
                table: "SurveyItems",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AssignedAuditorsJson",
                table: "SurveyForms",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "SurveyForms",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FormType",
                table: "SurveyForms",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TargetMode",
                table: "SurveyForms",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "Locations",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "CapTasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "CapTasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditorFeedback",
                table: "CapTasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectionAction",
                table: "CapTasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "Deadline",
                table: "CapTasks",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "RootCause",
                table: "CapTasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<int>(
                name: "SurveyFormId",
                table: "AuditSchedules",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditSchedules",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditorName",
                table: "AuditSchedules",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<int>(
                name: "SurveyItemId",
                table: "AuditResponses",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditResponses",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnswerValue",
                table: "AuditResponses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CapDeadline",
                table: "AuditResponses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MaxScore",
                table: "AuditResponses",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "QuestionText",
                table: "AuditResponses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "QuestionType",
                table: "AuditResponses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SectionTitle",
                table: "AuditResponses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "AuditRecords",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditeeName",
                table: "AuditRecords",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuditorName",
                table: "AuditRecords",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuditorRole",
                table: "AuditRecords",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_LocationId",
                table: "CapTasks",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_LocationId",
                table: "AuditRecords",
                column: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                table: "AuditSchedules",
                column: "SurveyFormId",
                principalTable: "SurveyForms",
                principalColumn: "Id");
        }
    }
}
