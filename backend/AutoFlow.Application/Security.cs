using FluentValidation;
namespace AutoFlow.Application;
public interface ICurrentTenant { Guid? DealershipId {get;} }
public sealed record LoginRequest(string Email,string Password);
public sealed class LoginValidator : AbstractValidator<LoginRequest> {
 public LoginValidator(){ RuleFor(x=>x.Email).NotEmpty().EmailAddress().MaximumLength(254); RuleFor(x=>x.Password).NotEmpty().MaximumLength(128); }
}
public sealed record UserProfile(string Id,string Name,string Email,Guid DealershipId,IEnumerable<string> Roles,IEnumerable<string> Permissions);
