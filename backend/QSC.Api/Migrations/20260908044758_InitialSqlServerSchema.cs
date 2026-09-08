using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialSqlServerSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Brands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Brands", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LocationTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Module = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NavConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    PermissionId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    BranchScope = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BrandScope = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MustChangePassword = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Locations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LocationTypeId = table.Column<int>(type: "int", nullable: false),
                    ManagerUserId = table.Column<int>(type: "int", nullable: true),
                    Latitude = table.Column<double>(type: "float", nullable: false),
                    Longitude = table.Column<double>(type: "float", nullable: false),
                    Region = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BrandName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LastScore = table.Column<double>(type: "float", nullable: false),
                    LastAuditDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Locations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Locations_LocationTypes_LocationTypeId",
                        column: x => x.LocationTypeId,
                        principalTable: "LocationTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Locations_Users_ManagerUserId",
                        column: x => x.ManagerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyForms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormGroupId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    LocationTypeId = table.Column<int>(type: "int", nullable: true),
                    BrandId = table.Column<int>(type: "int", nullable: true),
                    PassingScore = table.Column<double>(type: "float", nullable: false),
                    TargetingMode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsLatest = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    MetadataConfigJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyForms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyForms_Brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyForms_LocationTypes_LocationTypeId",
                        column: x => x.LocationTypeId,
                        principalTable: "LocationTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyForms_SurveyForms_FormGroupId",
                        column: x => x.FormGroupId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyForms_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserBrands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    BrandId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                name: "LocationBrands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    BrandId = table.Column<int>(type: "int", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                name: "UserLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                name: "AuditDrafts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    AuditorId = table.Column<int>(type: "int", nullable: false),
                    DraftPayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CurrentSectionIdx = table.Column<int>(type: "int", nullable: false),
                    TotalAnswered = table.Column<int>(type: "int", nullable: false),
                    TotalQuestions = table.Column<int>(type: "int", nullable: false),
                    StartLatitude = table.Column<double>(type: "float", nullable: true),
                    StartLongitude = table.Column<double>(type: "float", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditDrafts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditDrafts_Users_AuditorId",
                        column: x => x.AuditorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Time = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    AuditType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditSchedules_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditSchedules_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyFormBrands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    BrandId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyFormBrands", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyFormBrands_Brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SurveyFormBrands_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyFormTargetLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyFormTargetLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyFormTargetLocations_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyFormTargetLocations_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveySections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    WeightPercent = table.Column<double>(type: "float", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveySections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveySections_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    SurveyFormId = table.Column<int>(type: "int", nullable: false),
                    PrimaryAuditorId = table.Column<int>(type: "int", nullable: false),
                    AuditeeUserId = table.Column<int>(type: "int", nullable: true),
                    AuditeeNameText = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AuditScheduleId = table.Column<int>(type: "int", nullable: true),
                    AuditDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalScore = table.Column<double>(type: "float", nullable: false),
                    MaxScore = table.Column<double>(type: "float", nullable: false),
                    PercentageScore = table.Column<double>(type: "float", nullable: false),
                    IsPassed = table.Column<bool>(type: "bit", nullable: false),
                    HasCriticalDefect = table.Column<bool>(type: "bit", nullable: false),
                    StaffCount = table.Column<int>(type: "int", nullable: false),
                    AuditType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MetadataValuesJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AuditorSignatureUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AuditeeSignatureUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartLatitude = table.Column<double>(type: "float", nullable: true),
                    StartLongitude = table.Column<double>(type: "float", nullable: true),
                    EndLatitude = table.Column<double>(type: "float", nullable: true),
                    EndLongitude = table.Column<double>(type: "float", nullable: true),
                    IsBackdated = table.Column<bool>(type: "bit", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditRecords_AuditSchedules_AuditScheduleId",
                        column: x => x.AuditScheduleId,
                        principalTable: "AuditSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditRecords_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditRecords_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditRecords_Users_AuditeeUserId",
                        column: x => x.AuditeeUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AuditRecords_Users_PrimaryAuditorId",
                        column: x => x.PrimaryAuditorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditScheduleAuditors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuditScheduleId = table.Column<int>(type: "int", nullable: false),
                    AuditorId = table.Column<int>(type: "int", nullable: false),
                    IsLead = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                name: "SurveyItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveySectionId = table.Column<int>(type: "int", nullable: false),
                    QuestionText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    QuestionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FullScore = table.Column<double>(type: "float", nullable: false),
                    IsCritical = table.Column<bool>(type: "bit", nullable: false),
                    CategoryCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyItems_SurveySections_SurveySectionId",
                        column: x => x.SurveySectionId,
                        principalTable: "SurveySections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditRecordEditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuditRecordId = table.Column<int>(type: "int", nullable: false),
                    EditedByUserId = table.Column<int>(type: "int", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ChangesSummaryJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditRecordEditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditRecordEditLogs_AuditRecords_AuditRecordId",
                        column: x => x.AuditRecordId,
                        principalTable: "AuditRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditRecordEditLogs_Users_EditedByUserId",
                        column: x => x.EditedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditResponses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuditRecordId = table.Column<int>(type: "int", nullable: false),
                    SurveyItemId = table.Column<int>(type: "int", nullable: false),
                    ScoreGiven = table.Column<double>(type: "float", nullable: false),
                    IsPassed = table.Column<bool>(type: "bit", nullable: false),
                    IsNa = table.Column<bool>(type: "bit", nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditResponses_AuditRecords_AuditRecordId",
                        column: x => x.AuditRecordId,
                        principalTable: "AuditRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditResponses_SurveyItems_SurveyItemId",
                        column: x => x.SurveyItemId,
                        principalTable: "SurveyItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditResponseImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuditResponseId = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UploadedBy = table.Column<int>(type: "int", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                        name: "FK_AuditResponseImages_Users_UploadedBy",
                        column: x => x.UploadedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CapTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuditRecordId = table.Column<int>(type: "int", nullable: false),
                    AuditResponseId = table.Column<int>(type: "int", nullable: true),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    IssueItem = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubmissionDeadline = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AssignedTo = table.Column<int>(type: "int", nullable: true),
                    VerifiedBy = table.Column<int>(type: "int", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CapTasks_AuditRecords_AuditRecordId",
                        column: x => x.AuditRecordId,
                        principalTable: "AuditRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CapTasks_AuditResponses_AuditResponseId",
                        column: x => x.AuditResponseId,
                        principalTable: "AuditResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CapTasks_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CapTasks_Users_AssignedTo",
                        column: x => x.AssignedTo,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CapTasks_Users_VerifiedBy",
                        column: x => x.VerifiedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CapTaskComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CapTaskId = table.Column<int>(type: "int", nullable: false),
                    SenderId = table.Column<int>(type: "int", nullable: false),
                    SenderRole = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CapTaskImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CapTaskId = table.Column<int>(type: "int", nullable: false),
                    Phase = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UploadedBy = table.Column<int>(type: "int", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    VersionNumber = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
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
                        name: "FK_CapTaskImages_Users_UploadedBy",
                        column: x => x.UploadedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_AuditorId_LocationId_SurveyFormId",
                table: "AuditDrafts",
                columns: new[] { "AuditorId", "LocationId", "SurveyFormId" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_LocationId",
                table: "AuditDrafts",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_SurveyFormId",
                table: "AuditDrafts",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecordEditLogs_AuditRecordId",
                table: "AuditRecordEditLogs",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecordEditLogs_EditedByUserId",
                table: "AuditRecordEditLogs",
                column: "EditedByUserId");

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
                name: "IX_AuditRecords_PrimaryAuditorId_AuditDate",
                table: "AuditRecords",
                columns: new[] { "PrimaryAuditorId", "AuditDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_SurveyFormId",
                table: "AuditRecords",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponseImages_AuditResponseId",
                table: "AuditResponseImages",
                column: "AuditResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponseImages_UploadedBy",
                table: "AuditResponseImages",
                column: "UploadedBy");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponses_AuditRecordId",
                table: "AuditResponses",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponses_SurveyItemId_IsPassed",
                table: "AuditResponses",
                columns: new[] { "SurveyItemId", "IsPassed" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditorId",
                table: "AuditScheduleAuditors",
                column: "AuditorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId_AuditorId",
                table: "AuditScheduleAuditors",
                columns: new[] { "AuditScheduleId", "AuditorId" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_CreatedBy",
                table: "AuditSchedules",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_LocationId_ScheduledDate",
                table: "AuditSchedules",
                columns: new[] { "LocationId", "ScheduledDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_ScheduledDate",
                table: "AuditSchedules",
                column: "ScheduledDate");

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_Status_ScheduledDate",
                table: "AuditSchedules",
                columns: new[] { "Status", "ScheduledDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_SurveyFormId",
                table: "AuditSchedules",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Code",
                table: "Brands",
                column: "Code");

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
                name: "IX_CapTaskImages_UploadedBy",
                table: "CapTaskImages",
                column: "UploadedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AssignedTo_Status",
                table: "CapTasks",
                columns: new[] { "AssignedTo", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AuditRecordId",
                table: "CapTasks",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AuditResponseId",
                table: "CapTasks",
                column: "AuditResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_LocationId_CreatedAt",
                table: "CapTasks",
                columns: new[] { "LocationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_LocationId_Status",
                table: "CapTasks",
                columns: new[] { "LocationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_Status_SubmissionDeadline",
                table: "CapTasks",
                columns: new[] { "Status", "SubmissionDeadline" });

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_VerifiedBy",
                table: "CapTasks",
                column: "VerifiedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LocationBrands_BrandId",
                table: "LocationBrands",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationBrands_LocationId_BrandId",
                table: "LocationBrands",
                columns: new[] { "LocationId", "BrandId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_Code",
                table: "Locations",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_IsActive_Code",
                table: "Locations",
                columns: new[] { "IsActive", "Code" });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_IsActive_LastScore",
                table: "Locations",
                columns: new[] { "IsActive", "LastScore" });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_LocationTypeId",
                table: "Locations",
                column: "LocationTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Locations_ManagerUserId",
                table: "Locations",
                column: "ManagerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationTypes_Code",
                table: "LocationTypes",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Code",
                table: "Permissions",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                table: "RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId_PermissionId",
                table: "RolePermissions",
                columns: new[] { "RoleId", "PermissionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Code",
                table: "Roles",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormBrands_BrandId",
                table: "SurveyFormBrands",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormBrands_SurveyFormId_BrandId",
                table: "SurveyFormBrands",
                columns: new[] { "SurveyFormId", "BrandId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_BrandId",
                table: "SurveyForms",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_CreatedBy",
                table: "SurveyForms",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_FormGroupId",
                table: "SurveyForms",
                column: "FormGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_IsActive_IsLatest",
                table: "SurveyForms",
                columns: new[] { "IsActive", "IsLatest" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyForms_LocationTypeId",
                table: "SurveyForms",
                column: "LocationTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormTargetLocations_LocationId",
                table: "SurveyFormTargetLocations",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFormTargetLocations_SurveyFormId_LocationId",
                table: "SurveyFormTargetLocations",
                columns: new[] { "SurveyFormId", "LocationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyItems_SurveySectionId",
                table: "SurveyItems",
                column: "SurveySectionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveySections_SurveyFormId",
                table: "SurveySections",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBrands_BrandId",
                table: "UserBrands",
                column: "BrandId");

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
                name: "IX_UserLocations_UserId_LocationId",
                table: "UserLocations",
                columns: new[] { "UserId", "LocationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditDrafts");

            migrationBuilder.DropTable(
                name: "AuditRecordEditLogs");

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
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "SurveyFormBrands");

            migrationBuilder.DropTable(
                name: "SurveyFormTargetLocations");

            migrationBuilder.DropTable(
                name: "UserBrands");

            migrationBuilder.DropTable(
                name: "UserLocations");

            migrationBuilder.DropTable(
                name: "CapTasks");

            migrationBuilder.DropTable(
                name: "Permissions");

            migrationBuilder.DropTable(
                name: "AuditResponses");

            migrationBuilder.DropTable(
                name: "AuditRecords");

            migrationBuilder.DropTable(
                name: "SurveyItems");

            migrationBuilder.DropTable(
                name: "AuditSchedules");

            migrationBuilder.DropTable(
                name: "SurveySections");

            migrationBuilder.DropTable(
                name: "Locations");

            migrationBuilder.DropTable(
                name: "SurveyForms");

            migrationBuilder.DropTable(
                name: "Brands");

            migrationBuilder.DropTable(
                name: "LocationTypes");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Roles");
        }
    }
}
