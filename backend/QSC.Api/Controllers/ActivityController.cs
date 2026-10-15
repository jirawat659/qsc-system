using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Services;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ActivityController : ControllerBase
    {
        private readonly IActivityLogger _activityLogger;
        private readonly AppDbContext _context;

        public ActivityController(IActivityLogger activityLogger, AppDbContext context)
        {
            _activityLogger = activityLogger;
            _context = context;
        }

        public class ExportActivityDto
        {
            public string Action { get; set; } = string.Empty;
            public string? EntityType { get; set; }
            public int? EntityId { get; set; }
            public int? LocationId { get; set; }
        }

        [HttpPost("export")]
        public async Task<IActionResult> LogExportActivity([FromBody] ExportActivityDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Action) || !dto.Action.StartsWith("EXPORT_"))
            {
                return BadRequest(new { message = "รหัสกิจกรรมไม่ถูกต้อง (ต้องขึ้นต้นด้วย EXPORT_)" });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
            {
                return Unauthorized();
            }

            await _activityLogger.LogAsync(userId, dto.Action, dto.EntityType, dto.EntityId, dto.LocationId);
            return Ok(new { success = true });
        }

        /// <summary>
        /// ดึงรายการประวัติกิจกรรมการใช้งานระบบ (สำหรับผู้มีสิทธิ์ activity.view หรือ ADMIN)
        /// </summary>
        [HttpGet("logs")]
        public async Task<IActionResult> GetActivityLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] string? actionType = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var hasPermission = await UserScopeHelper.HasPermissionAsync(User, "activity.view", _context);
            if (!hasPermission)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "คุณไม่มีสิทธิ์ในการเข้าถึงประวัติกิจกรรมระบบ" });
            }

            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            var query = _context.ActivityLogs.AsNoTracking().AsQueryable();

            // กรองช่วงวันที่
            if (startDate.HasValue)
            {
                var sDate = startDate.Value.ToUniversalTime();
                query = query.Where(a => a.OccurredAt >= sDate);
            }
            if (endDate.HasValue)
            {
                var eDate = endDate.Value.ToUniversalTime().AddDays(1);
                query = query.Where(a => a.OccurredAt < eDate);
            }

            // กรองหมวดหมู่ของ Action
            if (!string.IsNullOrWhiteSpace(actionType) && actionType != "ALL")
            {
                if (actionType == "AUTH")
                {
                    query = query.Where(a => a.Action == "LOGIN" || a.Action == "LOGOUT");
                }
                else if (actionType == "AUDIT")
                {
                    query = query.Where(a => a.Action.StartsWith("AUDIT_"));
                }
                else if (actionType == "SYSTEM")
                {
                    query = query.Where(a => !a.Action.StartsWith("AUDIT_") && a.Action != "LOGIN" && a.Action != "LOGOUT");
                }
                else
                {
                    query = query.Where(a => a.Action == actionType);
                }
            }

            // Left Join เพื่อดึงชื่อผู้ใช้ บทบาท และสาขา
            var joinedQuery = from a in query
                              join u in _context.Users.AsNoTracking() on a.UserId equals u.Id into uGroup
                              from u in uGroup.DefaultIfEmpty()
                              join r in _context.Roles.AsNoTracking() on u.RoleId equals r.Id into rGroup
                              from r in rGroup.DefaultIfEmpty()
                              join l in _context.Locations.AsNoTracking() on a.LocationId equals l.Id into lGroup
                              from l in lGroup.DefaultIfEmpty()
                              select new
                              {
                                  a.Id,
                                  a.OccurredAt,
                                  a.UserId,
                                  Username = u != null ? u.Username : "-",
                                  FullName = u != null ? u.FullName : "ไม่ระบุผู้ใช้",
                                  RoleCode = r != null ? r.Code : "",
                                  RoleName = r != null ? r.Name : "",
                                  a.Action,
                                  a.EntityType,
                                  a.EntityId,
                                  a.LocationId,
                                  LocationName = l != null ? l.Name : null,
                                  LocationCode = l != null ? l.Code : null,
                                  a.Details
                              };

            // ค้นหาตามคำค้น
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                var matchingRecordIds = await _context.AuditRecords.AsNoTracking()
                    .Where(r => r.DocumentNo != null && r.DocumentNo.Contains(s))
                    .Select(r => r.Id)
                    .Take(100)
                    .ToListAsync();
                var matchingDraftIds = await _context.AuditDrafts.AsNoTracking()
                    .Where(d => d.DocumentNo != null && d.DocumentNo.Contains(s))
                    .Select(d => d.Id)
                    .Take(100)
                    .ToListAsync();

                joinedQuery = joinedQuery.Where(x =>
                    x.Username.Contains(s) ||
                    x.FullName.Contains(s) ||
                    x.Action.Contains(s) ||
                    (x.LocationName != null && x.LocationName.Contains(s)) ||
                    (x.EntityType != null && x.EntityType.Contains(s)) ||
                    (x.EntityId.HasValue && (
                        (x.EntityType == "AuditRecord" && matchingRecordIds.Contains(x.EntityId.Value)) ||
                        (x.EntityType == "AuditDraft" && matchingDraftIds.Contains(x.EntityId.Value))
                    )));
            }

            var totalCount = await joinedQuery.CountAsync();

            var rawItems = await joinedQuery
                .OrderByDescending(x => x.OccurredAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // ดึง DocumentNo / DocumentId สำหรับรายการที่เป็น AuditRecord หรือ AuditDraft
            var recordIds = rawItems
                .Where(x => (x.EntityType == "AuditRecord" || x.Action.StartsWith("AUDIT_")) && x.EntityId.HasValue && x.EntityType != "AuditDraft")
                .Select(x => x.EntityId!.Value)
                .Distinct()
                .ToList();

            var draftIds = rawItems
                .Where(x => x.EntityType == "AuditDraft" && x.EntityId.HasValue)
                .Select(x => x.EntityId!.Value)
                .Distinct()
                .ToList();

            var recordDocs = recordIds.Any()
                ? await _context.AuditRecords.AsNoTracking()
                    .Where(r => recordIds.Contains(r.Id))
                    .Select(r => new { r.Id, r.DocumentNo })
                    .ToDictionaryAsync(r => r.Id, r => r.DocumentNo)
                : new Dictionary<int, string?>();

            var draftDocs = draftIds.Any()
                ? await _context.AuditDrafts.AsNoTracking()
                    .Where(d => draftIds.Contains(d.Id))
                    .Select(d => new { d.Id, d.DocumentNo })
                    .ToDictionaryAsync(d => d.Id, d => d.DocumentNo)
                : new Dictionary<int, string?>();

            var items = rawItems.Select(x =>
            {
                string? docNo = null;
                if (x.EntityId.HasValue)
                {
                    if (x.EntityType == "AuditDraft")
                    {
                        draftDocs.TryGetValue(x.EntityId.Value, out docNo);
                    }
                    else if (x.EntityType == "AuditRecord" || x.Action.StartsWith("AUDIT_"))
                    {
                        recordDocs.TryGetValue(x.EntityId.Value, out docNo);
                    }
                }

                return new
                {
                    x.Id,
                    x.OccurredAt,
                    x.UserId,
                    x.Username,
                    x.FullName,
                    x.RoleCode,
                    x.RoleName,
                    x.Action,
                    x.EntityType,
                    x.EntityId,
                    DocumentNo = docNo,
                    DocumentId = docNo,
                    x.LocationId,
                    x.LocationName,
                    x.LocationCode,
                    Details = x.Details
                };
            }).ToList();

            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
    }
}
