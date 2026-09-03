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
        public async Task<IActionResult> GetForms([FromQuery] bool onlyLatest = true, [FromQuery] int? brandId = null)
        {
            var query = _context.SurveyForms
                .AsNoTracking()
                .Include(f => f.LocationType)
                .Include(f => f.Brand)
                .Include(f => f.FormBrands)
                    .ThenInclude(fb => fb.Brand)
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .Where(f => f.IsActive);

            if (onlyLatest)
            {
                query = query.Where(f => f.IsLatest);
            }

            if (brandId.HasValue && brandId.Value > 0)
            {
                query = query.Where(f => (!f.FormBrands.Any() && f.BrandId == null)
                                      || f.FormBrands.Any(fb => fb.BrandId == brandId.Value)
                                      || f.BrandId == brandId.Value);
            }

            var forms = await query.OrderBy(f => f.Id).ToListAsync();
            var formTargetLocations = await _context.SurveyFormTargetLocations.AsNoTracking().ToListAsync();

            var auditCounts = await _context.AuditRecords
                .AsNoTracking()
                .GroupBy(a => a.SurveyFormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.FormId, x => x.Count);

            var scheduleCounts = await _context.AuditSchedules
                .AsNoTracking()
                .Where(s => s.Status != "CANCELLED")
                .GroupBy(s => s.SurveyFormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.FormId, x => x.Count);

            var result = forms.Select(f => {
                var bIds = f.FormBrands.Select(fb => fb.BrandId).ToList();
                if (bIds.Count == 0 && f.BrandId.HasValue) bIds.Add(f.BrandId.Value);

                var bNames = f.FormBrands.Where(fb => fb.Brand != null).Select(fb => fb.Brand!.Name).ToList();
                if (bNames.Count == 0 && !string.IsNullOrEmpty(f.Brand?.Name)) bNames.Add(f.Brand.Name);

                return new
                {
                    id = f.Id,
                    formGroupId = f.FormGroupId,
                    title = f.Title,
                    locationTypeId = f.LocationTypeId,
                    locationTypeName = f.LocationType?.Name,
                    brandId = f.BrandId,
                    brandName = f.Brand?.Name,
                    brandIds = bIds,
                    brandNames = bNames,
                    passingScore = f.PassingScore,
                    targetingMode = f.TargetingMode,
                    version = f.Version,
                    isLatest = f.IsLatest,
                    isActive = f.IsActive,
                    metadataConfigJson = f.MetadataConfigJson,
                    createdAt = f.CreatedAt,
                    usedCount = auditCounts.GetValueOrDefault(f.Id, 0),
                    scheduledCount = scheduleCounts.GetValueOrDefault(f.Id, 0),
                    isInUse = auditCounts.GetValueOrDefault(f.Id, 0) > 0 || scheduleCounts.GetValueOrDefault(f.Id, 0) > 0,
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
                            categoryCode = i.CategoryCode ?? "GEN",
                            categoryName = !string.IsNullOrEmpty(i.CategoryName) ? i.CategoryName : (i.CategoryCode switch
                            {
                                "CLN" => "ความสะอาด",
                                "DOC" => "เอกสาร",
                                "OPS" => "กระบวนการทำงาน",
                                "QLT" => "คุณภาพสินค้า-วัตถุดิบ",
                                "SVC" => "การบริการ",
                                _ => "ความสะอาด"
                            }),
                            orderIndex = i.OrderIndex
                        }).ToList()
                    }).ToList()
                };
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetForm(int id)
        {
            var f = await _context.SurveyForms
                .AsNoTracking()
                .Include(f => f.LocationType)
                .Include(f => f.Brand)
                .Include(f => f.FormBrands)
                    .ThenInclude(fb => fb.Brand)
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .FirstOrDefaultAsync(f => f.Id == id);

            if (f == null) return NotFound();

            var auditCount = await _context.AuditRecords.AsNoTracking().CountAsync(a => a.SurveyFormId == id);
            var scheduleCount = await _context.AuditSchedules.AsNoTracking().CountAsync(s => s.SurveyFormId == id && s.Status != "CANCELLED");

            var targetLocationIds = await _context.SurveyFormTargetLocations
                .AsNoTracking()
                .Where(t => t.SurveyFormId == f.Id)
                .Select(t => t.LocationId)
                .ToListAsync();

            var bIds = f.FormBrands.Select(fb => fb.BrandId).ToList();
            if (bIds.Count == 0 && f.BrandId.HasValue) bIds.Add(f.BrandId.Value);

            var bNames = f.FormBrands.Where(fb => fb.Brand != null).Select(fb => fb.Brand!.Name).ToList();
            if (bNames.Count == 0 && !string.IsNullOrEmpty(f.Brand?.Name)) bNames.Add(f.Brand.Name);

            return Ok(new
            {
                id = f.Id,
                formGroupId = f.FormGroupId,
                title = f.Title,
                locationTypeId = f.LocationTypeId,
                locationTypeName = f.LocationType?.Name,
                brandId = f.BrandId,
                brandName = f.Brand?.Name,
                brandIds = bIds,
                brandNames = bNames,
                passingScore = f.PassingScore,
                targetingMode = f.TargetingMode,
                version = f.Version,
                isLatest = f.IsLatest,
                isActive = f.IsActive,
                metadataConfigJson = f.MetadataConfigJson,
                createdAt = f.CreatedAt,
                usedCount = auditCount,
                scheduledCount = scheduleCount,
                isInUse = auditCount > 0 || scheduleCount > 0,
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
                        categoryCode = i.CategoryCode ?? "GEN",
                        categoryName = !string.IsNullOrEmpty(i.CategoryName) ? i.CategoryName : (i.CategoryCode switch
                        {
                            "CLN" => "ความสะอาด",
                            "DOC" => "เอกสาร",
                            "OPS" => "กระบวนการทำงาน",
                            "QLT" => "คุณภาพสินค้า-วัตถุดิบ",
                            "SVC" => "การบริการ",
                            _ => "ความสะอาด"
                        }),
                        orderIndex = i.OrderIndex
                    }).ToList()
                }).ToList()
            });
        }

        public class FormSaveDto
        {
            public string Title { get; set; } = string.Empty;
            public int? LocationTypeId { get; set; }
            public int? BrandId { get; set; }
            public List<int> BrandIds { get; set; } = new();
            public double PassingScore { get; set; } = 85.0;
            public string TargetingMode { get; set; } = "ALL_LOCATIONS";
            public string Version { get; set; } = "v1.0";
            public string? MetadataConfigJson { get; set; }
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
            public string? CategoryCode { get; set; }
            public string? CategoryName { get; set; }
            public int OrderIndex { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> CreateForm([FromBody] FormSaveDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var effectiveBrandId = dto.BrandId ?? (dto.BrandIds != null && dto.BrandIds.Count > 0 ? dto.BrandIds.First() : null);

                var form = new SurveyForm
                {
                    Title = dto.Title,
                    LocationTypeId = dto.LocationTypeId,
                    BrandId = effectiveBrandId,
                    PassingScore = dto.PassingScore,
                    TargetingMode = dto.TargetingMode,
                    Version = dto.Version,
                    MetadataConfigJson = dto.MetadataConfigJson,
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

                // Save Brands (SurveyFormBrands)
                if (dto.BrandIds != null && dto.BrandIds.Any())
                {
                    foreach (var bId in dto.BrandIds.Distinct())
                    {
                        _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = form.Id, BrandId = bId });
                    }
                }
                else if (effectiveBrandId.HasValue)
                {
                    _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = form.Id, BrandId = effectiveBrandId.Value });
                }

                // Save Target Locations
                if (dto.TargetingMode == "SPECIFIC_LOCATIONS" && dto.TargetLocationIds.Any())
                {
                    foreach (var locId in dto.TargetLocationIds)
                    {
                        _context.SurveyFormTargetLocations.Add(new SurveyFormTargetLocation { SurveyFormId = form.Id, LocationId = locId });
                    }
                }

                // Save Sections & Items
                int sectionIdx = 1;
                foreach (var sDto in dto.Sections)
                {
                    var section = new SurveySection
                    {
                        SurveyFormId = form.Id,
                        Title = sDto.Title,
                        OrderIndex = sDto.OrderIndex > 0 ? sDto.OrderIndex : sectionIdx++,
                        WeightPercent = sDto.WeightPercent,
                        IsActive = true
                    };
                    _context.SurveySections.Add(section);
                    await _context.SaveChangesAsync();

                    int itemIdx = 1;
                    foreach (var iDto in sDto.Items)
                    {
                        string? catName = !string.IsNullOrWhiteSpace(iDto.CategoryName) ? iDto.CategoryName.Trim() : null;
                        string? catCode = !string.IsNullOrWhiteSpace(iDto.CategoryCode) ? iDto.CategoryCode.Trim() : null;
                        if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                        {
                            catCode = catName switch
                            {
                                "ความสะอาด" => "CLN",
                                "เอกสาร" => "DOC",
                                "กระบวนการทำงาน" => "OPS",
                                "คุณภาพสินค้า-วัตถุดิบ" => "QLT",
                                "การบริการ" => "SVC",
                                _ => "GEN"
                            };
                        }
                        if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                        {
                            catName = catCode switch
                            {
                                "CLN" => "ความสะอาด",
                                "DOC" => "เอกสาร",
                                "OPS" => "กระบวนการทำงาน",
                                "QLT" => "คุณภาพสินค้า-วัตถุดิบ",
                                "SVC" => "การบริการ",
                                _ => "ความสะอาด"
                            };
                        }

                        var item = new SurveyItem
                        {
                            SurveySectionId = section.Id,
                            QuestionText = iDto.QuestionText,
                            QuestionType = iDto.QuestionType,
                            FullScore = iDto.FullScore,
                            IsCritical = iDto.IsCritical,
                            CategoryCode = catCode ?? "GEN",
                            CategoryName = catName ?? "ความสะอาด",
                            OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                            IsActive = true
                        };
                        _context.SurveyItems.Add(item);
                    }
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
                return CreatedAtAction(nameof(GetForm), new { id = form.Id }, new { message = "สร้างแบบฟอร์มสำเร็จ", formId = form.Id });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการสร้างแบบฟอร์ม: " + ex.Message });
            }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateForm(int id, [FromBody] FormSaveDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var form = await _context.SurveyForms
                    .Include(f => f.Sections)
                        .ThenInclude(s => s.Items)
                    .FirstOrDefaultAsync(f => f.Id == id);

                if (form == null) return NotFound();

                // 🌟 SMART FORM VERSIONING LOGIC:
                // Check if form has ever been used in audit records
                bool hasBeenUsed = await _context.AuditRecords.AnyAsync(r => r.SurveyFormId == id);

                var effectiveBrandId = dto.BrandId ?? (dto.BrandIds != null && dto.BrandIds.Count > 0 ? dto.BrandIds.First() : null);

                if (!hasBeenUsed)
                {
                    // Case A: Form has never been used -> In-place UPDATE
                    form.Title = dto.Title;
                    form.LocationTypeId = dto.LocationTypeId;
                    form.BrandId = effectiveBrandId;
                    form.PassingScore = dto.PassingScore;
                    form.TargetingMode = dto.TargetingMode;
                    form.Version = dto.Version;
                    form.MetadataConfigJson = dto.MetadataConfigJson;

                    // Sync Brands (SurveyFormBrands)
                    var existingBrands = await _context.SurveyFormBrands.Where(b => b.SurveyFormId == id).ToListAsync();
                    _context.SurveyFormBrands.RemoveRange(existingBrands);

                    if (dto.BrandIds != null && dto.BrandIds.Any())
                    {
                        foreach (var bId in dto.BrandIds.Distinct())
                        {
                            _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = id, BrandId = bId });
                        }
                    }
                    else if (effectiveBrandId.HasValue)
                    {
                        _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = id, BrandId = effectiveBrandId.Value });
                    }

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

                    // Remove existing sections and items cleanly
                    var oldSections = await _context.SurveySections.Where(s => s.SurveyFormId == id).ToListAsync();
                    _context.SurveySections.RemoveRange(oldSections);
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
                            string? catName = !string.IsNullOrWhiteSpace(iDto.CategoryName) ? iDto.CategoryName.Trim() : null;
                            string? catCode = !string.IsNullOrWhiteSpace(iDto.CategoryCode) ? iDto.CategoryCode.Trim() : null;
                            if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                            {
                                catCode = catName switch
                                {
                                    "ความสะอาด" => "CLN",
                                    "เอกสาร" => "DOC",
                                    "กระบวนการทำงาน" => "OPS",
                                    "คุณภาพสินค้า-วัตถุดิบ" => "QLT",
                                    "การบริการ" => "SVC",
                                    _ => "GEN"
                                };
                            }
                            if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                            {
                                catName = catCode switch
                                {
                                    "CLN" => "ความสะอาด",
                                    "DOC" => "เอกสาร",
                                    "OPS" => "กระบวนการทำงาน",
                                    "QLT" => "คุณภาพสินค้า-วัตถุดิบ",
                                    "SVC" => "การบริการ",
                                    _ => "ความสะอาด"
                                };
                            }

                            var item = new SurveyItem
                            {
                                SurveySectionId = section.Id,
                                QuestionText = iDto.QuestionText,
                                QuestionType = iDto.QuestionType,
                                FullScore = iDto.FullScore,
                                IsCritical = iDto.IsCritical,
                                CategoryCode = catCode ?? "GEN",
                                CategoryName = catName ?? "ความสะอาด",
                                OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                                IsActive = true
                            };
                            _context.SurveyItems.Add(item);
                        }
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
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
                        BrandId = effectiveBrandId,
                        PassingScore = dto.PassingScore,
                        TargetingMode = dto.TargetingMode,
                        Version = dto.Version,
                        MetadataConfigJson = dto.MetadataConfigJson,
                        IsLatest = true,
                        IsActive = true,
                        CreatedBy = dto.CreatedBy ?? form.CreatedBy,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.SurveyForms.Add(newVersionForm);
                    await _context.SaveChangesAsync();

                    // Clone Brands (SurveyFormBrands)
                    if (dto.BrandIds != null && dto.BrandIds.Any())
                    {
                        foreach (var bId in dto.BrandIds.Distinct())
                        {
                            _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = newVersionForm.Id, BrandId = bId });
                        }
                    }
                    else if (effectiveBrandId.HasValue)
                    {
                        _context.SurveyFormBrands.Add(new SurveyFormBrand { SurveyFormId = newVersionForm.Id, BrandId = effectiveBrandId.Value });
                    }

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
                            string? catName = !string.IsNullOrWhiteSpace(iDto.CategoryName) ? iDto.CategoryName.Trim() : null;
                            string? catCode = !string.IsNullOrWhiteSpace(iDto.CategoryCode) ? iDto.CategoryCode.Trim() : null;
                            if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                            {
                                catCode = catName switch
                                {
                                    "ความสะอาด" => "CLN",
                                    "เอกสาร" => "DOC",
                                    "กระบวนการทำงาน" => "OPS",
                                    "คุณภาพสินค้า-วัตถุดิบ" => "QLT",
                                    "การบริการ" => "SVC",
                                    _ => "GEN"
                                };
                            }
                            if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                            {
                                catName = catCode switch
                                {
                                    "CLN" => "ความสะอาด",
                                    "DOC" => "เอกสาร",
                                    "OPS" => "กระบวนการทำงาน",
                                    "QLT" => "คุณภาพสินค้า-วัตถุดิบ",
                                    "SVC" => "การบริการ",
                                    _ => "ความสะอาด"
                                };
                            }

                            var item = new SurveyItem
                            {
                                SurveySectionId = section.Id,
                                QuestionText = iDto.QuestionText,
                                QuestionType = iDto.QuestionType,
                                FullScore = iDto.FullScore,
                                IsCritical = iDto.IsCritical,
                                CategoryCode = catCode ?? "GEN",
                                CategoryName = catName ?? "ความสะอาด",
                                OrderIndex = iDto.OrderIndex > 0 ? iDto.OrderIndex : itemIdx++,
                                IsActive = true
                            };
                            _context.SurveyItems.Add(item);
                        }
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                    return Ok(new { message = "สร้างเวอร์ชันใหม่สำเร็จเพื่อล็อกประวัติเดิม (Version Clone)", formId = newVersionForm.Id });
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการอัปเดตแบบฟอร์ม: " + ex.Message });
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
