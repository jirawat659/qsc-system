using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryNameToCapTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryName",
                table: "CapTasks",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoryName",
                table: "CapTasks");
        }
    }
}
