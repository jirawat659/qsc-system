import React, { useState } from 'react';
import { MapPin, Search, Navigation, ExternalLink, Loader2 } from 'lucide-react';

export default function LocationGpsSection({
  form,
  setForm,
  showToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const lat = form.latitude || 13.7466;
  const lng = form.longitude || 100.5347;

  // ── 🔍 1. PARSE / SEARCH LOCATION (ชื่อสถานที่, ลิงก์ Google Maps, หรือตัวเลขพิกัด) ──
  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      if (showToast) showToast('กรุณากรอกชื่อสถานที่ ลิงก์ Google Maps หรือพิกัดที่ต้องการค้นหา', true);
      return;
    }

    setSearching(true);
    try {
      // Check 1: Direct Coordinates e.g. "13.7466, 100.5347" or "13.7466,100.5347"
      const directCoordMatch = q.match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
      if (directCoordMatch) {
        const parsedLat = parseFloat(directCoordMatch[1]);
        const parsedLng = parseFloat(directCoordMatch[2]);
        setForm(prev => ({
          ...prev,
          latitude: parsedLat,
          longitude: parsedLng
        }));
        if (showToast) showToast(`✓ อัปเดตพิกัดสำเร็จ: (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`);
        setSearching(false);
        return;
      }

      // Check 2: Google Maps URL with @lat,lng e.g. @13.7466,100.5347 or q=13.7466,100.5347
      const urlCoordMatch = q.match(/(@|q=)([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
      if (urlCoordMatch) {
        const parsedLat = parseFloat(urlCoordMatch[2]);
        const parsedLng = parseFloat(urlCoordMatch[3]);
        setForm(prev => ({
          ...prev,
          latitude: parsedLat,
          longitude: parsedLng
        }));
        if (showToast) showToast(`✓ สกัดพิกัดจาก Google Maps สำเร็จ: (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`);
        setSearching(false);
        return;
      }

      // Check 3: Geocode via OpenStreetMap Nominatim API (Free Geocoding for Thailand)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=th&limit=1`, {
        headers: { 'Accept-Language': 'th, en' }
      });
      const data = await res.json();

      if (data && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        const foundAddress = data[0].display_name || '';

        setForm(prev => ({
          ...prev,
          latitude: foundLat,
          longitude: foundLng,
          address: prev.address ? prev.address : foundAddress
        }));

        if (showToast) showToast(`✓ ค้นพบตำแหน่ง: ${data[0].name || q}`);
      } else {
        if (showToast) showToast(`ไม่พบพิกัดของ "${q}" กรุณาลองระบุชื่ออาคาร/ถนนเพิ่มเติม`, true);
      }
    } catch (err) {
      if (showToast) showToast('การค้นหาพิกัดขัดข้อง กรุณาลองใหม่อีกครั้ง', true);
    } finally {
      setSearching(false);
    }
  };

  // ── 📍 2. GET DEVICE CURRENT GPS ──
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      if (showToast) showToast('อุปกรณ์ของคุณไม่รองรับการดึงพิกัด GPS', true);
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = parseFloat(pos.coords.latitude.toFixed(6));
        const currentLng = parseFloat(pos.coords.longitude.toFixed(6));
        setForm(prev => ({
          ...prev,
          latitude: currentLat,
          longitude: currentLng
        }));
        setGpsLoading(false);
        if (showToast) showToast(`✓ ดึงตำแหน่ง GPS ปัจจุบันสำเร็จ: (${currentLat}, ${currentLng})`);
      },
      (err) => {
        setGpsLoading(false);
        if (showToast) showToast('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาเปิดการอนุญาต Location บนเบราว์เซอร์', true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-3.5 pt-1">
      {/* 1. Address Text Field */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">
          ที่อยู่สถานที่ (Address)
        </label>
        <textarea
          value={form.address || ''}
          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-700 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs placeholder:text-slate-400"
          placeholder="เช่น ชั้น G โซน Veranda ถ.เจริญนคร แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ 10600"
        />
      </div>

      {/* 2. Map & GPS Control Box */}
      <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
              <MapPin size={17} />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">
                พิกัดแผนที่ (GPS Location)
              </div>
              <div className="text-[11px] text-slate-400">
                ใช้สำหรับตรวจจับระยะทางตอนผู้ตรวจลงตรวจหน้างาน
              </div>
            </div>
          </div>

          {/* Current GPS Button */}
          <button
            type="button"
            onClick={handleGetCurrentGps}
            disabled={gpsLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#0F6659] border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            {gpsLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Navigation size={13} />
            )}
            <span>ใช้พิกัดปัจจุบัน</span>
          </button>
        </div>

        {/* 3. Search / Parse Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLocation(); } }}
              placeholder="ค้นหาชื่อสถานที่ หรือ วางลิงก์ Google Maps / พิกัด..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-normal text-slate-700 focus:border-[#0F6659] outline-none shadow-2xs placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchLocation}
            disabled={searching}
            className="px-3.5 py-2 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            <span>ค้นหาพิกัด</span>
          </button>
        </div>

        {/* 4. Live Map Preview */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100 h-44 sm:h-48">
          <iframe
            title="Location Pin Map Preview"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${lat},${lng}&hl=th&z=16&output=embed`}
            className="w-full h-full block"
          />

          {/* External Google Maps Link Overlay Button */}
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-[#0F6659] border border-slate-200/80 text-[11px] font-bold shadow-xs flex items-center gap-1 transition-all backdrop-blur-xs"
          >
            <span>เปิด Google Maps</span>
            <ExternalLink size={10} />
          </a>
        </div>

        {/* 5. Direct Latitude & Longitude Inputs */}
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ละติจูด (Latitude)
            </label>
            <input
              type="number"
              step="any"
              value={form.latitude !== undefined && form.latitude !== null ? form.latitude : ''}
              onChange={(e) => setForm(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-mono text-slate-700 focus:border-[#0F6659] outline-none shadow-2xs"
              placeholder="13.7466"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ลองติจูด (Longitude)
            </label>
            <input
              type="number"
              step="any"
              value={form.longitude !== undefined && form.longitude !== null ? form.longitude : ''}
              onChange={(e) => setForm(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-mono text-slate-700 focus:border-[#0F6659] outline-none shadow-2xs"
              placeholder="100.5347"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
