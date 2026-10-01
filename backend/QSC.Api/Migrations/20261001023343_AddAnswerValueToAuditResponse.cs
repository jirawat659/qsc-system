using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAnswerValueToAuditResponse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AnswerValue",
                table: "AuditResponses",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnswerValue",
                table: "AuditResponses");
        }
    }
}
