namespace AutoFlow.Domain;
public static class Roles {
 public const string Consultant="Consultant", Manager="Manager", Mechanic="Mechanic";
 public const string Master = "Master";
 public static readonly string[] Operational = [Consultant, Manager, Mechanic];
 public static readonly string[] All = [Master, ..Operational];
}
public static class Permissions {
 public const string ReadOrders="orders.read", CreateOrders="orders.create", ManageWorkshop="workshop.manage", ExecuteService="services.execute";
 public const string ManageUsers = "users.manage";
 public static IEnumerable<string> For(string role) => role switch {
 Roles.Master => [ManageUsers], Roles.Manager => [ReadOrders,ManageWorkshop], Roles.Consultant => [ReadOrders,CreateOrders], Roles.Mechanic => [ExecuteService], _ => [] };
}
public class Dealership { public Guid Id {get;set;} public string Name {get;set;}=""; }
public class AuditLog {
 public Guid Id {get;set;}=Guid.NewGuid(); public Guid DealershipId {get;set;}
 public string UserId {get;set;}=""; public string Action {get;set;}=""; public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
