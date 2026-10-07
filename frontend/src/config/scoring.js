/**
 * Pure scoring calculation functions for QSC System.
 * Matches backend `AuditScoring.cs` and `SectionRules.cs` 1:1.
 */

/**
 * ปัดเศษทศนิยม 2 ตำแหน่งตามมาตรฐานเดียวกับ backend
 */
export function round2(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * ตรวจสอบว่าข้อนี้คิดคะแนนหรือไม่
 */
export function isItemScored(item) {
  if (!item) return false;
  if (String(item.sectionType || '').toUpperCase() === 'INFO') return false;
  if (typeof item.isScored === 'boolean') {
    return item.isScored;
  }
  const full = Number(item.fullScore ?? item.maxScore ?? 0);
  if (full <= 0) return false;
  const qType = String(item.questionType || item.type || 'YESNO').trim().toUpperCase();
  if (qType !== 'YESNO' && qType !== 'SCALE') return false; // ตรงกับ SectionRules ฝั่ง server
  if (String(item.categoryCode || '').toUpperCase() === 'INFO') return false;
  if (item.categoryName === 'รายละเอียด' || item.categoryName === 'ข้อมูลทั่วไป') return false;
  return true;
}

/**
 * ดึงคำตอบในรูปแบบมาตรฐาน ('yes', 'no', 'na', '1'..'5' หรือ string ว่าง)
 */
export function extractAnswerValue(ans) {
  if (ans === null || ans === undefined) return '';
  if (typeof ans === 'object') {
    if (ans.isNa) return 'na';
    // ค่าคำตอบจริงที่เก็บไว้ (answerValue / rawAnswer) มาก่อนเสมอ
    if (ans.answerValue !== undefined && ans.answerValue !== null && String(ans.answerValue).trim() !== '') {
      return String(ans.answerValue).trim();
    }
    if (ans.rawAnswer !== undefined && ans.rawAnswer !== null && String(ans.rawAnswer).trim() !== '') {
      return String(ans.rawAnswer).trim();
    }
    if (ans.scaleScore !== undefined && ans.scaleScore !== null) return String(ans.scaleScore);
    // ไม่มีค่าคำตอบ: ใช้ isPassed ได้เฉพาะเมื่อเป็น boolean จริง (null = ยังไม่ตอบ)
    if (typeof ans.isPassed === 'boolean' && ans.userAnswered !== false && ans.type !== 'scale') {
      return ans.isPassed ? 'yes' : 'no';
    }
    return '';
  }
  return String(ans).trim();
}

/**
 * คำนวณคะแนนทั้งหมดและสรุปผล
 * @param {Array} items รายการคำถามทั้งหมด
 * @param {Object} answersMap ออบเจกต์เก็บคำตอบ key คือ item.id
 * @param {number} passingScore เกณฑ์คะแนนผ่าน (เช่น 85 หรือ 0)
 * @returns {Object} { totalScore, maxScore, percentage, isPassed, hasCriticalDefect, itemResults, categoryStats }
 */
export function computeScore(items = [], answersMap = {}, passingScore = 0) {
  let totalScore = 0;
  let maxScore = 0;
  let hasCriticalDefect = false;
  const itemResults = {};
  const categoryStats = {};

  for (const item of items) {
    if (!item) continue;
    const itemId = item.surveyItemId !== undefined && item.surveyItemId !== null ? item.surveyItemId : item.id;
    const scored = isItemScored(item);
    const full = Number(item.fullScore ?? item.maxScore ?? 0);
    const catCode = item.categoryCode || (scored ? 'GEN' : 'INFO');
    const catName = item.categoryName || item.sectionTitle || 'ทั่วไป';

    if (!categoryStats[catCode]) {
      categoryStats[catCode] = {
        code: catCode,
        name: catName,
        totalScore: 0,
        maxScore: 0,
        itemCount: 0,
        answeredCount: 0
      };
    }
    categoryStats[catCode].itemCount++;

    const rawVal = extractAnswerValue(answersMap[itemId]);

    if (!scored) {
      itemResults[itemId] = {
        scoreGiven: 0,
        maxScore: 0,
        isPassed: true,
        isNa: false,
        isScored: false,
        answerValue: rawVal
      };
      if (rawVal !== '') {
        categoryStats[catCode].answeredCount++;
      }
      continue;
    }

    // ข้อคิดคะแนน
    if (rawVal === '') {
      // ยังไม่ได้ตอบ
      itemResults[itemId] = {
        scoreGiven: 0,
        maxScore: full,
        isPassed: false,
        isNa: false,
        isScored: true,
        isUnanswered: true,
        answerValue: ''
      };
      continue;
    }

    categoryStats[catCode].answeredCount++;
    const lowerVal = rawVal.toLowerCase();
    const isNa = lowerVal === 'na' || lowerVal === 'skip' || lowerVal === 'ข้าม';
    let scoreGiven = 0;
    let isPassed = true;

    if (isNa) {
      scoreGiven = 0;
      isPassed = true;
      // N/A ไม่บวก maxScore
    } else if (String(item.questionType || '').toUpperCase() === 'SCALE') {
      const scaleNum = Number(rawVal);
      if (!isNaN(scaleNum) && scaleNum >= 1 && scaleNum <= 5) {
        scoreGiven = round2((scaleNum / 5.0) * full);
        isPassed = scaleNum >= 3;
        maxScore += full;
        totalScore += scoreGiven;
        categoryStats[catCode].maxScore += full;
        categoryStats[catCode].totalScore += scoreGiven;

        if (item.isCritical && !isPassed) {
          hasCriticalDefect = true;
        }
      } else {
        // ค่า scale ไม่ถูกต้อง: ไม่นับคะแนน และไม่ถือว่าผ่าน (server จะปฏิเสธค่านี้)
        itemResults[itemId] = {
          scoreGiven: 0,
          maxScore: full,
          isPassed: false,
          isNa: false,
          isScored: true,
          isInvalid: true,
          answerValue: rawVal
        };
        continue;
      }
    } else {
      // YESNO
      isPassed = lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1';
      scoreGiven = isPassed ? full : 0;
      maxScore += full;
      totalScore += scoreGiven;
      categoryStats[catCode].maxScore += full;
      categoryStats[catCode].totalScore += scoreGiven;

      if (item.isCritical && !isPassed) {
        hasCriticalDefect = true;
      }
    }

    itemResults[itemId] = {
      scoreGiven,
      maxScore: full,
      isPassed,
      isNa,
      isScored: true,
      answerValue: rawVal
    };
  }

  totalScore = round2(totalScore);
  maxScore = round2(maxScore);

  let percentage = 0;
  let isPassed = false;

  if (maxScore > 0) {
    percentage = round2((totalScore / maxScore) * 100);
    isPassed = percentage >= Number(passingScore || 0) && !hasCriticalDefect;
  }

  // คำนวณเปอร์เซ็นต์รายหมวด
  for (const cat of Object.values(categoryStats)) {
    cat.totalScore = round2(cat.totalScore);
    cat.maxScore = round2(cat.maxScore);
    cat.percentage = cat.maxScore > 0 ? round2((cat.totalScore / cat.maxScore) * 100) : 0;
  }

  return {
    totalScore,
    earned: totalScore,
    maxScore,
    max: maxScore,
    percentage,
    percent: percentage,
    isPassed,
    hasCriticalDefect,
    hasCritFail: hasCriticalDefect,
    itemResults,
    categoryStats
  };
}
