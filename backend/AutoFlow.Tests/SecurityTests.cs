using AutoFlow.Application;
using AutoFlow.Domain;
using AutoFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
public class SecurityTests {
 [Theory][InlineData("bad", "")][InlineData("", "secret")]
 public void InvalidLoginRejected(string email,string password)=>Assert.False(new LoginValidator().Validate(new LoginRequest(email,password)).IsValid);
 [Fact] public void MechanicCannotManageOrPrice(){Assert.DoesNotContain(Permissions.ManageWorkshop,Permissions.For(Roles.Mechanic));Assert.DoesNotContain(Permissions.CreateOrders,Permissions.For(Roles.Mechanic));}
 [Fact] public void ConsultantCanCreate()=>Assert.Contains(Permissions.CreateOrders,Permissions.For(Roles.Consultant));
 [Fact] public async Task TenantQueriesNeverReturnOtherDealership(){
 var a=Guid.NewGuid();var b=Guid.NewGuid();var tenant=new Mock<ICurrentTenant>();tenant.SetupGet(x=>x.DealershipId).Returns(a);
 var options=new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
 await using var db=new AppDbContext(options,tenant.Object);db.Dealerships.AddRange(new Dealership{Id=a,Name="A"},new Dealership{Id=b,Name="B"});await db.SaveChangesAsync();
 Assert.Equal(a,(await db.Dealerships.SingleAsync()).Id);
 tenant.SetupGet(x=>x.DealershipId).Returns((Guid?)null);Assert.Empty(await db.Dealerships.ToListAsync());
 }
 [Fact] public async Task CrossTenantAuditWriteRejected(){var tenant=new Mock<ICurrentTenant>();tenant.SetupGet(x=>x.DealershipId).Returns(Guid.NewGuid());await using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,tenant.Object);db.AuditLogs.Add(new(){DealershipId=Guid.NewGuid(),Action="test"});await Assert.ThrowsAsync<UnauthorizedAccessException>(()=>db.SaveChangesAsync());}
}
