using System.Security.Claims;
using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

public static class Workshop
{
    public static void MapWorkshop(this WebApplication app)
    {
        var group = app.MapGroup("/api/workshop").RequireAuthorization(policy => policy.RequireRole(Roles.Manager, Roles.Master));
        group.MapGet("/mechanics", async (AppDbContext db, ICurrentTenant tenant) =>
        {
            if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
            var members = await (
                from user in db.Users.AsNoTracking()
                join membership in db.UserRoles on user.Id equals membership.UserId
                join role in db.Roles on membership.RoleId equals role.Id
                where user.DealershipId == dealershipId && role.Name == Roles.Mechanic
                orderby user.DisplayName
                select new { user.Id, Name = user.DisplayName, user.StoreId }
            ).Distinct().ToListAsync();
            return Results.Ok(members);
        });
        group.MapPut("/orders/{orderId:guid}/assignments", AssignAsync);
        group.MapPost("/services/{serviceId:guid}/approve", ApproveAsync);
    }

    private static async Task<IResult> ApproveAsync(
        Guid serviceId, ApprovalInput input, ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var order = await db.Set<WorkOrder>().Include(order => order.Items)
            .SingleOrDefaultAsync(order => order.DealershipId == dealershipId && order.Items.Any(item => item.Id == serviceId));
        if (order is null) return Results.NotFound();
        var item = order.Items.Single(item => item.Id == serviceId);
        if (!item.CompletedAt.HasValue)
            return Results.Conflict(new { error = "O mecânico precisa concluir o serviço antes da conferência." });
        if (item.ApprovedAt.HasValue)
            return Results.Ok(new { item.Id, item.Status, OrderStatus = order.Status });
        if (item.ExecutionVersion != input.Version)
            return Results.Conflict(new { error = "O serviço foi atualizado. Reabra a conferência para continuar." });

        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        item.ApprovedAt = DateTime.UtcNow;
        item.ApprovedBy = actorId;
        item.ExecutionVersion++;
        db.AuditLogs.Add(new AuditLog { DealershipId = dealershipId, UserId = actorId!, Action = $"ServiceApproved:{item.Id}" });
        try
        {
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict(new { error = "Outra sessão atualizou este serviço. Atualize a página." });
        }
        return Results.Ok(new { item.Id, item.Status, OrderStatus = order.Status });
    }

    public sealed record ApprovalInput(int Version);

    private static async Task<IResult> AssignAsync(
        Guid orderId, AssignmentRequest input, ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        if (input.Items is not { Length: >= 1 and <= 100 } || input.Items.Select(x => x.ItemId).Distinct().Count() != input.Items.Length)
            return Results.BadRequest(new { error = "Selecione os serviços e seus responsáveis." });

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var order = await db.Set<WorkOrder>().Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == orderId && x.DealershipId == dealershipId);
        if (order is null) return Results.NotFound();
        if (!order.Items.Select(item => item.Id).ToHashSet().SetEquals(input.Items.Select(item => item.ItemId)))
            return Results.Conflict(new { error = "Os serviços desta OS foram alterados. Atualize a lista e tente novamente." });

        var mechanicIds = input.Items.Select(item => item.MechanicId).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToArray();
        var mechanics = await (
            from user in db.Users
            join membership in db.UserRoles on user.Id equals membership.UserId
            join role in db.Roles on membership.RoleId equals role.Id
            where user.DealershipId == dealershipId && role.Name == Roles.Mechanic && mechanicIds.Contains(user.Id)
            select new { user.Id, user.DisplayName, user.StoreId }
        ).Distinct().ToListAsync();
        if (mechanics.Count != mechanicIds.Length)
            return Results.BadRequest(new { error = "Há mecânicos indisponíveis ou de outra concessionária." });

        foreach (var request in input.Items)
        {
            var item = order.Items.Single(item => item.Id == request.ItemId);
            if (item.MechanicId != request.PreviousMechanicId)
                return Results.Conflict(new { error = "Outra sessão alterou a distribuição. Atualize antes de continuar." });
        }

        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        order.ManagerName = await db.Users.Where(user => user.Id == actorId && user.DealershipId == dealershipId)
            .Select(user => user.DisplayName).SingleAsync();
        foreach (var request in input.Items)
        {
            var item = order.Items.Single(item => item.Id == request.ItemId);
            var mechanic = mechanics.SingleOrDefault(mechanic => mechanic.Id == request.MechanicId);
            if (item.StartedAt.HasValue && item.MechanicId != request.MechanicId)
                return Results.Conflict(new { error = "O serviço já foi iniciado. A reatribuição de execução exige tratamento específico." });
            var oldId = item.MechanicId;
            item.MechanicId = mechanic?.Id;
            item.MechanicName = mechanic?.DisplayName;
            if (oldId != item.MechanicId)
            {
                // Assignment changes retain their responsible actor and service identifier.
                db.AuditLogs.Add(new AuditLog
                {
                    DealershipId = dealershipId, UserId = actorId!,
                    Action = item.MechanicId is null ? $"ServiceUnassigned:{item.Id}" : $"ServiceAssigned:{item.Id}:{item.MechanicId}"
                });
            }
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(new { order.Id, order.Status });
    }

    public sealed record AssignmentRequest(AssignmentItem[] Items);
    public sealed record AssignmentItem(Guid ItemId, string? MechanicId, string? PreviousMechanicId);
}
