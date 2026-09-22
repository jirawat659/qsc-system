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

export const TARGET_MAX_PHOTO_SIZE_BYTES = 60 * 1024; // 60KB

/**
 * บีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลดให้มีขนาดไม่เกิน Target Size (ค่าเริ่มต้นไม่เกิน 60KB)
 * โดยเน้นเก็บภาพรวมหลักฐานที่คมชัดพอดี และประหยัดพื้นที่จัดเก็บบนเครื่องเซิร์ฟเวอร์
 * @param {File} file
 * @param {number} maxWidth ความกว้างสูงสุดเริ่มต้น (ค่าเริ่มต้น 1024px)
 * @param {number} maxHeight ความสูงสูงสุดเริ่มต้น (ค่าเริ่มต้น 1024px)
 * @param {number} initialQuality คุณภาพเริ่มต้น (ค่าเริ่มต้น 0.7)
 * @param {number} maxTargetBytes ขนาดไฟล์เป้าหมายสูงสุด (ค่าเริ่มต้น 60KB)
 * @returns {Promise<string>} Base64 Data URL
 */
export const compressImageFile = (
  file,
  maxWidth = 1024,
  maxHeight = 1024,
  initialQuality = 0.7,
  maxTargetBytes = TARGET_MAX_PHOTO_SIZE_BYTES
) => {
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
        let width = img.width;
        let height = img.height;

        // คำนวณสเกลเริ่มต้นให้พอดีกับขอบเขต 1024x1024
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
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // ตรวจสอบฟอร์แมตที่เบราว์เซอร์รองรับ (WebP บีบอัดได้เล็กกว่า JPEG ที่ความชัดเท่ากัน)
        let format = "image/jpeg";
        try {
          if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) {
            format = "image/webp";
          }
        } catch (e) {
          format = "image/jpeg";
        }

        const getByteSize = (dataUrl) => {
          const base64Str = dataUrl.split(",")[1] || dataUrl;
          return Math.round((base64Str.length * 3) / 4);
        };

        // รอบที่ 1: บีบอัดด้วยค่าเริ่มต้น
        let quality = initialQuality;
        let dataUrl = canvas.toDataURL(format, quality);

        if (getByteSize(dataUrl) <= maxTargetBytes) {
          return resolve(dataUrl);
        }

        // รอบที่ 2: วนลดคุณภาพลงทีละนิด (ขั้นต่ำ 0.3)
        while (quality > 0.3 && getByteSize(dataUrl) > maxTargetBytes) {
          quality = Math.round((quality - 0.08) * 100) / 100;
          dataUrl = canvas.toDataURL(format, quality);
        }

        // รอบที่ 3: หากยังเกิน 60KB ให้ย่อขนาด Dimension ของ Canvas ลงทีละ 15%
        if (getByteSize(dataUrl) > maxTargetBytes) {
          let scale = 0.85;
          while (scale >= 0.4 && getByteSize(dataUrl) > maxTargetBytes) {
            const newW = Math.round(width * scale);
            const newH = Math.round(height * scale);
            canvas.width = newW;
            canvas.height = newH;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, newW, newH);
            ctx.drawImage(img, 0, 0, newW, newH);
            dataUrl = canvas.toDataURL(format, Math.max(quality, 0.45));
            scale -= 0.15;
          }
        }

        const finalSizeKb = (getByteSize(dataUrl) / 1024).toFixed(1);
        console.log(`🗜️ [ImageCompressor] ขนาดหลังบีบอัด: ${finalSizeKb} KB (Format: ${format}, Quality: ${quality}, ขนาด: ${canvas.width}x${canvas.height}px)`);

        resolve(dataUrl);
      };
    };
  });
};
