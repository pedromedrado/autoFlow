using System.Security.Claims;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
public sealed class TenantClaimsFactory(UserManager<AppUser> users,RoleManager<IdentityRole> roles,IOptions<IdentityOptions> options):UserClaimsPrincipalFactory<AppUser,IdentityRole>(users,roles,options){
 protected override async Task<ClaimsIdentity> GenerateClaimsAsync(AppUser user){var identity=await base.GenerateClaimsAsync(user);identity.AddClaim(new("dealership",user.DealershipId.ToString()));foreach(var p in (await UserManager.GetRolesAsync(user)).SelectMany(Permissions.For).Distinct())identity.AddClaim(new("permission",p));return identity;}
}
