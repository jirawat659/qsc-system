using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace QSC.Api.Services;

/// <summary>
/// ใช้แทน [Authorize(Roles = "...")] ที่ hardcode บทบาท เช่น [RequirePermission("forms.manage")]
/// ตัดสินผ่าน IPermissionService (ดู PermissionService ว่าใช้ DB หรือ PDP ตามโหมด)
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequirePermissionAttribute : TypeFilterAttribute
{
    public RequirePermissionAttribute(string permissionCode) : base(typeof(RequirePermissionFilter))
    {
        Arguments = new object[] { permissionCode };
    }
}

public sealed class RequirePermissionFilter(IPermissionService permissions, string permissionCode) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        if (http.User.Identity?.IsAuthenticated != true) { context.Result = new UnauthorizedResult(); return; }
        if (!await permissions.HasAsync(http.User, permissionCode, http.RequestAborted))
            context.Result = new ForbidResult();
    }
}
