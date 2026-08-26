export function exportToExcel({ mode = "all", targetUnit = null, timeRange = "all", region = "all", locations = [] }) {
  let csvContent = "\uFEFF"; // UTF-8 BOM so Excel opens Thai characters correctly
  let filename = "QSC_Report.csv";

  const timeLabels = {
    all: "ทั้งหมด (ทุกรอบตรวจ)",
    "1M": "ย้อนหลัง 1 เดือน (ส.ค. 69)",
    "3M": "ย้อนหลัง 3 เดือน (มิ.ย. - ส.ค. 69)",
    "6M": "ย้อนหลัง 6 เดือน (มี.ค. - ส.ค. 69)",
    "1Y": "ทั้งปี (YTD 2569)"
  };

  if (mode === "all") {
    filename = `QSC_Master_Audit_Report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานสรุปผลการตรวจมาตรฐาน Q.S.C. ระดับองค์กร\n`;
    csvContent += `ช่วงเวลา: ${timeLabels[timeRange] || 'ทั้งหมด'}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n`;
    csvContent += `เกณฑ์คะแนนผ่านการตรวจมาตรฐาน: 85%, เกณฑ์ดีเยี่ยม: 90%\n\n`;
    csvContent += "ลำดับ,ชื่อสาขา,ชื่อเต็ม,ภูมิภาค,ที่อยู่,เบอร์โทรศัพท์,คะแนนตรวจล่าสุด(%),ผลการตรวจ(เกณฑ์ 85%),วันที่ตรวจล่าสุด,ผู้ตรวจประเมินล่าสุด\n";
    
    let branches = Array.isArray(locations) ? [...locations] : [];
    if (region !== "all") {
      branches = branches.filter(u => u.region.includes(region));
    }

    branches.forEach((u, i) => {
      const isPassed = u.lastScore >= 90 ? "ดีเยี่ยม (≥90%)" : u.lastScore >= 85 ? "ผ่านเกณฑ์ (≥85%)" : "ต่ำกว่าเกณฑ์ (ต้องแก้งาน)";
      csvContent += `"${i + 1}","${u.name}","${u.fullName || u.name}","${u.region}","${u.address}","${u.phone}","${u.lastScore}","${isPassed}","${u.history[0]?.date || '-'}","${u.history[0]?.auditor || '-'}"\n`;
    });
  } else if (mode === "unit" && targetUnit) {
    filename = `QSC_${targetUnit.name}_Audit_History_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานประวัติการตรวจสาขา: ${targetUnit.fullName || targetUnit.name}\n`;
    csvContent += `ภูมิภาค: ${targetUnit.region}, เบอร์โทรศัพท์: ${targetUnit.phone}\n`;
    csvContent += `ช่วงเวลาที่เลือก: ${timeLabels[timeRange] || 'ทั้งหมด'}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n\n`;
    csvContent += "ครั้งที่,วันที่ตรวจ,คะแนนที่ได้(%),เกณฑ์ผ่าน(85%),ผู้ตรวจประเมิน,ผลการประเมิน\n";
    
    let history = targetUnit.history;
    if (timeRange === "1M") history = history.slice(0, 1);
    else if (timeRange === "3M") history = history.slice(0, 2);
    else if (timeRange === "6M") history = history.slice(0, 3);

    history.forEach((h, i) => {
      const isPassed = h.score >= 90 ? "ดีเยี่ยม" : h.score >= 85 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์";
      csvContent += `"${i + 1}","${h.date}","${h.score}","85%","${h.auditor || 'สมชาย ใจดี'}","${isPassed}"\n`;
    });
  } else if (mode === "detailed_questions" && targetUnit) {
    let targetHistoryItem = targetUnit.history[0];
    if (timeRange.startsWith("round_")) {
      const roundIdx = parseInt(timeRange.replace("round_", ""), 10);
      if (targetUnit.history[roundIdx]) targetHistoryItem = targetUnit.history[roundIdx];
    }

    filename = `QSC_${targetUnit.name}_Questions_${targetHistoryItem?.date || timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    csvContent += `รายงานผลการตอบแบบฟอร์มการตรวจรายข้อแบบละเอียด: ${targetUnit.fullName || targetUnit.name}\n`;
    csvContent += `ภูมิภาค: ${targetUnit.region}, เบอร์โทรศัพท์: ${targetUnit.phone}\n`;
    csvContent += `รอบการตรวจ: ${targetHistoryItem?.date || 'ล่าสุด'}, คะแนนประเมิน: ${targetHistoryItem?.score || targetUnit.lastScore}% (${(targetHistoryItem?.score || targetUnit.lastScore) >= 85 ? 'ผ่านเกณฑ์' : 'ต่ำกว่าเกณฑ์'})\n`;
    csvContent += `ผู้ตรวจประเมิน: ${targetHistoryItem?.auditor || 'สมชาย ใจดี'}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n\n`;
    csvContent += "ลำดับ,หมวดหมู่,หัวข้อคำถาม,ประเภทคำตอบ,ผลการประเมิน,คะแนน/ระดับ,ความคิดเห็นและบันทึกผู้ตรวจ,รูปถ่ายหลักฐานหน้างาน,สถานะงานแก้ไข(CAP),สิ่งที่สาขาแก้ไขหน้างาน,วันที่ส่งมอบงานแก้ไข\n";

    const questionsList = [
      { num: 1, cat: "1. ความสะอาดและสุขอนามัย", text: "พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน", type: "yesno", pass: targetUnit.lastScore >= 85, note: targetUnit.lastScore >= 85 ? "ทำความสะอาดเรียบร้อย" : "พบคราบไขมันสะสมบริเวณพื้นหลังเตาปรุงอาหาร", photo: targetUnit.lastScore < 85 ? "มีรูปแนบ 1 รูป" : "ไม่มี", capStatus: targetUnit.lastScore < 85 ? "ส่งหลักฐานแก้ไขแล้ว (รออนุมัติ)" : "ไม่ต้องแก้ไข", capAction: targetUnit.lastScore < 85 ? "ขัดล้างทำความสะอาดคราบไขมันหลังเตาเรียบร้อยแล้ว" : "-", capDate: targetUnit.lastScore < 85 ? "18 ส.ค. 69 11:30 น." : "-" },
      { num: 2, cat: "1. ความสะอาดและสุขอนามัย", text: "พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน", type: "yesno", pass: targetUnit.lastScore >= 60, note: targetUnit.lastScore >= 60 ? "แต่งกายถูกต้องตาม SOP" : "พบพนักงาน 1 คนลืมสวมหมวกคลุมผม", photo: "ไม่มี", capStatus: targetUnit.lastScore < 60 ? "ส่งหลักฐานแก้ไขแล้ว" : "ไม่ต้องแก้ไข", capAction: targetUnit.lastScore < 60 ? "ตักเตือนและเปลี่ยนพนักงานปฏิบัติงาน" : "-", capDate: "-" },
      { num: 3, cat: "1. ความสะอาดและสุขอนามัย", text: "ความสะอาดของห้องน้ำลูกค้าและอุปกรณ์ล้างมือ", type: "scale", pass: true, note: "มีสบู่ล้างมือและกระดาษเช็ดมือพร้อม พื้นแห้งสะอาด", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
      { num: 4, cat: "2. มาตรฐานการบริการและความเร็ว", text: "พนักงานกล่าวทักทายและต้อนรับลูกค้าภายใน 5 วินาที", type: "yesno", pass: true, note: "พนักงานกล่าวต้อนรับสุภาพและยิ้มแย้ม", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
      { num: 5, cat: "2. มาตรฐานการบริการและความเร็ว", text: "ความรวดเร็วและถูกต้องในการส่งมอบออเดอร์", type: "scale", pass: true, note: "เวลาออกออเดอร์เฉลี่ย 2.4 นาที (เกณฑ์ ≤ 3 นาที)", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
      { num: 6, cat: "2. มาตรฐานการบริการและความเร็ว", text: "บันทึกคำชมเชยหรือข้อเสนอแนะด้านการบริการจากลูกค้า", type: "text", pass: true, note: "ลูกค้าประจำชื่นชมความรวดเร็วและรสชาติเครื่องดื่ม", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
      { num: 7, cat: "3. คุณภาพอาหารและความปลอดภัย", text: "อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C)", type: "yesno", pass: targetUnit.lastScore >= 75, note: targetUnit.lastScore < 75 ? "อุณหภูมิตู้แช่วัดได้ 5.8°C แจ้งเปลี่ยนซีลยางด่วน" : "อุณหภูมิวัดได้ 2.6°C ปกติ", photo: targetUnit.lastScore < 75 ? "มีรูปแนบ 1 รูป" : "ไม่มี", capStatus: targetUnit.lastScore < 75 ? "ส่งหลักฐานแก้ไขแล้ว (รออนุมัติ)" : "ไม่ต้องแก้ไข", capAction: targetUnit.lastScore < 75 ? "ช่างเข้าเปลี่ยนซีลยางและปรับน้ำยาทำความเย็นเรียบร้อย" : "-", capDate: targetUnit.lastScore < 75 ? "18 ส.ค. 69 13:00 น." : "-" },
      { num: 8, cat: "3. คุณภาพอาหารและความปลอดภัย", text: "ป้ายระบุวันหมดอายุ (Date label) ชัดเจนและถูกต้องตาม SOP", type: "yesno", pass: true, note: "ติดสติกเกอร์ FIFO ครบถ้วน", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
      { num: 9, cat: "3. คุณภาพอาหารและความปลอดภัย", text: "บันทึกอุณหภูมิน้ำมันทอดและการตรวจวัดค่า TPM", type: "text", pass: true, note: "อุณหภูมิน้ำมัน 175°C, ค่า TPM 14% ผ่านเกณฑ์", photo: "ไม่มี", capStatus: "ไม่ต้องแก้ไข", capAction: "-", capDate: "-" },
    ];

    questionsList.forEach((q) => {
      const passText = q.type === "scale" ? "ผ่าน (ได้ 4-5 ดาว)" : q.pass ? "ผ่าน (Pass)" : "ไม่ผ่าน (Fail)";
      csvContent += `"${q.num}","${q.cat}","${q.text}","${q.type}","${passText}","${q.pass ? '100%' : '0%'}","${q.note}","${q.photo}","${q.capStatus}","${q.capAction}","${q.capDate}"\n`;
    });
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
