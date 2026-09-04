using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditRecordEditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditRecordEditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AuditRecordId = table.Column<int>(type: "INTEGER", nullable: false),
                    EditedByUserId = table.Column<int>(type: "INTEGER", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Reason = table.Column<string>(type: "TEXT", nullable: false),
                    ChangesSummaryJson = table.Column<string>(type: "TEXT", nullable: true)
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

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecordEditLogs_AuditRecordId",
                table: "AuditRecordEditLogs",
                column: "AuditRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecordEditLogs_EditedByUserId",
                table: "AuditRecordEditLogs",
                column: "EditedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditRecordEditLogs");
        }
    }
}
