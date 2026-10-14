using System.Text.Encodings.Web;
using System.Text.Json;

namespace QSC.Api.Helpers
{
    /// <summary>
    /// ตัวช่วยตั้งค่า JSON Serialization สากลสำหรับระบบ QSC
    /// กำหนดให้ไม่แปลงตัวอักษรภาษาไทยเป็น Unicode Escape (\u0E...)
    /// ทำให้บันทึกลงฐานข้อมูลและส่งออก API เป็นภาษาไทยที่อ่านรู้เรื่อง ค้นหาง่าย และประหยัดพื้นที่
    /// </summary>
    public static class JsonDefaults
    {
        public static readonly JsonSerializerOptions Options = new()
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            PropertyNameCaseInsensitive = true
        };

        public static string Serialize<T>(T value) =>
            JsonSerializer.Serialize(value, Options);

        public static T? Deserialize<T>(string json) =>
            JsonSerializer.Deserialize<T>(json, Options);
    }
}
