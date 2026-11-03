namespace AutoFlow.Domain;
public static class Roles {
 public const string Consultant="Consultant", Manager="Manager", Mechanic="Mechanic";
 public static readonly string[] All=[Consultant,Manager,Mechanic];
}
public static class Permissions {
 public const string ReadOrders="orders.read", CreateOrders="orders.create", ManageWorkshop="workshop.manage", ExecuteService="services.execute";
 public static IEnumerable<string> For(string role) => role switch {
 Roles.Manager => [ReadOrders,ManageWorkshop], Roles.Consultant => [ReadOrders,CreateOrders], Roles.Mechanic => [ExecuteService], _ => [] };
}
public class Dealership { public Guid Id {get;set;} public string Name {get;set;}=""; }
public class AuditLog {
 public Guid Id {get;set;}=Guid.NewGuid(); public Guid DealershipId {get;set;}
 public string UserId {get;set;}=""; public string Action {get;set;}=""; public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
