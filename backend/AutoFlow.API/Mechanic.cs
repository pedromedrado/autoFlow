using System.Security.Claims;
using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;

public static class Mechanic
{
    public static void MapMechanic(this WebApplication app)
    {
        var group = app.MapGroup("/api/mechanic").RequireAuthorization(policy => policy.RequireRole(Roles.Mechanic));
        group.MapGet("/orders", ListAsync);
        group.MapPost("/services/{serviceId:guid}/execution", ExecuteAsync);
        group.MapPost("/help", async (ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db) =>
        {
            if (tenant.DealershipId is not Guid id) return Results.Forbid();
            db.AuditLogs.Add(new AuditLog { DealershipId = id, UserId = actor.FindFirstValue(ClaimTypes.NameIdentifier)!, Action = "WorkshopHelpRequested" });
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Solicitação registrada para o chefe de oficina." });
        });
        app.MapGet("/api/workshop/help", async (AppDbContext db) =>
        {
            var rows = await (from audit in db.AuditLogs
                              join user in db.Users on audit.UserId equals user.Id
                              where audit.Action == "WorkshopHelpRequested"
                              select new { audit.Id, audit.CreatedAt, Name = user.DisplayName }).ToListAsync();
            return Results.Ok(rows.OrderByDescending(row => row.CreatedAt).Take(20));
        }).RequireAuthorization(policy => policy.RequireRole(Roles.Manager, Roles.Master));
    }

    private static async Task<IResult> ListAsync(ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        var orders = await db.Set<WorkOrder>().Where(order => order.DealershipId == dealershipId && order.Items.Any(item => item.MechanicId == actorId))
            .Include(order => order.Items).AsNoTracking().OrderByDescending(order => order.OpenedAt).ToListAsync();
        var now = DateTime.UtcNow;
        return Results.Ok(orders.Select(order => new
        {
            order.Id, order.Customer, order.Vehicle, order.Plate, order.Consultant, order.ManagerName, order.OpenedAt, order.Status,
            TotalServices = order.Items.Count,
            CompletedServices = order.Items.Count(item => item.CompletedAt.HasValue),
            Items = order.Items.Where(item => item.MechanicId == actorId).Select(item => new
            {
                item.Id, item.Name, item.Minutes, item.Status, item.StartedAt, item.CompletedAt, item.PausedAt,
                item.PausedSeconds, item.PauseReason, item.Report, item.ExecutionVersion, item.ApprovedAt,
                EffectiveSeconds = EffectiveSeconds(item, now),
                ExpectedAt = item.StartedAt?.AddMinutes(item.Minutes).AddSeconds(item.PausedSeconds)
            })
        }));
    }

    private static long EffectiveSeconds(WorkOrderItem item, DateTime now)
    {
        if (!item.StartedAt.HasValue) return 0;
        var end = item.CompletedAt ?? item.PausedAt ?? now;
        return Math.Max(0, (long)(end - item.StartedAt.Value).TotalSeconds - item.PausedSeconds);
    }

    private static async Task<IResult> ExecuteAsync(
        Guid serviceId, ExecutionInput input, ICurrentTenant tenant, ClaimsPrincipal actor, AppDbContext db)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var order = await db.Set<WorkOrder>().Include(order => order.Items)
            .SingleOrDefaultAsync(order => order.DealershipId == dealershipId && order.Items.Any(item => item.Id == serviceId && item.MechanicId == actorId));
        if (order is null) return Results.NotFound();
        var item = order.Items.Single(item => item.Id == serviceId);
        if (item.ExecutionVersion != input.Version)
            return Results.Conflict(new { error = "O serviço foi atualizado em outra sessão. Atualize para continuar." });

        var now = DateTime.UtcNow;
        switch (input.Action)
        {
            case "start" when !item.StartedAt.HasValue:
                item.StartedAt = now;
                break;
            case "pause" when item.Status == "Em execução":
                if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000)
                    return Results.BadRequest(new { error = "Informe o motivo da pausa." });
                item.PausedAt = now;
                item.PauseReason = input.Reason.Trim();
                break;
            case "resume" when item.Status == "Pausado":
                item.PausedSeconds += Math.Max(0, (long)(now - item.PausedAt!.Value).TotalSeconds);
                item.PausedAt = null;
                break;
            case "complete" when item.Status == "Em execução":
                if (!input.ChecklistConfirmed || string.IsNullOrWhiteSpace(input.Report) || input.Report.Length > 4000)
                    return Results.BadRequest(new { error = "Confirme a verificação do serviço e preencha o relatório." });
                item.CompletedAt = now;
                item.Report = input.Report.Trim();
                break;
            default:
                return Results.Conflict(new { error = "Esta ação não está disponível no estado atual do serviço." });
        }
        item.ExecutionVersion++;
        db.AuditLogs.Add(new AuditLog
        {
            DealershipId = dealershipId, UserId = actorId!, Action = $"ServiceExecution:{input.Action}:{item.Id}"
        });
        try
        {
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict(new { error = "O serviço foi atualizado. Atualize para continuar." });
        }
        return Results.Ok(new { item.Id, item.Status, OrderStatus = order.Status, EffectiveSeconds = EffectiveSeconds(item, now) });
    }

    public sealed record ExecutionInput(string Action, int Version, string? Reason, string? Report, bool ChecklistConfirmed);
}
