using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCleanQscSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Locations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    FullName = table.Column<string>(type: "TEXT", nullable: false),
                    Region = table.Column<string>(type: "TEXT", nullable: false),
                    Address = table.Column<string>(type: "TEXT", nullable: false),
                    Phone = table.Column<string>(type: "TEXT", nullable: false),
                    ManagerName = table.Column<string>(type: "TEXT", nullable: false),
                    LastScore = table.Column<double>(type: "REAL", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Locations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SurveyForms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    FormType = table.Column<string>(type: "TEXT", nullable: false),
                    PassingScore = table.Column<double>(type: "REAL", nullable: false),
                    TargetMode = table.Column<string>(type: "TEXT", nullable: false),
                    TargetUnitsJson = table.Column<string>(type: "TEXT", nullable: false),
                    AssignedAuditorsJson = table.Column<string>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyForms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Role = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    SurveyFormId = table.Column<int>(type: "INTEGER", nullable: false),
                    ScheduleId = table.Column<int>(type: "INTEGER", nullable: true),
                    AuditorName = table.Column<string>(type: "TEXT", nullable: false),
                    AuditorRole = table.Column<string>(type: "TEXT", nullable: false),
                    AuditDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TotalScore = table.Column<double>(type: "REAL", nullable: false),
                    MaxScore = table.Column<double>(type: "REAL", nullable: false),
                    PercentageScore = table.Column<double>(type: "REAL", nullable: false),
                    ResultStatus = table.Column<string>(type: "TEXT", nullable: false),
                    AuditorSignature = table.Column<string>(type: "TEXT", nullable: true),
                    AuditeeSignature = table.Column<string>(type: "TEXT", nullable: true),
                    AuditeeName = table.Column<string>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditRecords_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditRecords_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    SurveyFormId = table.Column<int>(type: "INTEGER", nullable: true),
                    AuditorName = table.Column<string>(type: "TEXT", nullable: false),
                    AuditType = table.Column<string>(type: "TEXT", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditSchedules_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditSchedules_SurveyForms_SurveyFormId",
                        column: x => x.SurveyFormId,
                        principalTable: "SurveyForms",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "SurveySections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SurveyFormId = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false)
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
                name: "AuditResponses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuditRecordId = table.Column<int>(type: "INTEGER", nullable: false),
                    SurveyItemId = table.Column<int>(type: "INTEGER", nullable: true),
                    SectionTitle = table.Column<string>(type: "TEXT", nullable: false),
                    QuestionText = table.Column<string>(type: "TEXT", nullable: false),
                    QuestionType = table.Column<string>(type: "TEXT", nullable: false),
                    AnswerValue = table.Column<string>(type: "TEXT", nullable: false),
                    ScoreGiven = table.Column<double>(type: "REAL", nullable: false),
                    MaxScore = table.Column<double>(type: "REAL", nullable: false),
                    IsPassed = table.Column<bool>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: false),
                    PhotoUrl = table.Column<string>(type: "TEXT", nullable: true),
                    CapRequired = table.Column<bool>(type: "INTEGER", nullable: false),
                    CapDeadline = table.Column<DateTime>(type: "TEXT", nullable: true)
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
                });

            migrationBuilder.CreateTable(
                name: "CapTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuditRecordId = table.Column<int>(type: "INTEGER", nullable: false),
                    AuditResponseId = table.Column<int>(type: "INTEGER", nullable: true),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Severity = table.Column<string>(type: "TEXT", nullable: false),
                    Deadline = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    RootCause = table.Column<string>(type: "TEXT", nullable: false),
                    CorrectionAction = table.Column<string>(type: "TEXT", nullable: false),
                    EvidencePhotoUrl = table.Column<string>(type: "TEXT", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ApprovedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    AuditorFeedback = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
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
                        name: "FK_CapTasks_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SurveySectionId = table.Column<int>(type: "INTEGER", nullable: false),
                    QuestionText = table.Column<string>(type: "TEXT", nullable: false),
                    QuestionType = table.Column<string>(type: "TEXT", nullable: false),
                    FullScore = table.Column<int>(type: "INTEGER", nullable: false),
                    IsCritical = table.Column<bool>(type: "INTEGER", nullable: false),
                    SopRef = table.Column<string>(type: "TEXT", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_LocationId",
                table: "AuditRecords",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_SurveyFormId",
                table: "AuditRecords",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditResponses_AuditRecordId",
                table: "AuditResponses",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_LocationId",
                table: "AuditSchedules",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditSchedules_SurveyFormId",
                table: "AuditSchedules",
                column: "SurveyFormId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_AuditRecordId",
                table: "CapTasks",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_CapTasks_LocationId",
                table: "CapTasks",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyItems_SurveySectionId",
                table: "SurveyItems",
                column: "SurveySectionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveySections_SurveyFormId",
                table: "SurveySections",
                column: "SurveyFormId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditResponses");

            migrationBuilder.DropTable(
                name: "AuditSchedules");

            migrationBuilder.DropTable(
                name: "CapTasks");

            migrationBuilder.DropTable(
                name: "SurveyItems");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "AuditRecords");

            migrationBuilder.DropTable(
                name: "SurveySections");

            migrationBuilder.DropTable(
                name: "Locations");

            migrationBuilder.DropTable(
                name: "SurveyForms");
        }
    }
}
