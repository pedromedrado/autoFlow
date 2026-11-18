using System.Security.Claims;
using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

public static class Administration
{
    public static void MapAdministration(this WebApplication app)
    {
        var group = app.MapGroup("/api/administration/users").RequireAuthorization(Permissions.ManageUsers);
        group.MapGet("/", ListAsync);
        group.MapPost("/", CreateAsync);
        group.MapPut("/{id}", UpdateAsync);
        group.MapDelete("/{id}", DeleteAsync);
    }

    private static async Task<IResult> ListAsync(AppDbContext db, ICurrentTenant tenant)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();

        var users = await (
            from user in db.Users.AsNoTracking()
            join membership in db.UserRoles on user.Id equals membership.UserId
            join role in db.Roles on membership.RoleId equals role.Id
            where user.DealershipId == dealershipId
            orderby user.DisplayName, user.Id
            select new { user.Id, user.DisplayName, user.Email, user.StoreId, Role = role.Name }
        ).ToListAsync();
        return Results.Ok(users);
    }

    private static async Task<IResult> CreateAsync(
        UserInput input, ICurrentTenant tenant, UserManager<AppUser> users,
        RoleManager<IdentityRole> roles, AppDbContext db, ClaimsPrincipal actor)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        if (!Valid(input) || string.IsNullOrWhiteSpace(input.Password) || input.Password.Length > 128)
            return Results.BadRequest(new { error = "Informe nome, e-mail, perfil e senha inicial válidos." });

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        if (!await ValidStoreAsync(input.StoreId, dealershipId, db))
            return Results.BadRequest(new { error = "Selecione uma loja da sua concessionária." });
        if (!await roles.RoleExistsAsync(input.Role))
        {
            var roleResult = await roles.CreateAsync(new IdentityRole(input.Role));
            if (!roleResult.Succeeded) return IdentityError(roleResult);
        }
        var user = new AppUser
        {
            DisplayName = input.DisplayName.Trim(),
            Email = input.Email.Trim(),
            UserName = input.Email.Trim(),
            DealershipId = dealershipId,
            StoreId = input.StoreId
        };
        var result = await users.CreateAsync(user, input.Password);
        if (!result.Succeeded) return IdentityError(result);

        result = await users.AddToRoleAsync(user, input.Role);
        if (!result.Succeeded) return IdentityError(result);

        await AuditAsync(db, actor, dealershipId, $"UserCreated:{user.Id}");
        await transaction.CommitAsync();
        return Results.Created($"/api/administration/users/{user.Id}", new { user.Id });
    }

    private static async Task<IResult> UpdateAsync(
        string id, UserInput input, ICurrentTenant tenant, UserManager<AppUser> users,
        RoleManager<IdentityRole> roles, AppDbContext db, ClaimsPrincipal actor)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        if (!Valid(input)) return Results.BadRequest(new { error = "Informe nome, e-mail e perfil válidos." });

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id && x.DealershipId == dealershipId);
        if (user is null) return Results.NotFound();

        var currentRoles = await users.GetRolesAsync(user);
        if (currentRoles.Contains(Roles.Master) || user.Id == actor.FindFirstValue(ClaimTypes.NameIdentifier))
            return Results.Forbid();

        if (!await ValidStoreAsync(input.StoreId, dealershipId, db))
            return Results.BadRequest(new { error = "Selecione uma loja da sua concessionária." });

        user.StoreId = input.StoreId;
        user.DisplayName = input.DisplayName.Trim();
        user.Email = input.Email.Trim();
        user.UserName = user.Email;
        var result = await users.UpdateAsync(user);
        if (!result.Succeeded) return IdentityError(result);

        if (currentRoles.Count != 1 || currentRoles[0] != input.Role)
        {
            if (!await roles.RoleExistsAsync(input.Role))
            {
                var roleResult = await roles.CreateAsync(new IdentityRole(input.Role));
                if (!roleResult.Succeeded) return IdentityError(roleResult);
            }
            result = await users.RemoveFromRolesAsync(user, currentRoles);
            if (!result.Succeeded) return IdentityError(result);
            result = await users.AddToRoleAsync(user, input.Role);
            if (!result.Succeeded) return IdentityError(result);
        }
        result = await users.UpdateSecurityStampAsync(user);
        if (!result.Succeeded) return IdentityError(result);

        await AuditAsync(db, actor, dealershipId, $"UserUpdated:{user.Id}");
        await transaction.CommitAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAsync(
        string id, ICurrentTenant tenant, UserManager<AppUser> users, AppDbContext db, ClaimsPrincipal actor)
    {
        if (tenant.DealershipId is not Guid dealershipId) return Results.Forbid();
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id && x.DealershipId == dealershipId);
        if (user is null) return Results.NotFound();
        if (user.Id == actor.FindFirstValue(ClaimTypes.NameIdentifier) || await users.IsInRoleAsync(user, Roles.Master))
            return Results.Forbid();

        await using var transaction = await db.Database.BeginTransactionAsync();
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded) return IdentityError(result);

        await AuditAsync(db, actor, dealershipId, $"UserDeleted:{id}");
        await transaction.CommitAsync();
        return Results.NoContent();
    }

    private static Task<bool> ValidStoreAsync(Guid? storeId, Guid dealershipId, AppDbContext db) =>
        storeId is null ? Task.FromResult(true) : db.Set<Store>().AnyAsync(x => x.Id == storeId && x.DealershipId == dealershipId);

    private static bool Valid(UserInput input) =>
        !string.IsNullOrWhiteSpace(input.DisplayName) && input.DisplayName.Length <= 160 &&
        !string.IsNullOrWhiteSpace(input.Email) && input.Email.Length <= 254 &&
        new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(input.Email.Trim()) &&
        Roles.Operational.Contains(input.Role);

    private static IResult IdentityError(IdentityResult result)
    {
        if (result.Errors.Any(e => e.Code == "ConcurrencyFailure"))
            return Results.Conflict(new { error = "O usuário foi alterado em outra sessão. Atualize a lista." });

        return Results.BadRequest(new { error = "Confira se o e-mail já existe e se a senha tem pelo menos 12 caracteres, com letras maiúsculas e minúsculas, número e símbolo." });
    }

    private static async Task AuditAsync(AppDbContext db, ClaimsPrincipal actor, Guid dealershipId, string action)
    {
        db.AuditLogs.Add(new AuditLog
        {
            DealershipId = dealershipId,
            UserId = actor.FindFirstValue(ClaimTypes.NameIdentifier)!,
            Action = action
        });
        await db.SaveChangesAsync();
    }

    public sealed record UserInput(string DisplayName, string Email, string Role, string? Password, Guid? StoreId);
}
