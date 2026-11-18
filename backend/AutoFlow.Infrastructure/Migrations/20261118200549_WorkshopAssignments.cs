using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoFlow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkshopAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ManagerName",
                table: "WorkOrders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MechanicId",
                table: "WorkOrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MechanicName",
                table: "WorkOrderItems",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerName",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "MechanicId",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "MechanicName",
                table: "WorkOrderItems");
        }
    }
}
