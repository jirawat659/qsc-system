// 🗜️ Client-side Image Compression & Validation Helper

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * ตรวจสอบความถูกต้องของไฟล์รูปภาพก่อนทำการบีบอัดหรือส่งเซิร์ฟเวอร์
 * @param {File} file
 * @param {number} maxSizeBytes
 * @param {string[]} allowedTypes
 * @returns {{ valid: boolean, message?: string }}
 */
export const validateImageFile = (file, maxSizeBytes = MAX_PHOTO_SIZE_BYTES, allowedTypes = ALLOWED_IMAGE_TYPES) => {
  if (!file) {
    return { valid: false, message: "ไม่พบไฟล์ที่เลือก" };
  }

  // ตรวจสอบนามสกุลหรือ MIME Type
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

  // ตรวจสอบขนาดไฟล์
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

export const compressImageFile = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

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

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
};
