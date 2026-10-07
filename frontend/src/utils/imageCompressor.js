// 🗜️ Client-side Image Compression & Validation Helper (Optimized for Text Clarity)

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 🛑 ด่าน 1: ขนาดไฟล์ต้นฉบับก่อนบีบอัดไม่เกิน 5MB
export const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// 🛑 ด่าน 2: เพดานไฟล์หลังบีบอัดไม่เกิน 90KB (ขนาดจริงส่วนใหญ่จะอยู่ที่ประมาณ 45KB - 65KB)
export const TARGET_MAX_PHOTO_SIZE_BYTES = 90 * 1024;

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
 * บีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลด (One-Pass Architecture)
 * ล็อกความละเอียดด้านยาวที่ 1200px เพื่อให้อ่านตัวหนังสือและเอกสารได้คมชัด
 * @param {File} file
 * @param {number} maxWidth ความกว้างสูงสุด (ค่าเริ่มต้น 1200px)
 * @param {number} maxHeight ความสูงสูงสุด (ค่าเริ่มต้น 1200px)
 * @param {number} initialQuality คุณภาพ WebP (ค่าเริ่มต้น 0.65)
 * @param {number} maxTargetBytes เพดานขนาดไฟล์สูงสุด (ค่าเริ่มต้น 100KB)
 * @returns {Promise<string>} Base64 Data URL (WebP)
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

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // คืนทรัพยากรหน่วยความจำทันทีหลังโหลดภาพเสร็จ

      let width = img.width;
      let height = img.height;

      // ล็อกด้านที่ยาวที่สุด (Max Dimension) ไม่ให้เกิน 1200px พร้อมรักษาสัดส่วนภาพเดิม
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

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // เพิ่มความคมชัดระดับสูง ป้องกันไม่ให้เส้นขอบฟอนต์แตกหรือขาด
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // เติมพื้นหลังสีขาวรองรับภาพ PNG โปร่งแสง
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // 🌟 บังคับแปลงและบันทึกเป็น WebP เท่านั้น
      let format = "image/webp";
      try {
        const testExport = canvas.toDataURL("image/webp");
        if (testExport && testExport.startsWith("data:image/webp")) {
          format = "image/webp";
        }
      } catch (e) {
        format = "image/webp";
      }

      const getByteSize = (dataUrl) => {
        const base64Str = dataUrl.split(",")[1] || dataUrl;
        return Math.round((base64Str.length * 3) / 4);
      };

      // รอบที่ 1: บีบอัดรอบเดียวจบด้วยค่ามาตรฐาน (Quality 0.65)
      let quality = initialQuality;
      let dataUrl = canvas.toDataURL(format, quality);

      // รอบที่ 2 (Safeguard): กรณีภาพมี Noise สูงจนเกิน 90KB ให้บีบซ้ำรอบเดียวที่ Quality 0.50
      // (ยังคงขนาด 1200px ไว้เพื่อให้อ่านตัวหนังสือออก ไม่ลดสเกล Canvas)
      if (getByteSize(dataUrl) > maxTargetBytes) {
        quality = 0.50;
        dataUrl = canvas.toDataURL(format, quality);
      }

      // รอบที่ 3 (Ultimate Safeguard): หากยังเกิน 90KB ปรับเป็น Quality 0.38
      if (getByteSize(dataUrl) > maxTargetBytes) {
        quality = 0.38;
        dataUrl = canvas.toDataURL(format, quality);
      }

      const finalSizeKb = (getByteSize(dataUrl) / 1024).toFixed(1);
      console.log(
        `🗜️ [ImageCompressor] ขนาดหลังบีบอัด: ${finalSizeKb} KB ` +
        `(Format: ${format}, Quality: ${quality}, ขนาด: ${canvas.width}x${canvas.height}px)`
      );

      resolve(dataUrl);
    };
  });
};
