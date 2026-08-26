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
    public class FormController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FormController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetForms([FromQuery] bool onlyLatest = true)
        {
            var query = _context.SurveyForms
                .Include(f => f.LocationType)
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .Where(f => f.IsActive);

            if (onlyLatest)
            {
                query = query.Where(f => f.IsLatest);
            }

            var forms = await query.OrderBy(f => f.Id).ToListAsync();

            var formTargetLocations = await _context.SurveyFormTargetLocations.ToListAsync();

            var result = forms.Select(f => new
            {
                id = f.Id,
                formGroupId = f.FormGroupId,
                title = f.Title,
                locationTypeId = f.LocationTypeId,
                locationTypeName = f.LocationType?.Name,
                passingScore = f.PassingScore,
                targetingMode = f.TargetingMode,
                version = f.Version,
                isLatest = f.IsLatest,
                isActive = f.IsActive,
                createdAt = f.CreatedAt,
                targetLocationIds = formTargetLocations.Where(t => t.SurveyFormId == f.Id).Select(t => t.LocationId).ToList(),
                sections = f.Sections.OrderBy(s => s.OrderIndex).Select(s => new
                {
                    id = s.Id,
                    title = s.Title,
                    orderIndex = s.OrderIndex,
                    weightPercent = s.WeightPercent,
                    items = s.Items.OrderBy(i => i.OrderIndex).Select(i => new
                    {
                        id = i.Id,
                        questionText = i.QuestionText,
                        questionType = i.QuestionType,
                        fullScore = i.FullScore,
                        isCritical = i.IsCritical,
                        orderIndex = i.OrderIndex
                    }).ToList()
                }).ToList()
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetForm(int id)
        {
            var f = await _context.SurveyForms
                .Include(f => f.LocationType)
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .FirstOrDefaultAsync(f => f.Id == id);

            if (f == null) return NotFound();

            var targetLocationIds = await _context.SurveyFormTargetLocations
                .Where(t => t.SurveyFormId == f.Id)
                .Select(t => t.LocationId)
                .ToListAsync();

            return Ok(new
            {
                id = f.Id,
                formGroupId = f.FormGroupId,
                title = f.Title,
                locationTypeId = f.LocationTypeId,
                locationTypeName = f.LocationType?.Name,
                passingScore = f.PassingScore,
                targetingMode = f.TargetingMode,
                version = f.Version,
                isLatest = f.IsLatest,
                isActive = f.IsActive,
                createdAt = f.CreatedAt,
                targetLocationIds = targetLocationIds,
                sections = f.Sections.OrderBy(s => s.OrderIndex).Select(s => new
                {
                    id = s.Id,
                    title = s.Title,
                    orderIndex = s.OrderIndex,
                    weightPercent = s.WeightPercent,
                    items = s.Items.OrderBy(i => i.OrderIndex).Select(i => new
                    {
                        id = i.Id,
                        questionText = i.QuestionText,
                        questionType = i.QuestionType,
                        fullScore = i.FullScore,
                        isCritical = i.IsCritical,
                        orderIndex = i.OrderIndex
                    }).ToList()
                }).ToList()
            });
        }

        public class FormSaveDto
        {
            public string Title { get; set; } = string.Empty;
            public int? LocationTypeId { get; set; }
            public double PassingScore { get; set; } = 85.0;
            public string TargetingMode { get; set; } = "ALL_LOCATIONS";
            public string Version { get; set; } = "v1.0";
            public int? CreatedBy { get; set; }
            public List<int> TargetLocationIds { get; set; } = new();
            public List<SectionDto> Sections { get; set; } = new();
        }

        public class SectionDto
        {
            public int? Id { get; set; }
            public string Title { get; set; } = string.Empty;
            public int OrderIndex { get; set; }
            public double WeightPercent { get; set; }
            public List<ItemDto> Items { get; set; } = new();
        }

        public class ItemDto
        {
            public int? Id { get; set; }
            public string QuestionText { get; set; } = string.Empty;
            public string QuestionType { get; set; } = "YESNO";
            public double FullScore { get; set; } = 10.0;
            public bool IsCritical { get; set; } = false;
            public int OrderIndex { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> CreateForm([FromBody] FormSaveDto dto)
        {
            var form = new SurveyForm
            {
                Title = dto.Title,
                LocationTypeId = dto.LocationTypeId,
                PassingScore = dto.PassingScore,
                TargetingMode = dto.TargetingMode,
                Version = dto.Version,
                IsLatest = true,
                IsActive = true,
                CreatedBy = dto.CreatedBy,
                CreatedAt = DateTime.UtcNow
            };

            _context.SurveyForms.Add(form);
            await _context.SaveChangesAsync();

            // Set FormGroupId to self if initial version
            form.FormGroupId = form.Id;
            await _context.SaveChangesAsync();

            // Save Target Locations
            if (dto.TargetingMode == "SPECIFIC_LOCATIONS" && dto.TargetLocationIds.Any())
            {
                foreach (var locId in dto.TargetLocationIds)
                {
                    _context.SurveyFormTargetLocations.Add(new SurveyFormTargetLocation { SurveyFormId = form.Id, LocationId = locId });
                }
            }

            // Save Sections & Items
            int secIdx = 1;
            foreach (var sDto in dto.Sections)
            {
                var section = new SurveySection
                {
                    SurveyFormId = form.Id,
                    Title = sDto.Title,
                    OrderIndex = sDto.OrderIndex > 0 ? sDto.OrderIndex : secIdx++,
                    WeightPercent = sDto.WeightPercent,
                    IsActive = true
                };
                _context.SurveySections.Add(section);
                await _context.SaveChangesAsync();

                int itemIdx = 1;
                foreach (var iDto in sDto.Items)
                {
                    var item = new SurveyItem
                    {
                        SurveySectionId = section.Id,
                        QuestionText = iDto.QuestionText,
                        QuestionType = iDto.QuestionType,
                        FullScore = iDto.FullScore,
                        IsCritical = iDto.IsCritical,
                        OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                        IsActive = true
                    };
                    _context.SurveyItems.Add(item);
                }
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetForm), new { id = form.Id }, form);
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateForm(int id, [FromBody] FormSaveDto dto)
        {
            var form = await _context.SurveyForms
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .FirstOrDefaultAsync(f => f.Id == id);

            if (form == null) return NotFound();

            // 🌟 SMART FORM VERSIONING LOGIC:
            // Check if form has ever been used in audit records
            bool hasBeenUsed = await _context.AuditRecords.AnyAsync(r => r.SurveyFormId == id);

            if (!hasBeenUsed)
            {
                // Case A: Form has never been used -> In-place UPDATE
                form.Title = dto.Title;
                form.LocationTypeId = dto.LocationTypeId;
                form.PassingScore = dto.PassingScore;
                form.TargetingMode = dto.TargetingMode;
                form.Version = dto.Version;

                // Sync Target Locations
                var existingTargets = await _context.SurveyFormTargetLocations.Where(t => t.SurveyFormId == id).ToListAsync();
                _context.SurveyFormTargetLocations.RemoveRange(existingTargets);

                if (dto.TargetingMode == "SPECIFIC_LOCATIONS" && dto.TargetLocationIds.Any())
                {
                    foreach (var locId in dto.TargetLocationIds)
                    {
                        _context.SurveyFormTargetLocations.Add(new SurveyFormTargetLocation { SurveyFormId = id, LocationId = locId });
                    }
                }

                // Remove existing sections and items and recreate
                _context.SurveySections.RemoveRange(form.Sections);
                await _context.SaveChangesAsync();

                int secIdx = 1;
                foreach (var sDto in dto.Sections)
                {
                    var section = new SurveySection
                    {
                        SurveyFormId = form.Id,
                        Title = sDto.Title,
                        OrderIndex = sDto.OrderIndex > 0 ? sDto.OrderIndex : secIdx++,
                        WeightPercent = sDto.WeightPercent,
                        IsActive = true
                    };
                    _context.SurveySections.Add(section);
                    await _context.SaveChangesAsync();

                    int itemIdx = 1;
                    foreach (var iDto in sDto.Items)
                    {
                        var item = new SurveyItem
                        {
                            SurveySectionId = section.Id,
                            QuestionText = iDto.QuestionText,
                            QuestionType = iDto.QuestionType,
                            FullScore = iDto.FullScore,
                            IsCritical = iDto.IsCritical,
                            OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                            IsActive = true
                        };
                        _context.SurveyItems.Add(item);
                    }
                    await _context.SaveChangesAsync();
                }

                return Ok(new { message = "อัปเดตแบบฟอร์มสำเร็จ (In-place update)", formId = form.Id });
            }
            else
            {
                // Case B: Form has been used in actual audits -> IMMUTABLE LINEAGE CLONE
                form.IsLatest = false; // Retire old form version
                await _context.SaveChangesAsync();

                var newVersionForm = new SurveyForm
                {
                    FormGroupId = form.FormGroupId ?? form.Id,
                    Title = dto.Title,
                    LocationTypeId = dto.LocationTypeId,
                    PassingScore = dto.PassingScore,
                    TargetingMode = dto.TargetingMode,
                    Version = dto.Version,
                    IsLatest = true,
                    IsActive = true,
                    CreatedBy = dto.CreatedBy ?? form.CreatedBy,
                    CreatedAt = DateTime.UtcNow
                };

                _context.SurveyForms.Add(newVersionForm);
                await _context.SaveChangesAsync();

                // Clone target locations
                if (dto.TargetingMode == "SPECIFIC_LOCATIONS" && dto.TargetLocationIds.Any())
                {
                    foreach (var locId in dto.TargetLocationIds)
                    {
                        _context.SurveyFormTargetLocations.Add(new SurveyFormTargetLocation { SurveyFormId = newVersionForm.Id, LocationId = locId });
                    }
                }

                // Create new sections and items
                int secIdx = 1;
                foreach (var sDto in dto.Sections)
                {
                    var section = new SurveySection
                    {
                        SurveyFormId = newVersionForm.Id,
                        Title = sDto.Title,
                        OrderIndex = sDto.OrderIndex > 0 ? sDto.OrderIndex : secIdx++,
                        WeightPercent = sDto.WeightPercent,
                        IsActive = true
                    };
                    _context.SurveySections.Add(section);
                    await _context.SaveChangesAsync();

                    int itemIdx = 1;
                    foreach (var iDto in sDto.Items)
                    {
                        var item = new SurveyItem
                        {
                            SurveySectionId = section.Id,
                            QuestionText = iDto.QuestionText,
                            QuestionType = iDto.QuestionType,
                            FullScore = iDto.FullScore,
                            IsCritical = iDto.IsCritical,
                            OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                            IsActive = true
                        };
                        _context.SurveyItems.Add(item);
                    }
                    await _context.SaveChangesAsync();
                }

                return Ok(new { message = "สร้างเวอร์ชันใหม่สำเร็จเพื่อล็อกประวัติเดิม (Version Clone)", formId = newVersionForm.Id });
            }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteForm(int id)
        {
            var form = await _context.SurveyForms.FindAsync(id);
            if (form == null) return NotFound();

            form.IsActive = false; // Soft delete
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
