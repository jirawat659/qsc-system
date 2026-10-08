// 🗜️ Client-side Image Compression & Validation Helper (Optimized for Text Clarity)

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
// 🛑 ด่าน 1: ขนาดไฟล์ต้นฉบับก่อนบีบอัด (รูปจากมือถือรุ่นใหม่ใหญ่ได้ถึงหลายสิบ MB จึงตั้งไว้ 25MB)
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// 🛑 ด่าน 2: เพดานไฟล์หลังบีบอัด 90KB (server จำกัด 100KB เผื่อไว้ให้)
export const TARGET_MAX_PHOTO_SIZE_BYTES = 90 * 1024;

// ด้านที่สั้นที่สุดที่ยอมลดลงไปได้ ถ้าบีบแล้วยังไม่ถึงเพดาน (ยังอ่านตัวหนังสือได้)
const MIN_LONG_SIDE = 640;

/**
 * เบราว์เซอร์นี้เข้ารหัส WebP จาก canvas ได้จริงหรือไม่
 * (Safari / iPhone เข้ารหัสไม่ได้ และจะคืนเป็น PNG ขนาดใหญ่แทนโดยไม่แจ้ง)
 */
const SUPPORTS_WEBP_ENCODE = (() => {
  try {
    if (typeof document === 'undefined') return false;
    return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
})();

/** ขนาดจริง (ไบต์) ของข้อมูลใน data URL แบบ base64 */
const bytesOf = (dataUrl) => {
  const b64 = dataUrl.split(',')[1] || '';
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
};

/**
 * ตรวจสอบความถูกต้องของไฟล์รูปภาพก่อนทำการบีบอัดหรือส่งเซิร์ฟเวอร์
 */
export const validateImageFile = (file, maxSizeBytes = MAX_PHOTO_SIZE_BYTES, allowedTypes = ALLOWED_IMAGE_TYPES) => {
  if (!file) {
    return { valid: false, message: "ไม่พบไฟล์ที่เลือก" };
  }

  const fileType = (file.type || "").toLowerCase();
  const fileName = (file.name || "").toLowerCase();
  const hasValidExt = /\.(jpg|jpeg|png|webp)$/i.test(fileName);
  const hasValidMime = allowedTypes.includes(fileType);

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      message: "รองรับเฉพาะไฟล์รูปภาพนามสกุล .jpg, .png, .webp เท่านั้น"
    };
  }

  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    const currentMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      message: `ขนาดไฟล์ใหญ่เกินไป (${currentMb}MB) ต้องไม่เกิน ${maxMb}MB`
    };
  }

  return { valid: true };
};

/**
 * บีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลด
 * - ย่อด้านยาวไม่เกิน maxWidth/maxHeight (ค่าเริ่มต้น 1200px) พร้อมรักษาสัดส่วน
 * - ใช้ WebP ถ้าเบราว์เซอร์เข้ารหัสได้ ไม่เช่นนั้นใช้ JPEG (เช่น Safari / iPhone)
 * - ถ้ายังเกินเพดาน: ลดคุณภาพก่อน แล้วค่อยลดขนาดภาพลงทีละ 15% จนผ่านเพดาน
 * - ถ้าบีบจนสุดแล้วยังเกิน จะ reject พร้อมข้อความที่อ่านรู้เรื่อง (ไม่ส่งไฟล์ใหญ่ออกไป)
 * @param {File} file
 * @param {number} maxWidth ความกว้างสูงสุด (ค่าเริ่มต้น 1200px)
 * @param {number} maxHeight ความสูงสูงสุด (ค่าเริ่มต้น 1200px)
 * @param {number} initialQuality คุณภาพเริ่มต้น (ค่าเริ่มต้น 0.65)
 * @param {number} maxTargetBytes เพดานขนาดไฟล์สูงสุด (ค่าเริ่มต้น 90KB)
 * @returns {Promise<string>} Base64 Data URL (WebP หรือ JPEG)
 */
export const compressImageFile = (
  file,
  maxWidth = 1200,
  maxHeight = 1200,
  initialQuality = 0.65,
  maxTargetBytes = TARGET_MAX_PHOTO_SIZE_BYTES
) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }

    // ใช้ URL.createObjectURL เพื่อประหยัดหน่วยความจำ (RAM) แทนการอ่าน Base64 เข้ามาตรงๆ
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("อ่านไฟล์รูปภาพไม่ได้ กรุณาเลือกรูปใหม่"));
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // คืนทรัพยากรหน่วยความจำทันทีหลังโหลดภาพเสร็จ

      let width = img.width;
      let height = img.height;

      // ล็อกด้านที่ยาวที่สุดไม่ให้เกิน 1200px พร้อมรักษาสัดส่วนภาพเดิม
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const format = SUPPORTS_WEBP_ENCODE ? "image/webp" : "image/jpeg";
      const qualities = [initialQuality, 0.5, 0.38];

      let w = width;
      let h = height;

      for (let attempt = 0; attempt < 8; attempt++) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        // ภาพคมชัด ป้องกันเส้นขอบฟอนต์แตกหรือขาด
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // เติมพื้นหลังสีขาว (รองรับ PNG โปร่งแสง และ JPEG ที่ไม่มีช่องโปร่งใส)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        for (const q of qualities) {
          const dataUrl = canvas.toDataURL(format, q);

          // ตรวจว่าเบราว์เซอร์ให้ฟอร์แมตที่ขอจริง (ไม่ใช่ PNG ที่ถูกสลับให้เงียบๆ)
          if (!dataUrl.startsWith(`data:${format}`)) {
            return reject(new Error("เบราว์เซอร์นี้บีบอัดรูปภาพไม่ได้ กรุณาลองใช้เบราว์เซอร์อื่น"));
          }

          const size = bytesOf(dataUrl);
          if (size <= maxTargetBytes) {
            console.log(
              `🗜️ [ImageCompressor] ${(size / 1024).toFixed(1)} KB ` +
              `(Format: ${format}, Quality: ${q}, ขนาด: ${w}x${h}px)`
            );
            return resolve(dataUrl);
          }
        }

        // ยังใหญ่เกินเพดาน → ลดขนาดด้านยาวลง 15% แล้วลองใหม่ (หยุดเมื่อเล็กจนอ่านยาก)
        if (Math.max(w, h) <= MIN_LONG_SIDE) break;
        w = Math.max(1, Math.round(w * 0.85));
        h = Math.max(1, Math.round(h * 0.85));
      }

      reject(new Error(
        `บีบอัดรูปให้ไม่เกิน ${Math.round(maxTargetBytes / 1024)}KB ไม่ได้ กรุณาถ่ายรูปใหม่ในที่ที่สว่างขึ้น`
      ));
    };
  });
};