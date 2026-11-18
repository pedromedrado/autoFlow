using System.Security.Claims;
using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;

public static class Operations
{
    public static void MapOperations(this WebApplication app)
    {
        var group = app.MapGroup("/api/operations").RequireAuthorization();
        var master = new[] { Roles.Master };
        var readers = new[] { Roles.Master, Roles.Consultant, Roles.Manager };
        var writers = new[] { Roles.Master, Roles.Consultant };
        group.MapGet("/stores", async (AppDbContext db, ICurrentTenant tenant) =>
            await db.Set<Store>().Where(x => x.DealershipId == tenant.DealershipId).OrderBy(x => x.Name).ToListAsync())
            .RequireAuthorization(p => p.RequireRole(readers));
        group.MapGet("/services", async (AppDbContext db, ICurrentTenant tenant) =>
            await db.Set<CatalogService>().Where(x => x.DealershipId == tenant.DealershipId).OrderBy(x => x.Name).ToListAsync())
            .RequireAuthorization(p => p.RequireRole(readers));
        group.MapPost("/stores", CreateStore).RequireAuthorization(p => p.RequireRole(master));
        group.MapPut("/stores/{recordId:guid}", UpdateStore).RequireAuthorization(p => p.RequireRole(master));
        group.MapDelete("/stores/{recordId:guid}", DeleteStore).RequireAuthorization(p => p.RequireRole(master));
        group.MapPost("/services", CreateService).RequireAuthorization(p => p.RequireRole(master));
        group.MapPut("/services/{recordId:guid}", UpdateService).RequireAuthorization(p => p.RequireRole(master));
        group.MapDelete("/services/{recordId:guid}", DeleteService).RequireAuthorization(p => p.RequireRole(master));
        group.MapPut("/orders/{recordId:guid}", UpdateOrder).RequireAuthorization(p => p.RequireRole(writers));
        group.MapDelete("/orders/{recordId:guid}", DeleteOrder).RequireAuthorization(p => p.RequireRole(master));
        group.MapGet("/orders", ListOrders).RequireAuthorization(p => p.RequireRole(readers));
        group.MapPost("/orders", CreateOrder).RequireAuthorization(p => p.RequireRole(writers));
    }

