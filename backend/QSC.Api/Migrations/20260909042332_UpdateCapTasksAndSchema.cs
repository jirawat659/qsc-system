using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCapTasksAndSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CapTasks_AuditRecords_AuditRecordId",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "BrandName",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "StaffCount",
                table: "AuditRecords");

            migrationBuilder.AlterColumn<int>(
                name: "AuditRecordId",
                table: "CapTasks",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "FollowUpScheduleId",
                table: "CapTasks",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FollowUpStatus",
                table: "CapTasks",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NextAuditNote",
                table: "CapTasks",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AuditScheduleId",
                table: "AuditDrafts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditDrafts_AuditScheduleId",
                table: "AuditDrafts",
                column: "AuditScheduleId");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditDrafts_AuditSchedules_AuditScheduleId",
                table: "AuditDrafts",
                column: "AuditScheduleId",
                principalTable: "AuditSchedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CapTasks_AuditRecords_AuditRecordId",
                table: "CapTasks",
                column: "AuditRecordId",
                principalTable: "AuditRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditDrafts_AuditSchedules_AuditScheduleId",
                table: "AuditDrafts");

            migrationBuilder.DropForeignKey(
                name: "FK_CapTasks_AuditRecords_AuditRecordId",
                table: "CapTasks");

            migrationBuilder.DropIndex(
                name: "IX_AuditDrafts_AuditScheduleId",
                table: "AuditDrafts");

            migrationBuilder.DropColumn(
                name: "FollowUpScheduleId",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "FollowUpStatus",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "NextAuditNote",
                table: "CapTasks");

            migrationBuilder.DropColumn(
                name: "AuditScheduleId",
                table: "AuditDrafts");

            migrationBuilder.AddColumn<string>(
                name: "BrandName",
                table: "Locations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<int>(
                name: "AuditRecordId",
                table: "CapTasks",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StaffCount",
                table: "AuditRecords",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddForeignKey(
                name: "FK_CapTasks_AuditRecords_AuditRecordId",
                table: "CapTasks",
                column: "AuditRecordId",
                principalTable: "AuditRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
