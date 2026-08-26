using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ScheduleController(AppDbContext context)
        {
            _context = context;
        }

        public class ScheduleSaveDto
        {
            public int LocationId { get; set; }
            public int SurveyFormId { get; set; }
            public DateTime ScheduledDate { get; set; }
            public string AuditType { get; set; } = "announced";
            public string Status { get; set; } = "pending";
            public string? Notes { get; set; }
            public int CreatedBy { get; set; }
            public List<int> AuditorIds { get; set; } = new();
        }

        [HttpGet]
        public async Task<IActionResult> GetSchedules([FromQuery] int? auditorId, [FromQuery] int? locationId)
        {
            var query = _context.AuditSchedules
                .Include(s => s.Location)
                .Include(s => s.SurveyForm)
                .Include(s => s.Auditors)
                    .ThenInclude(a => a.Auditor)
                .AsQueryable();

            if (auditorId.HasValue)
            {
                query = query.Where(s => s.Auditors.Any(a => a.AuditorId == auditorId.Value));
            }

            if (locationId.HasValue)
            {
                query = query.Where(s => s.LocationId == locationId.Value);
            }

            var schedules = await query.OrderByDescending(s => s.ScheduledDate).ToListAsync();

            var result = schedules.Select(s => new
            {
                id = s.Id,
                locationId = s.LocationId,
                locationCode = s.Location?.Code,
                locationName = s.Location?.Name,
                surveyFormId = s.SurveyFormId,
                surveyFormTitle = s.SurveyForm?.Title,
                scheduledDate = s.ScheduledDate,
                auditType = s.AuditType,
                status = s.Status,
                notes = s.Notes,
                createdBy = s.CreatedBy,
                createdAt = s.CreatedAt,
                auditors = s.Auditors.Select(a => new
                {
                    id = a.AuditorId,
                    fullName = a.Auditor?.FullName,
                    isLead = a.IsLead
                }).ToList()
            });

            return Ok(result);
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> CreateSchedule([FromBody] ScheduleSaveDto dto)
        {
            var schedule = new AuditSchedule
            {
                LocationId = dto.LocationId,
                SurveyFormId = dto.SurveyFormId,
                ScheduledDate = dto.ScheduledDate,
                AuditType = dto.AuditType,
                Status = "pending",
                Notes = dto.Notes,
                CreatedBy = dto.CreatedBy > 0 ? dto.CreatedBy : 1,
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditSchedules.Add(schedule);
            await _context.SaveChangesAsync();

            if (dto.AuditorIds.Any())
            {
                bool isLead = true;
                foreach (var audId in dto.AuditorIds)
                {
                    _context.AuditScheduleAuditors.Add(new AuditScheduleAuditor
                    {
                        AuditScheduleId = schedule.Id,
                        AuditorId = audId,
                        IsLead = isLead
                    });
                    isLead = false;
                }
                await _context.SaveChangesAsync();
            }

            return Ok(schedule);
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSchedule(int id, [FromBody] ScheduleSaveDto dto)
        {
            var schedule = await _context.AuditSchedules
                .Include(s => s.Auditors)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (schedule == null) return NotFound();

            if (schedule.Status == "completed")
            {
                return BadRequest(new { message = "ไม่สามารถแก้ไขนัดหมายที่ตรวจเสร็จสมบูรณ์แล้วได้ (ล็อกถาวร)" });
            }

            schedule.LocationId = dto.LocationId;
            schedule.SurveyFormId = dto.SurveyFormId;
            schedule.ScheduledDate = dto.ScheduledDate;
            schedule.AuditType = dto.AuditType;
            schedule.Notes = dto.Notes;
            if (!string.IsNullOrEmpty(dto.Status)) schedule.Status = dto.Status;

            // Sync auditors
            _context.AuditScheduleAuditors.RemoveRange(schedule.Auditors);

            if (dto.AuditorIds.Any())
            {
                bool isLead = true;
                foreach (var audId in dto.AuditorIds)
                {
                    _context.AuditScheduleAuditors.Add(new AuditScheduleAuditor
                    {
                        AuditScheduleId = schedule.Id,
                        AuditorId = audId,
                        IsLead = isLead
                    });
                    isLead = false;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(schedule);
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSchedule(int id)
        {
            var schedule = await _context.AuditSchedules.FindAsync(id);
            if (schedule == null) return NotFound();

            if (schedule.Status == "completed")
            {
                return BadRequest(new { message = "ไม่สามารถลบนัดหมายที่ตรวจเสร็จสมบูรณ์แล้วได้ (ล็อกถาวร)" });
            }

            _context.AuditSchedules.Remove(schedule);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
