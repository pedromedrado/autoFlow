using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore;

namespace AutoFlow.Infrastructure;

public static class LocalOperationsSchema
{
    public static async Task EnsureAsync(AppDbContext db)
    {
        if (!db.Database.IsSqlite())
            throw new InvalidOperationException("A preparação local exige SQLite.");

        await db.Database.EnsureCreatedAsync();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Stores" (
                "Id" TEXT NOT NULL PRIMARY KEY,
                "DealershipId" TEXT NOT NULL,
                "Name" TEXT NOT NULL,
                "Document" TEXT NOT NULL,
                "City" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_Stores_DealershipId" ON "Stores" ("DealershipId");

            CREATE TABLE IF NOT EXISTS "CatalogServices" (
                "Id" TEXT NOT NULL PRIMARY KEY,
                "DealershipId" TEXT NOT NULL,
                "Name" TEXT NOT NULL,
                "Minutes" INTEGER NOT NULL,
                "Price" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_CatalogServices_DealershipId" ON "CatalogServices" ("DealershipId");

            CREATE TABLE IF NOT EXISTS "WorkOrders" (
                "Id" TEXT NOT NULL PRIMARY KEY,
                "DealershipId" TEXT NOT NULL,
                "StoreId" TEXT NOT NULL,
                "Customer" TEXT NOT NULL,
                "Vehicle" TEXT NOT NULL,
                "Plate" TEXT NOT NULL,
                "Consultant" TEXT NOT NULL,
                "OpenedAt" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_WorkOrders_DealershipId_OpenedAt" ON "WorkOrders" ("DealershipId", "OpenedAt");

            CREATE TABLE IF NOT EXISTS "WorkOrderItems" (
                "Id" TEXT NOT NULL PRIMARY KEY,
                "WorkOrderId" TEXT NOT NULL REFERENCES "WorkOrders" ("Id") ON DELETE CASCADE,
                "Name" TEXT NOT NULL,
                "Minutes" INTEGER NOT NULL,
                "Price" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderItems_WorkOrderId" ON "WorkOrderItems" ("WorkOrderId");
            """);
        var hasStoreColumn = await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(*) AS Value FROM pragma_table_info('AspNetUsers') WHERE name = 'StoreId'").SingleAsync();
        if (hasStoreColumn == 0)
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE AspNetUsers ADD COLUMN StoreId TEXT NULL");
        await AddColumnAsync(db, "WorkOrders", "ManagerName");
        await AddColumnAsync(db, "WorkOrderItems", "MechanicId");
        await AddColumnAsync(db, "WorkOrderItems", "MechanicName");
        await AddColumnAsync(db, "WorkOrderItems", "ApprovedAt");
        await AddColumnAsync(db, "WorkOrderItems", "ApprovedBy");
        await AddColumnAsync(db, "WorkOrderItems", "StartedAt");
        await AddColumnAsync(db, "WorkOrderItems", "CompletedAt");
        await AddColumnAsync(db, "WorkOrderItems", "PausedAt");
        await AddColumnAsync(db, "WorkOrderItems", "PauseReason");
        await AddColumnAsync(db, "WorkOrderItems", "Report");
        await AddColumnAsync(db, "WorkOrderItems", "PausedSeconds", "INTEGER NOT NULL DEFAULT 0");
        await AddColumnAsync(db, "WorkOrderItems", "ExecutionVersion", "INTEGER NOT NULL DEFAULT 0");
        await transaction.CommitAsync();
    }
    private static async Task AddColumnAsync(AppDbContext db, string table, string column, string type = "TEXT NULL")
    {
        // Table and column names come only from the schema declarations above.
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
        command.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'";
        if (Convert.ToInt32(await command.ExecuteScalarAsync()) == 0)
        {
            command.CommandText = $"ALTER TABLE [{table}] ADD COLUMN [{column}] {type}";
            await command.ExecuteNonQueryAsync();
        }
    }
}
