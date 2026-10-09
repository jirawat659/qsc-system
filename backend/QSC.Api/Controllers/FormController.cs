using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;
using QSC.Api.Services;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FormController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<FormController> _logger;
        private readonly IActivityLogger _activityLogger;

        public FormController(AppDbContext context, ILogger<FormController> logger, IActivityLogger activityLogger)
        {
            _context = context;
            _logger = logger;
            _activityLogger = activityLogger;
        }

        [HttpGet]
        public async Task<IActionResult> GetForms(
            [FromQuery] bool onlyLatest = false,
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
                .IgnoreQueryFilters()
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

                var (cleanMetaJson, secTypes, itConfigs) = UnpackFormMetadata(f.MetadataConfigJson);

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
                    metadataConfigJson = cleanMetaJson,
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
                    sections = isSummary ? null : f.Sections.OrderBy(s => s.OrderIndex).Select(s => {
                        string secKey = s.OrderIndex.ToString();
                        string secType = SectionRules.IsInfoSection(s, secTypes) ? "INFO" : "AUDIT";
                        return new
                        {
                            id = s.Id,
                            title = s.Title,
                            sectionType = secType,
                            orderIndex = s.OrderIndex,
                            weightPercent = s.WeightPercent,
                            items = s.Items.OrderBy(i => i.OrderIndex).Select(i => {
                                string itemKey = $"{secKey}_{i.OrderIndex}";
                                string? fcJson = itConfigs.TryGetValue(itemKey, out var fc) ? fc : null;
                                object? parsedFc = null;
                                if (!string.IsNullOrEmpty(fcJson))
                                {
                                    try { parsedFc = JsonSerializer.Deserialize<object>(fcJson); } catch {}
                                }
                                bool isScored = secType != "INFO" && SectionRules.IsScoredItem(i, i.FullScore);
                                return new
                                {
                                    id = i.Id,
                                    questionText = i.QuestionText,
                                    questionType = i.QuestionType,
                                    fullScore = i.FullScore,
                                    isScored = isScored,
                                    isCritical = i.IsCritical,
                                    categoryCode = i.CategoryCode ?? (isScored ? "GEN" : "INFO"),
                                    categoryName = !string.IsNullOrEmpty(i.CategoryName) ? i.CategoryName : (i.CategoryCode switch
                                    {
                                        "CLN" => "ความสะอาด",
                                        "DOC" => "เอกสาร",
                                        "OPS" => "กระบวนการทำงาน",
                                        "QLT" => "คุณภาพสินค้า",
                                        "SVC" => "การบริการ",
                                        "REG" => "ความถูกระเบียบ",
                                        "SAF" => "ความปลอดภัย",
                                        "INFO" => "รายละเอียด",
                                        _ => (isScored ? "ความสะอาด" : "รายละเอียด")
                                    }),
                                    orderIndex = i.OrderIndex,
                                    fieldConfig = parsedFc,
                                    fieldConfigJson = fcJson
                                };
                            }).ToList()
                        };
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

            var auditCount = await _context.AuditRecords.IgnoreQueryFilters().AsNoTracking().CountAsync(a => a.SurveyFormId == id);
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

            var (cleanMetaJson, secTypes, itConfigs) = UnpackFormMetadata(f.MetadataConfigJson);

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
                metadataConfigJson = cleanMetaJson,
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
                sections = f.Sections.OrderBy(s => s.OrderIndex).Select(s => {
                    string secKey = s.OrderIndex.ToString();
                    string secType = SectionRules.IsInfoSection(s, secTypes) ? "INFO" : "AUDIT";
                    return new
                    {
                        id = s.Id,
                        title = s.Title,
                        sectionType = secType,
                        orderIndex = s.OrderIndex,
                        weightPercent = s.WeightPercent,
                        items = s.Items.OrderBy(i => i.OrderIndex).Select(i => {
                            string itemKey = $"{secKey}_{i.OrderIndex}";
                            string? fcJson = itConfigs.TryGetValue(itemKey, out var fc) ? fc : null;
                            object? parsedFc = null;
                            if (!string.IsNullOrEmpty(fcJson))
                            {
                                try { parsedFc = JsonSerializer.Deserialize<object>(fcJson); } catch {}
                            }
                            bool isScored = secType != "INFO" && SectionRules.IsScoredItem(i, i.FullScore);
                            return new
                            {
                                id = i.Id,
                                questionText = i.QuestionText,
                                questionType = i.QuestionType,
                                fullScore = i.FullScore,
                                isScored = isScored,
                                isCritical = i.IsCritical,
                                categoryCode = i.CategoryCode ?? (isScored ? "GEN" : "INFO"),
                                categoryName = !string.IsNullOrEmpty(i.CategoryName) ? i.CategoryName : (i.CategoryCode switch
                                {
                                    "CLN" => "ความสะอาด",
                                    "DOC" => "เอกสาร",
                                    "OPS" => "กระบวนการทำงาน",
                                    "QLT" => "คุณภาพสินค้า",
                                    "SVC" => "การบริการ",
                                    "REG" => "ความถูกระเบียบ",
                                    "SAF" => "ความปลอดภัย",
                                    "INFO" => "รายละเอียด",
                                    _ => (isScored ? "ความสะอาด" : "รายละเอียด")
                                }),
                                orderIndex = i.OrderIndex,
                                fieldConfig = parsedFc,
                                fieldConfigJson = fcJson
                            };
                        }).ToList()
                    };
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
            public string? SectionType { get; set; } = "AUDIT"; // "AUDIT" or "INFO"
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
            public bool? IsScored { get; set; }
            public string? FieldConfigJson { get; set; }
            public object? FieldConfig { get; set; }
        }

        // 🌟 Helper สำหรับจัดเก็บโครงสร้างหมวดหมู่ (SectionType) และการตั้งค่าฟิลด์ไดนามิก (FieldConfig)
        // รวมถึงประวัติการสืบทอดรหัสข้อคำถาม (itemLineageMapping) โดยเก็บเป็น Envelope ใน MetadataConfigJson อย่างปลอดภัย 100% โดยไม่ต้องเปลี่ยนแปลงสกีมาฐานข้อมูล
        public static string PackFormMetadata(
            string? rawMetadataJson, 
            List<SectionDto>? sections, 
            Dictionary<string, int>? itemLineageMapping = null)
        {
            var sectionTypes = new Dictionary<string, string>();
            var itemConfigs = new Dictionary<string, string>();

            if (sections != null)
            {
                int sIdx = 1;
                foreach (var sec in sections)
                {
                    string secKey = sec.OrderIndex > 0 ? sec.OrderIndex.ToString() : (sIdx++).ToString();
                    if (!string.IsNullOrWhiteSpace(sec.SectionType))
                    {
                        sectionTypes[secKey] = sec.SectionType.Trim().ToUpper();
                    }

                    int iIdx = 1;
                    foreach (var item in sec.Items)
                    {
                        string itKey = $"{secKey}_{(item.OrderIndex > 0 ? item.OrderIndex : iIdx++)}";
                        string? fc = item.FieldConfigJson;
                        if (string.IsNullOrWhiteSpace(fc) && item.FieldConfig != null)
                        {
                            try { fc = JsonSerializer.Serialize(item.FieldConfig); } catch { }
                        }
                        if (!string.IsNullOrWhiteSpace(fc))
                        {
                            itemConfigs[itKey] = fc;
                        }
                    }
                }
            }

            if (sectionTypes.Count == 0 && itemConfigs.Count == 0 && (itemLineageMapping == null || itemLineageMapping.Count == 0))
            {
                return rawMetadataJson ?? string.Empty;
            }

            var envelope = new
            {
                envelopeVersion = 1,
                metadataJson = rawMetadataJson ?? string.Empty,
                sectionTypes,
                itemConfigs,
                itemLineageMapping = itemLineageMapping ?? new Dictionary<string, int>()
            };

            return JsonSerializer.Serialize(envelope);
        }

        public static (string? cleanMetadataJson, Dictionary<string, string> sectionTypes, Dictionary<string, string> itemConfigs) UnpackFormMetadata(string? packedJson)
        {
            var (meta, secTypes, itConfigs, _) = UnpackFormMetadataWithLineage(packedJson);
            return (meta, secTypes, itConfigs);
        }

        public static (string? cleanMetadataJson, Dictionary<string, string> sectionTypes, Dictionary<string, string> itemConfigs, Dictionary<string, int> itemLineageMapping) UnpackFormMetadataWithLineage(string? packedJson)
        {
            var sectionTypes = new Dictionary<string, string>();
            var itemConfigs = new Dictionary<string, string>();
            var itemLineageMapping = new Dictionary<string, int>();

            if (string.IsNullOrWhiteSpace(packedJson))
            {
                return (packedJson, sectionTypes, itemConfigs, itemLineageMapping);
            }

            try
            {
                using var doc = JsonDocument.Parse(packedJson);
                var root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("envelopeVersion", out _))
                {
                    string? meta = null;
                    if (root.TryGetProperty("metadataJson", out var metaProp))
                    {
                        meta = metaProp.GetString();
                    }

                    if (root.TryGetProperty("sectionTypes", out var secProp) && secProp.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in secProp.EnumerateObject())
                        {
                            sectionTypes[prop.Name] = prop.Value.GetString() ?? "AUDIT";
                        }
                    }

                    if (root.TryGetProperty("itemConfigs", out var itemProp) && itemProp.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in itemProp.EnumerateObject())
                        {
                            itemConfigs[prop.Name] = prop.Value.GetString() ?? string.Empty;
                        }
                    }

                    if (root.TryGetProperty("itemLineageMapping", out var linProp) && linProp.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in linProp.EnumerateObject())
                        {
                            if (prop.Value.TryGetInt32(out var newId))
                            {
                                itemLineageMapping[prop.Name] = newId;
                            }
                        }
                    }

                    return (meta, sectionTypes, itemConfigs, itemLineageMapping);
                }
            }
            catch
            {
                // Fallback สำหรับ JSON array ดั้งเดิม
            }

            return (packedJson, sectionTypes, itemConfigs, itemLineageMapping);
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

                int? currentUserId = null;
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out var parsedUid))
                {
                    currentUserId = parsedUid;
                }

                var form = new SurveyForm
                {
                    Title = dto.Title,
                    LocationTypeId = dto.LocationTypeId,
                    BrandId = effectiveBrandId,
                    PassingScore = dto.PassingScore,
                    TargetingMode = dto.TargetingMode,
                    Version = dto.Version,
                    MetadataConfigJson = PackFormMetadata(dto.MetadataConfigJson, dto.Sections),
                    CategoryOrderJson = dto.CategoryOrderJson,
                    IsLatest = true,
                    IsActive = true,
                    CreatedBy = dto.CreatedBy ?? currentUserId,
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
                                "INFO" or "รายละเอียด" or "ข้อมูลทั่วไป" => "รายละเอียด",
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
                                "รายละเอียด" => "INFO",
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
                                "INFO" => "INFO",
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
                                "INFO" => "รายละเอียด",
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

                if (currentUserId.HasValue)
                {
                    _activityLogger.Add(currentUserId.Value, "FORM_CREATE", "SurveyForm", form.Id);
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

            var (currentUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);

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
                bool hasAudits = await _context.AuditRecords.IgnoreQueryFilters().AnyAsync(r => r.SurveyFormId == id);
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
                    form.MetadataConfigJson = PackFormMetadata(dto.MetadataConfigJson, dto.Sections);
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
                                    "INFO" or "รายละเอียด" or "ข้อมูลทั่วไป" => "รายละเอียด",
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
                                    "รายละเอียด" => "INFO",
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
                                    "INFO" => "INFO",
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
                                    "INFO" => "รายละเอียด",
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

                    _activityLogger.Add(currentUserId, "FORM_EDIT", "SurveyForm", form.Id);
                    await _context.SaveChangesAsync();

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
                        MetadataConfigJson = PackFormMetadata(dto.MetadataConfigJson, dto.Sections),
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
                    var itemLineageMapping = new Dictionary<string, int>();
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
                                    "INFO" or "รายละเอียด" or "ข้อมูลทั่วไป" => "รายละเอียด",
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
                                    "รายละเอียด" => "INFO",
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
                                    "INFO" => "INFO",
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
                                    "INFO" => "รายละเอียด",
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
                            await _context.SaveChangesAsync();

                            // 🌟 Track lineage mapping if source item id was provided from frontend
                            if (iDto.Id.HasValue && iDto.Id.Value > 0)
                            {
                                itemLineageMapping[iDto.Id.Value.ToString()] = item.Id;
                            }
                        }
                    }

                    // 🌟 Re-pack metadata with itemLineageMapping now that all new item IDs are known
                    if (itemLineageMapping.Any())
                    {
                        newVersionForm.MetadataConfigJson = PackFormMetadata(dto.MetadataConfigJson, dto.Sections, itemLineageMapping);
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

                    _activityLogger.Add(currentUserId, "FORM_EDIT", "SurveyForm", newVersionForm.Id);
                    await _context.SaveChangesAsync();

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
        [HttpPost("{id}/duplicate")]
        public async Task<IActionResult> DuplicateForm(int id)
        {
            var (currentUserId, role, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var original = await _context.SurveyForms
                .Include(f => f.Sections.Where(s => s.IsActive))
                    .ThenInclude(s => s.Items.Where(i => i.IsActive))
                .Include(f => f.FormBrands)
                .Include(f => f.TargetLocations)
                .FirstOrDefaultAsync(f => f.Id == id && f.IsActive);

            if (original == null)
            {
                return NotFound(new { message = "ไม่พบแบบฟอร์มต้นฉบับ หรือแบบฟอร์มถูกปิดใช้งานแล้ว" });
            }

            if (allowedBrandIds != null)
            {
                bool inScope = (!original.FormBrands.Any() && original.BrandId == null)
                    || original.FormBrands.Any(fb => allowedBrandIds.Contains(fb.BrandId))
                    || (original.BrandId.HasValue && allowedBrandIds.Contains(original.BrandId.Value));
                if (!inScope)
                {
                    return Forbid();
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var duplicateTitle = $"{original.Title} (สำเนา)";

                var newForm = new SurveyForm
                {
                    Title = duplicateTitle,
                    LocationTypeId = original.LocationTypeId,
                    BrandId = original.BrandId,
                    PassingScore = original.PassingScore,
                    TargetingMode = original.TargetingMode,
                    Version = "v1.0",
                    MetadataConfigJson = original.MetadataConfigJson,
                    CategoryOrderJson = original.CategoryOrderJson,
                    IsLatest = true,
                    IsActive = true,
                    CreatedBy = currentUserId > 0 ? currentUserId : original.CreatedBy,
                    CreatedAt = DateTime.UtcNow
                };

                _context.SurveyForms.Add(newForm);
                await _context.SaveChangesAsync();

                newForm.FormGroupId = newForm.Id;
                await _context.SaveChangesAsync();

                // Clone brands
                foreach (var fb in original.FormBrands)
                {
                    _context.SurveyFormBrands.Add(new SurveyFormBrand
                    {
                        SurveyFormId = newForm.Id,
                        BrandId = fb.BrandId
                    });
                }

                // Clone target locations
                foreach (var tl in original.TargetLocations)
                {
                    _context.SurveyFormTargetLocations.Add(new SurveyFormTargetLocation
                    {
                        SurveyFormId = newForm.Id,
                        LocationId = tl.LocationId
                    });
                }

                // Clone sections and items
                foreach (var sec in original.Sections.OrderBy(s => s.OrderIndex))
                {
                    var newSec = new SurveySection
                    {
                        SurveyFormId = newForm.Id,
                        Title = sec.Title,
                        OrderIndex = sec.OrderIndex,
                        WeightPercent = sec.WeightPercent,
                        IsActive = true
                    };
                    _context.SurveySections.Add(newSec);
                    await _context.SaveChangesAsync();

                    foreach (var it in sec.Items.OrderBy(i => i.OrderIndex))
                    {
                        var newIt = new SurveyItem
                        {
                            SurveySectionId = newSec.Id,
                            QuestionText = it.QuestionText,
                            QuestionType = it.QuestionType,
                            FullScore = it.FullScore,
                            IsCritical = it.IsCritical,
                            CategoryCode = it.CategoryCode,
                            CategoryName = it.CategoryName,
                            OrderIndex = it.OrderIndex,
                            IsActive = true
                        };
                        _context.SurveyItems.Add(newIt);
                    }
                    await _context.SaveChangesAsync();
                }

                _activityLogger.Add(currentUserId, "FORM_DUPLICATE", "SurveyForm", newForm.Id);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"ทำซ้ำแบบฟอร์มสำเร็จ: {duplicateTitle}",
                    formId = newForm.Id,
                    title = newForm.Title,
                    version = newForm.Version
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error duplicating form {FormId}", id);
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการทำซ้ำแบบฟอร์ม กรุณาลองใหม่อีกครั้ง" });
            }
        }

        [Authorize(Roles = "ADMIN,STANDARD")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteForm(int id)
        {
            var form = await _context.SurveyForms.FindAsync(id);
            if (form == null) return NotFound();

            var (currentUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            form.IsActive = false; // Soft delete
            _activityLogger.Add(currentUserId, "FORM_DELETE", "SurveyForm", form.Id);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}