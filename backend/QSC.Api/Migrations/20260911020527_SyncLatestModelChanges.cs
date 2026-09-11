using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncLatestModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Brands_Code",
                table: "Brands");

            migrationBuilder.DropIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId_AuditorId",
                table: "AuditScheduleAuditors");

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Code",
                table: "Brands",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Name",
                table: "Brands",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId_AuditorId",
                table: "AuditScheduleAuditors",
                columns: new[] { "AuditScheduleId", "AuditorId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Brands_Code",
                table: "Brands");

            migrationBuilder.DropIndex(
                name: "IX_Brands_Name",
                table: "Brands");

            migrationBuilder.DropIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId_AuditorId",
                table: "AuditScheduleAuditors");

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Code",
                table: "Brands",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_AuditScheduleAuditors_AuditScheduleId_AuditorId",
                table: "AuditScheduleAuditors",
                columns: new[] { "AuditScheduleId", "AuditorId" });
        }
    }
}
