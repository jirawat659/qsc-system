export function exportToExcel({ mode = "all", targetUnit = null, timeRange = "all", timeRangeLabel = null, region = "all", locations = [], auditRecords = [] }) {
  let csvContent = "\uFEFF"; // UTF-8 BOM so Excel opens Thai characters correctly
  let filename = "QSC_Report.csv";

  const now = new Date();
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const thaiShortMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const curMonth = now.getMonth();
  const curYearBE = now.getFullYear() + 543;
  const curYearShort = curYearBE % 100;
  const d3 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const d6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const defaultTimeLabels = {
    all: "ทั้งหมด (ทุกรอบตรวจ)",
    "1M": `ย้อนหลัง 1 เดือน (${thaiMonths[curMonth]} ${curYearBE})`,
    "3M": `ย้อนหลัง 3 เดือน (${thaiShortMonths[d3.getMonth()]} - ${thaiShortMonths[curMonth]} ${curYearShort})`,
    "6M": `ย้อนหลัง 6 เดือน (${thaiShortMonths[d6.getMonth()]} - ${thaiShortMonths[curMonth]} ${curYearShort})`,
    "1Y": `ทั้งปี (YTD ${curYearBE})`
  };

  const resolvedTimeLabel = timeRangeLabel || defaultTimeLabels[timeRange] || "ทั้งหมด (ทุกรอบตรวจ)";

  if (mode === "all") {
    filename = `QSC_Master_Audit_Report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานสรุปผลการตรวจมาตรฐาน Q.S.C. ระดับองค์กร\n`;
    csvContent += `ช่วงเวลา: ${resolvedTimeLabel}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n`;
    csvContent += `เกณฑ์คะแนนผ่านการตรวจมาตรฐาน: 85%, เกณฑ์ดีเยี่ยม: 90%\n\n`;
    csvContent += "ลำดับ,รหัสสาขา,ชื่อสาขา,ชื่อเต็ม,ภูมิภาค,ที่อยู่,เบอร์โทรศัพท์,คะแนนตรวจล่าสุด(%),ผลการตรวจ(เกณฑ์ 85%),วันที่ตรวจล่าสุด\n";
    
    let branches = Array.isArray(locations) ? [...locations] : [];
    if (region !== "all") {
      branches = branches.filter(u => (u.region || '').includes(region));
    }

    branches.forEach((u, i) => {
      const score = u.lastScore !== undefined ? u.lastScore : 0;
      const isPassed = score >= 90 ? "ดีเยี่ยม (≥90%)" : score >= 85 ? "ผ่านเกณฑ์ (≥85%)" : "ต่ำกว่าเกณฑ์ (ต้องแก้งาน)";
      const lastDate = u.lastAuditDate ? new Date(u.lastAuditDate).toLocaleDateString('th-TH') : "-";
      csvContent += `"${i + 1}","${u.code || '-'}","${u.name}","${u.fullName || u.name}","${u.region || '-'}","${u.address || '-'}","${u.phone || '-'}","${score}","${isPassed}","${lastDate}"\n`;
    });
  } else if (mode === "unit" && targetUnit) {
    filename = `QSC_${targetUnit.name}_Audit_History_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานประวัติการตรวจสาขา: ${targetUnit.fullName || targetUnit.name}\n`;
    csvContent += `ภูมิภาค: ${targetUnit.region || '-'}, เบอร์โทรศัพท์: ${targetUnit.phone || '-'}\n`;
    csvContent += `ช่วงเวลาที่เลือก: ${resolvedTimeLabel}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n\n`;
    csvContent += "ครั้งที่,วันที่ตรวจ,คะแนนที่ได้(%),เกณฑ์ผ่าน(85%),ผู้ตรวจประเมิน,ผลการประเมิน\n";
    
    // Filter matching audit records for this unit and optional time range
    let unitRecords = (auditRecords || []).filter(r => r.locationId === targetUnit.id || r.locationName === targetUnit.name);
    if (timeRange && timeRange !== "all") {
      let cutoff = null;
      if (timeRange === "1M") cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (timeRange === "3M") cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      else if (timeRange === "6M") cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      else if (timeRange === "1Y") cutoff = new Date(now.getFullYear(), 0, 1);

      if (cutoff) {
        unitRecords = unitRecords.filter(r => {
          const d = new Date(r.auditDate || r.date);
          return !isNaN(d.getTime()) && d >= cutoff;
        });
      }
    }
    
    if (unitRecords.length > 0) {
      unitRecords.forEach((r, i) => {
        const score = Math.round(r.percentageScore || r.score || 0);
        const isPassed = score >= 90 ? "ดีเยี่ยม" : score >= 85 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์";
        const dateStr = r.auditDate ? new Date(r.auditDate).toLocaleDateString('th-TH') : (r.date || "-");
        // 🐛 FIX: don't fabricate a fake auditor name ("สมชาย ใจดี") when the record
        // has none — that placeholder looked like real audit data in an exported report.
        const auditor = r.auditorName || r.auditor || "-";
        csvContent += `"${i + 1}","${dateStr}","${score}","85%","${auditor}","${isPassed}"\n`;
      });
    } else {
      // 🐛 FIX: previously fabricated a fake "audit #1" row (using cached lastScore and a
      // hardcoded auditor name "สมชาย ใจดี") even when the branch has zero real audit
      // records. That made an unaudited branch look audited in the exported report.
      csvContent += `"-","-","-","-","-","ยังไม่มีประวัติการตรวจ"\n`;
    }
  } else if (mode === "detailed_questions" && targetUnit) {
    filename = `QSC_${targetUnit.name}_Detailed_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานผลการตอบแบบฟอร์มการตรวจรายข้อแบบละเอียด: ${targetUnit.fullName || targetUnit.name}\n`;
    csvContent += `ภูมิภาค: ${targetUnit.region || '-'}, เบอร์โทรศัพท์: ${targetUnit.phone || '-'}\n`;
    csvContent += `คะแนนประเมินล่าสุด: ${targetUnit.lastScore || 0}% (${(targetUnit.lastScore || 0) >= 85 ? 'ผ่านเกณฑ์' : 'ต่ำกว่าเกณฑ์'})\n`;
    csvContent += `วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n\n`;
    csvContent += "ลำดับ,รหัสสาขา,ชื่อสาขา,ภูมิภาค,คะแนนประเมิน,ผลการตรวจ,วันที่ตรวจ\n";
    
    const isPassed = (targetUnit.lastScore || 0) >= 85 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์";
    const dateStr = targetUnit.lastAuditDate ? new Date(targetUnit.lastAuditDate).toLocaleDateString('th-TH') : "-";
    csvContent += `"1","${targetUnit.code || '-'}","${targetUnit.name}","${targetUnit.region || '-'}","${targetUnit.lastScore || 0}%","${isPassed}","${dateStr}"\n`;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default exportToExcel;