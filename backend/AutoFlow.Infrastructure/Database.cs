using AutoFlow.Application;
using AutoFlow.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
namespace AutoFlow.Infrastructure;
public class AppUser : IdentityUser { public Guid DealershipId {get;set;} public Guid? StoreId {get;set;} public string DisplayName {get;set;}=""; public Dealership Dealership {get;set;}=null!; }
public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentTenant tenant) : IdentityDbContext<AppUser>(options) {
 public DbSet<Dealership> Dealerships => Set<Dealership>(); public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
 protected override void OnModelCreating(ModelBuilder b) {
 base.OnModelCreating(b);
 b.Entity<Store>().ToTable("Stores").HasIndex(x => x.DealershipId);
 b.Entity<CatalogService>().ToTable("CatalogServices").HasIndex(x => x.DealershipId);
 b.Entity<CatalogService>().Property(x => x.Price).HasPrecision(18, 2);
 b.Entity<WorkOrder>().ToTable("WorkOrders").HasIndex(x => new { x.DealershipId, x.OpenedAt });
 b.Entity<WorkOrder>().HasMany(x => x.Items).WithOne().HasForeignKey(x => x.WorkOrderId);
 b.Entity<WorkOrderItem>().Property(x => x.ExecutionVersion).IsConcurrencyToken();
 b.Entity<WorkOrderItem>().ToTable("WorkOrderItems").Property(x => x.Price).HasPrecision(18, 2);
 b.Entity<Dealership>().Property(x=>x.Name).HasMaxLength(160).IsRequired();
 b.Entity<Dealership>().HasQueryFilter(x=>tenant.DealershipId.HasValue && x.Id==tenant.DealershipId);
 b.Entity<AppUser>().Property(x=>x.DisplayName).HasMaxLength(160);
 b.Entity<AppUser>().HasOne(x=>x.Dealership).WithMany().HasForeignKey(x=>x.DealershipId).OnDelete(DeleteBehavior.Restrict);
 b.Entity<AuditLog>().HasQueryFilter(x=>tenant.DealershipId.HasValue && x.DealershipId==tenant.DealershipId);
 b.Entity<AuditLog>().HasIndex(x=>new{x.DealershipId,x.CreatedAt});
 b.Entity<AuditLog>().Property(x=>x.Action).HasMaxLength(100).IsRequired();
 b.Entity<AuditLog>().HasOne<Dealership>().WithMany().HasForeignKey(x=>x.DealershipId).OnDelete(DeleteBehavior.Restrict);
 }
 public override Task<int> SaveChangesAsync(CancellationToken ct=default) {
 foreach(var e in ChangeTracker.Entries<AuditLog>().Where(e=>e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
 if(!tenant.DealershipId.HasValue || e.Entity.DealershipId!=tenant.DealershipId) throw new UnauthorizedAccessException("Concessionária inválida.");
 return base.SaveChangesAsync(ct);
 }
}
