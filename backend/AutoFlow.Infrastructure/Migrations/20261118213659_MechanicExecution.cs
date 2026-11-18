using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoFlow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MechanicExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "WorkOrderItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExecutionVersion",
                table: "WorkOrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PauseReason",
                table: "WorkOrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "WorkOrderItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PausedSeconds",
                table: "WorkOrderItems",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Report",
                table: "WorkOrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedAt",
                table: "WorkOrderItems",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "ExecutionVersion",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "PauseReason",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "PausedSeconds",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "Report",
                table: "WorkOrderItems");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "WorkOrderItems");
        }
    }
}