    private static async Task<IResult> CreateStore(StoreInput input, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!ValidStore(input))
            return Results.BadRequest(new { error = "Informe nome, CNPJ e cidade." });
        var store = new Store { DealershipId = id, Name = input.Name.Trim(), Document = input.Document.Trim(), City = input.City.Trim() };
        db.Add(store);
        await db.SaveChangesAsync();
        return Results.Ok(store);
    }

    private static async Task<IResult> UpdateStore(Guid recordId, StoreInput input, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!ValidStore(input)) return Results.BadRequest(new { error = "Informe nome, CNPJ e cidade." });
        var store = await db.Set<Store>().SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (store is null) return Results.NotFound();

        store.Name = input.Name.Trim();
        store.Document = input.Document.Trim();
        store.City = input.City.Trim();
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteStore(Guid recordId, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var store = await db.Set<Store>().SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (store is null) return Results.NotFound();
        if (await db.Set<WorkOrder>().AnyAsync(x => x.DealershipId == id && x.StoreId == recordId))
            return Results.Conflict(new { error = "A loja possui ordens de serviço vinculadas e não pode ser excluída." });

        if (await db.Users.AnyAsync(x => x.DealershipId == id && x.StoreId == recordId))
            return Results.Conflict(new { error = "Transfira os usuários vinculados antes de excluir esta loja." });

        db.Remove(store);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.NoContent();
    }

    private static bool ValidStore(StoreInput input) =>
        Valid(input.Name, 160) && Valid(input.Document, 24) && Valid(input.City, 120);

    private static async Task<IResult> CreateService(ServiceInput input, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!ValidService(input))
            return Results.BadRequest(new { error = "Informe descrição, TMO em minutos e preço com até duas casas decimais." });
        var service = new CatalogService { DealershipId = id, Name = input.Name.Trim(), Minutes = input.Minutes, Price = input.Price };
        db.Add(service);
        await db.SaveChangesAsync();
        return Results.Ok(service);
    }

    private static async Task<IResult> UpdateService(Guid recordId, ServiceInput input, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!ValidService(input))
            return Results.BadRequest(new { error = "Informe descrição, TMO em minutos e preço com até duas casas decimais." });

        var service = await db.Set<CatalogService>().SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (service is null) return Results.NotFound();

        service.Name = input.Name.Trim();
        service.Minutes = input.Minutes;
        service.Price = input.Price;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteService(Guid recordId, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        var service = await db.Set<CatalogService>().SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (service is null) return Results.NotFound();

        db.Remove(service);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateOrder(Guid recordId, OrderEdit input, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!Valid(input.Customer, 160) || !Valid(input.Vehicle, 160) || !Valid(input.Plate, 10) ||
            input.ItemIds is null || input.ServiceIds is null ||
            input.ItemIds.Length + input.ServiceIds.Length is < 1 or > 100)
            return Results.BadRequest(new { error = "Informe cliente, veículo, placa, unidade e pelo menos um serviço." });

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var order = await db.Set<WorkOrder>().Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (order is null) return Results.NotFound();
        if (!await db.Set<Store>().AnyAsync(x => x.Id == input.StoreId && x.DealershipId == id))
            return Results.BadRequest(new { error = "Selecione uma loja da sua concessionária." });

        var keep = input.ItemIds.ToHashSet();
        if (!keep.IsSubsetOf(order.Items.Select(item => item.Id)))
            return Results.BadRequest(new { error = "A lista de serviços da OS mudou. Atualize a página." });
        var requested = input.ServiceIds.Distinct().ToArray();
        var services = await db.Set<CatalogService>().Where(x => x.DealershipId == id && requested.Contains(x.Id)).ToListAsync();
        if (services.Count != requested.Length)
            return Results.BadRequest(new { error = "Há serviços indisponíveis na seleção." });

        order.StoreId = input.StoreId;
        order.Customer = input.Customer.Trim();
        order.Vehicle = input.Vehicle.Trim();
        order.Plate = input.Plate.Trim().ToUpperInvariant();
        foreach (var item in order.Items.Where(item => !keep.Contains(item.Id)).ToList())
        {
            order.Items.Remove(item);
            db.Remove(item);
        }
        foreach (var service in services)
        {
            var item = new WorkOrderItem { WorkOrderId = order.Id, Name = service.Name, Minutes = service.Minutes, Price = service.Price };
            order.Items.Add(item);
            db.Add(item);
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteOrder(Guid recordId, ICurrentTenant tenant, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        var order = await db.Set<WorkOrder>().SingleOrDefaultAsync(x => x.Id == recordId && x.DealershipId == id);
        if (order is null) return Results.NotFound();

        db.Remove(order);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static bool ValidService(ServiceInput input) =>
        Valid(input.Name, 160) && input.Minutes is >= 1 and <= 10080 &&
        input.Price is >= 0 and <= 10000000 && decimal.Round(input.Price, 2) == input.Price;

    private static async Task<IResult> ListOrders(AppDbContext db, ICurrentTenant tenant)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        var orders = await db.Set<WorkOrder>().Where(x => x.DealershipId == id)
            .OrderByDescending(x => x.OpenedAt).Include(x => x.Items).AsNoTracking().ToListAsync();
        return Results.Ok(orders);
    }

    private static async Task<IResult> CreateOrder(OrderInput input, ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid id) return Results.Forbid();
        if (!Valid(input.Customer, 160) || !Valid(input.Vehicle, 160) || !Valid(input.Plate, 10) ||
            input.ServiceIds is not { Length: >= 1 and <= 100 })
            return Results.BadRequest(new { error = "Informe cliente, veículo, placa, unidade e pelo menos um serviço." });
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        if (!await db.Set<Store>().AnyAsync(x => x.Id == input.StoreId && x.DealershipId == id))
            return Results.BadRequest(new { error = "Selecione uma loja da sua concessionária." });
        var requested = input.ServiceIds.Distinct().ToArray();
        var services = await db.Set<CatalogService>().Where(x => x.DealershipId == id && requested.Contains(x.Id)).ToListAsync();
        if (services.Count != requested.Length)
            return Results.BadRequest(new { error = "Há serviços indisponíveis na seleção." });
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        var consultant = await db.Users.Where(x => x.Id == actorId && x.DealershipId == id).Select(x => x.DisplayName).SingleAsync();
        var order = new WorkOrder
        {
            DealershipId = id, StoreId = input.StoreId, Customer = input.Customer.Trim(),
            Vehicle = input.Vehicle.Trim(), Plate = input.Plate.Trim().ToUpperInvariant(), Consultant = consultant,
            Items = services.Select(s => new WorkOrderItem { Name = s.Name, Minutes = s.Minutes, Price = s.Price }).ToList()
        };
        db.Add(order);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(order);
    }

    private static bool Valid(string? value, int max) => !string.IsNullOrWhiteSpace(value) && value.Length <= max;
    public sealed record StoreInput(string Name, string Document, string City);
    public sealed record ServiceInput(string Name, int Minutes, decimal Price);
    public sealed record OrderEdit(Guid StoreId, string Customer, string Vehicle, string Plate, Guid[] ItemIds, Guid[] ServiceIds);
    public sealed record OrderInput(Guid StoreId, string Customer, string Vehicle, string Plate, Guid[] ServiceIds);
}
