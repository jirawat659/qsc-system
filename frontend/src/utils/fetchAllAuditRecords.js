import api from "../config/api";

/**
 * ดึงรอบตรวจ (พร้อมคำตอบรายข้อ) ให้ครบทุกหน้า สำหรับ Export
 * - หน้าแรกดึงเดี่ยวเพื่อรู้ totalCount แล้วดึงหน้าที่เหลือพร้อมกันครั้งละ `concurrency` หน้า (เดิมดึงทีละหน้าต่อกัน)
 * - เรียงผลตาม AuditDate/Id ที่ backend อยู่แล้ว การแบ่งหน้าจึงคงที่ ยกเว้นมีรอบตรวจใหม่ถูกส่งระหว่างที่กำลังดึง
 * - onProgress(doneCount, totalPages) ไว้แสดงความคืบหน้าบนปุ่ม
 */
export async function fetchAllAuditRecords(params = {}, { onProgress, concurrency = 4, pageSize = 100 } = {}) {
  const getPage = page =>
    api.get("/audit/records", { params: { ...params, page, pageSize, includeResponses: true } });

  const first = await getPage(1);
  const data = first.data;
  if (Array.isArray(data)) return data; // backend ส่งแบบไม่แบ่งหน้า

  const firstItems = data?.items || [];
  const totalCount = data?.totalCount ?? firstItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pages = new Array(totalPages);
  pages[0] = firstItems;
  let done = 1;
  onProgress?.(done, totalPages);

  let nextPage = 2;
  const worker = async () => {
    while (nextPage <= totalPages) {
      const p = nextPage++;
      const res = await getPage(p);
      pages[p - 1] = res.data?.items || [];
      onProgress?.(++done, totalPages);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, totalPages - 1) }, worker));

  return pages.flat();
}

export default fetchAllAuditRecords;