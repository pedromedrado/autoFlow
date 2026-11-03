using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
public static class Seed {
 public static async Task Run(IServiceProvider services,IConfiguration config){
 var password=config["Seed:Password"]??throw new InvalidOperationException("Configure Seed__Password (12+ caracteres, maiúscula, número e símbolo).");
 var db=services.GetRequiredService<AppDbContext>();if(db.Database.IsSqlite())await db.Database.EnsureCreatedAsync();else await db.Database.MigrateAsync();
 var roles=services.GetRequiredService<RoleManager<IdentityRole>>();var users=services.GetRequiredService<UserManager<AppUser>>();
 foreach(var r in Roles.All)if(!await roles.RoleExistsAsync(r))Check(await roles.CreateAsync(new(r)));
 var id=Guid.Parse("a1000000-0000-0000-0000-000000000001");
 if(!await db.Dealerships.IgnoreQueryFilters().AnyAsync(x=>x.Id==id)){db.Dealerships.Add(new(){Id=id,Name="AutoFlow • Concessionária demonstração"});await db.SaveChangesAsync();}
 foreach(var r in Roles.All){var email=$"{r.ToLowerInvariant()}@autoflow.local";if(await users.FindByEmailAsync(email)!=null)continue;
 var u=new AppUser{UserName=email,Email=email,DisplayName=r,DealershipId=id};Check(await users.CreateAsync(u,password));Check(await users.AddToRoleAsync(u,r));}
 }
 static void Check(IdentityResult r){if(!r.Succeeded)throw new InvalidOperationException(string.Join("; ",r.Errors.Select(x=>x.Description)));}
}
