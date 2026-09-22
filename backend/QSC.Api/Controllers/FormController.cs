using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FormController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<FormController> _logger;

        public FormController(AppDbContext context, ILogger<FormController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetForms(
            [FromQuery] bool onlyLatest = true,
            [FromQuery] int? brandId = null,
            [FromQuery] string? detail = "full")
        {
            // 🌟 detail=summary: ใช้ตอนโหลดหน้า Dashboard/List ที่ไม่ได้แสดงเนื้อหาคำถามจริง
            // (เช่น MainDashboard, FormsScreen, AllAuditHistoryScreen ที่ใช้แค่จำนวนข้อ/คะแนนรวม)
            // ข้าม Include(Sections->Items) ทั้งก้อนไปเลย แล้วคำนวณ itemCount/totalScore
            // ผ่าน aggregate query แยกต่างหาก (เบากว่ามากเพราะไม่ต้องดึงข้อความคำถามจริง)
            // ส่วนหน้าที่ต้องใช้คำถามจริง (Live Audit, Form Editor) ให้เรียก GET /api/form/{id}
            // (detail=full ค่า default ยังคงพฤติกรรมเดิมเป๊ะ ๆ เพื่อ backward-compat)
            bool isSummary = string.Equals(detail, "summary", StringComparison.OrdinalIgnoreCase);

            var query = _context.SurveyForms
                .AsNoTracking()
                .AsSplitQuery()
                .Include(f => f.LocationType)
                .Include(f => f.Brand)
                .Include(f => f.FormBrands)
                    .ThenInclude(fb => fb.Brand)
                .Include(f => f.TargetLocations)
                .AsQueryable();

            if (!isSummary)
            {
                query = query
                    .Include(f => f.Sections.Where(s => s.IsActive))
                        .ThenInclude(s => s.Items.Where(i => i.IsActive));
            }

            query = query.Where(f => f.IsActive);

            if (onlyLatest)
            {
                query = query.Where(f => f.IsLatest);
            }

            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);
            if (allowedBrandIds != null)
            {
                query = query.Where(f => (!f.FormBrands.Any() && f.BrandId == null)
                                      || f.FormBrands.Any(fb => allowedBrandIds.Contains(fb.BrandId))
                                      || (f.BrandId.HasValue && allowedBrandIds.Contains(f.BrandId.Value)));
            }

            if (brandId.HasValue && brandId.Value > 0)
            {
                query = query.Where(f => (!f.FormBrands.Any() && f.BrandId == null)
                                      || f.FormBrands.Any(fb => fb.BrandId == brandId.Value)
                                      || f.BrandId == brandId.Value);
            }

            var forms = await query.OrderBy(f => f.Id).ToListAsync();

            var formIds = forms.Select(f => f.Id).ToList();

            var auditCounts = formIds.Count == 0 ? new Dictionary<int, int>() : await _context.AuditRecords
                .AsNoTracking()
                .Where(a => formIds.Contains(a.SurveyFormId))
                .GroupBy(a => a.SurveyFormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.FormId, x => x.Count);

            var draftCounts = formIds.Count == 0 ? new Dictionary<int, int>() : await _context.AuditDrafts
                .AsNoTracking()
                .Where(d => formIds.Contains(d.SurveyFormId))
                .GroupBy(d => d.SurveyFormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.FormId, x => x.Count);

            var scheduleCounts = formIds.Count == 0 ? new Dictionary<int, int>() : await _context.AuditSchedules
                .AsNoTracking()
                .Where(s => formIds.Contains(s.SurveyFormId) && s.Status != null && s.Status != "cancelled" && s.Status != "CANCELLED")
                .GroupBy(s => s.SurveyFormId)
                .Select(g => new { FormId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.FormId, x => x.Count);

            // 🌟 Summary mode: นับจำนวนหมวด/จำนวนข้อ/รวมคะแนนเต็มด้วย aggregate query แยก (ไม่ดึงข้อความคำถามจริง)
            // แทนที่จะโหลด Sections+Items ทั้งก้อนเข้า memory เหมือน full mode
            Dictionary<int, (int SectionCount, int ItemCount, int TotalScore)> itemStats = new();
            if (isSummary && formIds.Count > 0)
            {
                var stats = await _context.SurveySections
                    .AsNoTracking()
                    .Where(s => formIds.Contains(s.SurveyFormId) && s.IsActive)
                    .Select(s => new
                    {
                        s.SurveyFormId,
                        Count = s.Items.Count(i => i.IsActive),
                        Score = s.Items.Where(i => i.IsActive).Sum(i => (int?)i.FullScore) ?? 0
                    })
                    .ToListAsync();

                itemStats = stats
                    .GroupBy(s => s.SurveyFormId)
                    .ToDictionary(g => g.Key, g => (
                        SectionCount: g.Count(),
                        ItemCount: g.Sum(x => x.Count), 
                        TotalScore: g.Sum(x => x.Score)
                    ));
            }

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
                    categoryOrderJson = f.CategoryOrderJson,
                    createdAt = f.CreatedAt,
                    usedCount = auditCounts.GetValueOrDefault(f.Id, 0),
                    draftCount = draftCounts.GetValueOrDefault(f.Id, 0),
                    scheduledCount = scheduleCounts.GetValueOrDefault(f.Id, 0),
                    isInUse = auditCounts.GetValueOrDefault(f.Id, 0) > 0 || draftCounts.GetValueOrDefault(f.Id, 0) > 0 || scheduleCounts.GetValueOrDefault(f.Id, 0) > 0,
                    targetLocationIds = f.TargetLocations.Select(t => t.LocationId).ToList(),
                    // 🌟 Summary mode: ไม่มี Sections โหลดมา (ประหยัด query) ใช้ sectionCount/itemCount/totalScore
                    // ที่คำนวณแยกแทน ฝั่ง frontend (FormsScreen, LiveAuditScreen, AllAuditHistoryScreen) ให้ใช้ fields เหล่านี้
                    // แทนการนับจาก sections.length เอง — ถ้าต้องการเนื้อหาคำถามจริงให้เรียก
                    // GET /api/form/{id} (detail=full) ตอนเปิดใช้งานฟอร์มนั้นจริง ๆ
                    sectionCount = isSummary ? itemStats.GetValueOrDefault(f.Id).SectionCount : f.Sections.Count(s => s.IsActive),
                    itemCount = isSummary ? itemStats.GetValueOrDefault(f.Id).ItemCount : f.Sections.Where(s => s.IsActive).SelectMany(s => s.Items).Count(i => i.IsActive),
                    totalScore = isSummary ? itemStats.GetValueOrDefault(f.Id).TotalScore : f.Sections.Where(s => s.IsActive).SelectMany(s => s.Items).Where(i => i.IsActive).Sum(i => (int?)i.FullScore) ?? 0,
                    sections = isSummary ? null : f.Sections.OrderBy(s => s.OrderIndex).Select(s => new
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
                                "QLT" => "คุณภาพสินค้า",
                                "SVC" => "การบริการ",
                                "REG" => "ความถูกระเบียบ",
                                "SAF" => "ความปลอดภัย",
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
                .AsSplitQuery()
                .Include(f => f.LocationType)
                .Include(f => f.Brand)
                .Include(f => f.FormBrands)
                    .ThenInclude(fb => fb.Brand)
                .Include(f => f.TargetLocations)
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .FirstOrDefaultAsync(f => f.Id == id);

            if (f == null) return NotFound();

            var auditCount = await _context.AuditRecords.AsNoTracking().CountAsync(a => a.SurveyFormId == id);
            var draftCount = await _context.AuditDrafts.AsNoTracking().CountAsync(d => d.SurveyFormId == id);
            // 🌟 เลี่ยง .ToLower() ใน WHERE เพราะบังคับให้ DB ทำ Full Table Scan แทนที่จะใช้
            // index (Status, ScheduledDate) — จุดเดียวกับที่แก้ไปแล้วใน GetForms ด้านบน
            var scheduleCount = await _context.AuditSchedules
                .AsNoTracking()
                .CountAsync(s => s.SurveyFormId == id && s.Status != "cancelled" && s.Status != "CANCELLED");

            var targetLocationIds = f.TargetLocations.Select(t => t.LocationId).ToList();

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
                categoryOrderJson = f.CategoryOrderJson,
                createdAt = f.CreatedAt,
                usedCount = auditCount,
                draftCount = draftCount,
                scheduledCount = scheduleCount,
                isInUse = auditCount > 0 || draftCount > 0 || scheduleCount > 0,
                targetLocationIds = targetLocationIds,
                sectionCount = f.Sections.Count(s => s.IsActive),
                itemCount = f.Sections.Where(s => s.IsActive).SelectMany(s => s.Items).Count(i => i.IsActive),
                totalScore = f.Sections.Where(s => s.IsActive).SelectMany(s => s.Items).Where(i => i.IsActive).Sum(i => (int?)i.FullScore) ?? 0,
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
                            "QLT" => "คุณภาพสินค้า",
                            "SVC" => "การบริการ",
                            "REG" => "ความถูกระเบียบ",
                            "SAF" => "ความปลอดภัย",
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
            public string? CategoryOrderJson { get; set; }
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
            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest(new { message = "กรุณาระบุชื่อแบบฟอร์ม" });

            if (dto.PassingScore < 0 || dto.PassingScore > 100)
                return BadRequest(new { message = "คะแนนผ่านเกณฑ์ต้องอยู่ระหว่าง 0-100" });

            if (dto.Sections == null || !dto.Sections.Any())
                return BadRequest(new { message = "แบบฟอร์มต้องมีหมวดคำถามอย่างน้อย 1 หมวด" });

            foreach (var sDto in dto.Sections)
            {
                if (string.IsNullOrWhiteSpace(sDto.Title))
                    return BadRequest(new { message = "กรุณาระบุชื่อหมวดหมู่ให้ครบถ้วน" });

                if (sDto.Items == null || !sDto.Items.Any())
                    return BadRequest(new { message = $"หมวดหมู่ '{sDto.Title}' ต้องมีข้อคำถามอย่างน้อย 1 ข้อ" });

                foreach (var iDto in sDto.Items)
                {
                    if (string.IsNullOrWhiteSpace(iDto.QuestionText))
                        return BadRequest(new { message = $"พบข้อคำถามที่เป็นค่าว่างในหมวดหมู่ '{sDto.Title}' กรุณากรอกข้อความคำถามให้ครบถ้วน" });
                }
            }

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
                    CategoryOrderJson = dto.CategoryOrderJson,
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
                        if (!string.IsNullOrEmpty(catName))
                        {
                            catName = catName switch
                            {
                                "Product" or "คุณภาพสินค้า" or "คุณภาพสินค้า-วัตถุดิบ" => "Product",
                                "Process" or "กระบวนการทำงาน" => "Process",
                                "Service" or "การบริการ" => "Service",
                                "Cleanliness" or "ความสะอาด" => "Cleanliness",
                                "Documents" or "เอกสาร" => "Documents",
                                _ => catName
                            };
                        }

                        if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                        {
                            catCode = catName switch
                            {
                                "Product" => "PD",
                                "Process" => "PC",
                                "Service" => "S",
                                "Cleanliness" => "C",
                                "Documents" => "DM",
                                _ => "PD"
                            };
                        }
                        else if (!string.IsNullOrEmpty(catCode))
                        {
                            catCode = catCode.ToUpper() switch
                            {
                                "PD" or "QLT" => "PD",
                                "PC" or "OPS" => "PC",
                                "S" or "SVC" => "S",
                                "C" or "CLN" => "C",
                                "DM" or "DOC" => "DM",
                                _ => catCode
                            };
                        }

                        if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                        {
                            catName = catCode switch
                            {
                                "PD" => "Product",
                                "PC" => "Process",
                                "S" => "Service",
                                "C" => "Cleanliness",
                                "DM" => "Documents",
                                _ => "Product"
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
                _logger.LogError(ex, "Error creating form");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการสร้างแบบฟอร์ม กรุณาลองใหม่อีกครั้ง" });
            }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateForm(int id, [FromBody] FormSaveDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest(new { message = "กรุณาระบุชื่อแบบฟอร์ม" });

            if (dto.PassingScore < 0 || dto.PassingScore > 100)
                return BadRequest(new { message = "คะแนนผ่านเกณฑ์ต้องอยู่ระหว่าง 0-100" });

            if (dto.Sections == null || !dto.Sections.Any())
                return BadRequest(new { message = "แบบฟอร์มต้องมีหมวดคำถามอย่างน้อย 1 หมวด" });

            foreach (var sDto in dto.Sections)
            {
                if (string.IsNullOrWhiteSpace(sDto.Title))
                    return BadRequest(new { message = "กรุณาระบุชื่อหมวดหมู่ให้ครบถ้วน" });

                if (sDto.Items == null || !sDto.Items.Any())
                    return BadRequest(new { message = $"หมวดหมู่ '{sDto.Title}' ต้องมีข้อคำถามอย่างน้อย 1 ข้อ" });

                foreach (var iDto in sDto.Items)
                {
                    if (string.IsNullOrWhiteSpace(iDto.QuestionText))
                        return BadRequest(new { message = $"พบข้อคำถามที่เป็นค่าว่างในหมวดหมู่ '{sDto.Title}' กรุณากรอกข้อความคำถามให้ครบถ้วน" });
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var form = await _context.SurveyForms
                    .Include(f => f.Sections)
                        .ThenInclude(s => s.Items)
                    .FirstOrDefaultAsync(f => f.Id == id);

                if (form == null) return NotFound();

                // 🌟 SMART FORM VERSIONING LOGIC:
                // ตรวจสอบว่าแบบฟอร์มนี้เคยถูกนำไปใช้งานหรือเชื่อมโยงกับข้อมูลการตรวจ/แบบร่างหรือไม่:
                // 1. มีผลการตรวจประเมินจริงแล้ว (AuditRecords)
                // 2. มีแบบร่างการตรวจค้างอยู่ (AuditDrafts)
                // 3. มีการตรวจที่กำลังดำเนินการอยู่ (AuditSchedules status: in_progress)
                bool hasAudits = await _context.AuditRecords.AnyAsync(r => r.SurveyFormId == id);
                bool hasDrafts = await _context.AuditDrafts.AnyAsync(d => d.SurveyFormId == id);
                bool hasActiveAudits = await _context.AuditSchedules.AnyAsync(s => s.SurveyFormId == id && (s.Status == "in_progress" || s.Status == "IN_PROGRESS"));

                bool hasBeenUsed = hasAudits || hasDrafts || hasActiveAudits;

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
                    form.CategoryOrderJson = dto.CategoryOrderJson;

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
                            if (!string.IsNullOrEmpty(catName))
                            {
                                catName = catName switch
                                {
                                    "Product" or "คุณภาพสินค้า" or "คุณภาพสินค้า-วัตถุดิบ" => "Product",
                                    "Process" or "กระบวนการทำงาน" => "Process",
                                    "Service" or "การบริการ" => "Service",
                                    "Cleanliness" or "ความสะอาด" => "Cleanliness",
                                    "Documents" or "เอกสาร" => "Documents",
                                    _ => catName
                                };
                            }

                            if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                            {
                                catCode = catName switch
                                {
                                    "Product" => "PD",
                                    "Process" => "PC",
                                    "Service" => "S",
                                    "Cleanliness" => "C",
                                    "Documents" => "DM",
                                    _ => "PD"
                                };
                            }
                            else if (!string.IsNullOrEmpty(catCode))
                            {
                                catCode = catCode.ToUpper() switch
                                {
                                    "PD" or "QLT" => "PD",
                                    "PC" or "OPS" => "PC",
                                    "S" or "SVC" => "S",
                                    "C" or "CLN" => "C",
                                    "DM" or "DOC" => "DM",
                                    _ => catCode
                                };
                            }

                            if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                            {
                                catName = catCode switch
                                {
                                    "PD" => "Product",
                                    "PC" => "Process",
                                    "S" => "Service",
                                    "C" => "Cleanliness",
                                    "DM" => "Documents",
                                    _ => "Product"
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
                    return Ok(new {
                        message = "อัปเดตแบบฟอร์มสำเร็จ (บันทึกทับข้อมูลเดิมเนื่องจากยังไม่มีการตรวจหรือแบบร่าง)",
                        formId = form.Id,
                        isNewVersion = false,
                        version = form.Version
                    });
                }
                else
                {
                    // Case B: Form has been used in actual audits -> IMMUTABLE LINEAGE CLONE
                    form.IsLatest = false; // Retire old form version
                    await _context.SaveChangesAsync();

                    string nextVersion = dto.Version;
                    if (string.IsNullOrWhiteSpace(nextVersion) || nextVersion == form.Version)
                    {
                        var cur = form.Version?.Trim() ?? "v1.0";
                        if (cur.StartsWith("v", StringComparison.OrdinalIgnoreCase) && double.TryParse(cur[1..], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var vNum))
                        {
                            nextVersion = $"v{(vNum + 0.1):0.0}";
                        }
                        else
                        {
                            nextVersion = $"{cur}.1";
                        }
                    }

                    var newVersionForm = new SurveyForm
                    {
                        FormGroupId = form.FormGroupId ?? form.Id,
                        Title = dto.Title,
                        LocationTypeId = dto.LocationTypeId,
                        BrandId = effectiveBrandId,
                        PassingScore = dto.PassingScore,
                        TargetingMode = dto.TargetingMode,
                        Version = nextVersion,
                        MetadataConfigJson = dto.MetadataConfigJson,
                        CategoryOrderJson = dto.CategoryOrderJson,
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
                            if (!string.IsNullOrEmpty(catName))
                            {
                                catName = catName switch
                                {
                                    "Product" or "คุณภาพสินค้า" or "คุณภาพสินค้า-วัตถุดิบ" => "Product",
                                    "Process" or "กระบวนการทำงาน" => "Process",
                                    "Service" or "การบริการ" => "Service",
                                    "Cleanliness" or "ความสะอาด" => "Cleanliness",
                                    "Documents" or "เอกสาร" => "Documents",
                                    _ => catName
                                };
                            }

                            if (string.IsNullOrEmpty(catCode) && !string.IsNullOrEmpty(catName))
                            {
                                catCode = catName switch
                                {
                                    "Product" => "PD",
                                    "Process" => "PC",
                                    "Service" => "S",
                                    "Cleanliness" => "C",
                                    "Documents" => "DM",
                                    _ => "PD"
                                };
                            }
                            else if (!string.IsNullOrEmpty(catCode))
                            {
                                catCode = catCode.ToUpper() switch
                                {
                                    "PD" or "QLT" => "PD",
                                    "PC" or "OPS" => "PC",
                                    "S" or "SVC" => "S",
                                    "C" or "CLN" => "C",
                                    "DM" or "DOC" => "DM",
                                    _ => catCode
                                };
                            }

                            if (string.IsNullOrEmpty(catName) && !string.IsNullOrEmpty(catCode))
                            {
                                catName = catCode switch
                                {
                                    "PD" => "Product",
                                    "PC" => "Process",
                                    "S" => "Service",
                                    "C" => "Cleanliness",
                                    "DM" => "Documents",
                                    _ => "Product"
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

                    // 🌟 Migrate pending schedules from old form version to new version (ไม่แตะ in_progress เพื่อให้คนที่ตรวจอยู่ไม่หลุดจากข้อเดิม)
                    var pendingSchedules = await _context.AuditSchedules
                        .Where(s => s.SurveyFormId == id && s.Status == "pending")
                        .ToListAsync();
                    foreach (var ps in pendingSchedules)
                    {
                        ps.SurveyFormId = newVersionForm.Id;
                    }
                    if (pendingSchedules.Any())
                    {
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                    return Ok(new {
                        message = $"แบบฟอร์มนี้มีการตรวจหรือแบบร่างใช้งานอยู่ จึงสร้างเป็นเวอร์ชันใหม่ ({newVersionForm.Version}) สำเร็จเพื่อรักษาประวัติเดิม",
                        formId = newVersionForm.Id,
                        isNewVersion = true,
                        version = newVersionForm.Version
                    });
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error updating form");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการอัปเดตแบบฟอร์ม กรุณาลองใหม่อีกครั้ง" });
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