using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using System.Threading.RateLimiting;
using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using FluentValidation;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
var builder=WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx,log)=>log.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());
if(builder.Environment.IsDevelopment())builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenant,CurrentTenant>();
builder.Services.AddScoped<IValidator<LoginRequest>,LoginValidator>();
var useSqlite=builder.Configuration["Database:Provider"]=="Sqlite";
if(useSqlite && !builder.Environment.IsDevelopment())throw new InvalidOperationException("SQLite dispon�vel somente em Development.");
builder.Services.AddDbContext<AppDbContext>(o=>{
 var connection=builder.Configuration.GetConnectionString("Database")??throw new InvalidOperationException("Configure ConnectionStrings__Database.");
 if(useSqlite)o.UseSqlite(connection);else o.UseSqlServer(connection);
});
builder.Services.AddIdentity<AppUser,IdentityRole>(o=> {
 o.Password.RequiredLength=12; o.Password.RequireDigit=true; o.Password.RequireUppercase=true; o.Password.RequireNonAlphanumeric=true;
 o.User.RequireUniqueEmail=true; o.Lockout.MaxFailedAccessAttempts=5; o.Lockout.DefaultLockoutTimeSpan=TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(o=> {
 o.Cookie.Name="__Host-AutoFlow";o.Cookie.HttpOnly=true;o.Cookie.SecurePolicy=CookieSecurePolicy.Always;o.Cookie.SameSite=SameSiteMode.Strict;
 o.ExpireTimeSpan=TimeSpan.FromHours(8);o.SlidingExpiration=false;
 o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};
 o.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return Task.CompletedTask;};
});
builder.Services.AddScoped<IUserClaimsPrincipalFactory<AppUser>, TenantClaimsFactory>();
builder.Services.AddAuthorization(o=>{foreach(var p in new[]{Permissions.ReadOrders,Permissions.CreateOrders,Permissions.ManageWorkshop,Permissions.ExecuteService}) o.AddPolicy(p,b=>b.RequireClaim("permission",p));});
builder.Services.AddAntiforgery(o=>{o.HeaderName="X-CSRF-TOKEN";o.Cookie.Name="__Host-AutoFlow-CSRF";o.Cookie.SecurePolicy=CookieSecurePolicy.Always;o.Cookie.SameSite=SameSiteMode.Strict;});
builder.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddPolicy("login",c=>RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions{PermitLimit=10,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));});
builder.Services.AddProblemDetails();
var app=builder.Build();
app.UseExceptionHandler();app.UseHttpsRedirection();
app.Use(async(c,next)=>{c.Response.Headers["Referrer-Policy"]="no-referrer";c.Response.Headers["X-Content-Type-Options"]="nosniff";c.Response.Headers["Cache-Control"]="no-store";await next();});
app.UseRateLimiter();app.UseAuthentication();app.UseAuthorization();
app.Use(async(c,next)=>{
 if(c.Request.Path.StartsWithSegments("/api") && c.Request.Method is "POST" or "PUT" or "DELETE" or "PATCH"){
 try{await c.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(c);}catch(AntiforgeryValidationException){c.Response.StatusCode=400;await c.Response.WriteAsJsonAsync(new{error="Token CSRF inválido."});return;}
 }await next();
});
app.MapGet("/api/health",()=>Results.Ok(new{status="alive"}));
app.MapGet("/api/auth/csrf",(HttpContext c,IAntiforgery csrf)=>Results.Ok(new{token=csrf.GetAndStoreTokens(c).RequestToken}));
app.MapPost("/api/auth/login",async(LoginRequest input,IValidator<LoginRequest> validator,UserManager<AppUser> users,SignInManager<AppUser> signIn,AppDbContext db,HttpContext context)=>{
 if(!(await validator.ValidateAsync(input)).IsValid)return Results.BadRequest(new{error="Informe e-mail e senha válidos."});
 var user=await users.FindByEmailAsync(input.Email);
 if(user is null)return Results.Json(new{error="Credenciais inválidas ou acesso bloqueado."},statusCode:401);
 var check=await signIn.CheckPasswordSignInAsync(user,input.Password,true);
 if(!check.Succeeded)return Results.Json(new{error="Credenciais inválidas ou acesso bloqueado."},statusCode:401);
 context.User=await signIn.CreateUserPrincipalAsync(user);
 db.AuditLogs.Add(new(){DealershipId=user.DealershipId,UserId=user.Id,Action="SessionLogin"});await db.SaveChangesAsync();
 await signIn.SignInAsync(user,false);
 return Results.Ok(new{message="Autenticado"});
}).RequireRateLimiting("login");
app.MapPost("/api/auth/logout",async(SignInManager<AppUser> s,AppDbContext db,ICurrentTenant tenant,ClaimsPrincipal user)=>{db.AuditLogs.Add(new(){DealershipId=tenant.DealershipId!.Value,UserId=user.FindFirstValue(ClaimTypes.NameIdentifier)!,Action="SessionLogout"});await db.SaveChangesAsync();await s.SignOutAsync();return Results.NoContent();}).RequireAuthorization();
app.MapGet("/api/auth/me",async(ClaimsPrincipal p,UserManager<AppUser> users)=>{
 var u=await users.GetUserAsync(p);if(u is null)return Results.Unauthorized();
 return Results.Ok(new UserProfile(u.Id,u.DisplayName,u.Email!,u.DealershipId,await users.GetRolesAsync(u),p.FindAll("permission").Select(x=>x.Value)));
}).RequireAuthorization();
app.MapGet("/api/dealership",async(AppDbContext db)=>Results.Ok(await db.Dealerships.Select(x=>new{x.Id,x.Name}).SingleAsync())).RequireAuthorization();
app.MapGet("/api/team",async(AppDbContext db,ICurrentTenant tenant)=>Results.Ok(await db.Users.Where(x=>x.DealershipId==tenant.DealershipId).Select(x=>new{x.Id,x.DisplayName,x.Email}).ToListAsync())).RequireAuthorization(Permissions.ManageWorkshop);
app.MapGet("/api/audit",async(AppDbContext db)=>Results.Ok(await db.AuditLogs.OrderByDescending(x=>x.CreatedAt).Take(100).ToListAsync())).RequireAuthorization(Permissions.ManageWorkshop);
if(args.Contains("--migrate")){using var scope=app.Services.CreateScope();await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();return;}
if(args.Contains("--seed")){if(!app.Environment.IsDevelopment())throw new InvalidOperationException("Seed disponível apenas em Development.");using var scope=app.Services.CreateScope();await Seed.Run(scope.ServiceProvider,app.Configuration);return;}
app.Run();
public partial class Program {}
public sealed class CurrentTenant(IHttpContextAccessor accessor):ICurrentTenant {public Guid? DealershipId=>Guid.TryParse(accessor.HttpContext?.User.FindFirstValue("dealership"),out var id)?id:null;}
