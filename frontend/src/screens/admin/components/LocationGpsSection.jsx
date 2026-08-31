import React, { useState } from 'react';
import { MapPin, Search, Navigation, ExternalLink, Loader2, X, Check, Compass } from 'lucide-react';
import ModalWrapper from '../../../shared/ModalWrapper';

export default function LocationGpsSection({
  form,
  setForm,
  showToast
}) {
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempLat, setTempLat] = useState(form.latitude || 13.7466);
  const [tempLng, setTempLng] = useState(form.longitude || 100.5347);
  const [tempAddress, setTempAddress] = useState(form.address || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Normalize / auto-correct coordinates (handle Longitude/Latitude swap or missing decimals)
  const sanitizeCoordinates = (rawLat, rawLng) => {
    let lat = typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat;
    let lng = typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng;

    if (isNaN(lat)) lat = 13.7466;
    if (isNaN(lng)) lng = 100.5347;

    // Handle missing decimal point e.g. 1005338416931322 -> 100.5338416931322
    if (Math.abs(lat) > 1000) {
      const s = lat.toString();
      lat = parseFloat(s.slice(0, 2) + '.' + s.slice(2));
    }
    if (Math.abs(lng) > 1000) {
      const s = lng.toString();
      lng = parseFloat(s.slice(0, 3) + '.' + s.slice(3));
    }

    // If swapped (In Thailand: Lat is 5-21, Lng is 97-106)
    if (lat > 50 && lng < 50) {
      const tmp = lat;
      lat = lng;
      lng = tmp;
    }

    return {
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6))
    };
  };

  const handleOpenMapModal = () => {
    const { lat, lng } = sanitizeCoordinates(form.latitude || 13.7466, form.longitude || 100.5347);
    setTempLat(lat);
    setTempLng(lng);
    setTempAddress(form.address || '');
    setSearchQuery('');
    setShowMapModal(true);
  };

  // ── 🔍 1. SEARCH / PARSE LOCATION (ชื่อสถานที่, ลิงก์ Google Maps, หรือตัวเลขพิกัด) ──
  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      if (showToast) showToast('กรุณากรอกชื่อสถานที่ ลิงก์ Google Maps หรือพิกัดที่ต้องการค้นหา', true);
      return;
    }

    setSearching(true);
    try {
      // Check 1: Direct Coordinates e.g. "13.7466, 100.5347"
      const directCoordMatch = q.match(/([-+]?\d{1,2}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)/);
      if (directCoordMatch) {
        const { lat, lng } = sanitizeCoordinates(parseFloat(directCoordMatch[1]), parseFloat(directCoordMatch[2]));
        setTempLat(lat);
        setTempLng(lng);
        if (showToast) showToast(`✓ อัปเดตพิกัดสำเร็จ: (${lat}, ${lng})`);
        setSearching(false);
        return;
      }

      // Check 2: Google Maps URL with @lat,lng e.g. @13.7466,100.5347 or q=13.7466,100.5347
      const urlCoordMatch = q.match(/(@|q=)([-+]?\d{1,2}(?:\.\d+)?),([-+]?\d{1,3}(?:\.\d+)?)/);
      if (urlCoordMatch) {
        const { lat, lng } = sanitizeCoordinates(parseFloat(urlCoordMatch[2]), parseFloat(urlCoordMatch[3]));
        setTempLat(lat);
        setTempLng(lng);
        if (showToast) showToast(`✓ สกัดพิกัดจาก Google Maps สำเร็จ: (${lat}, ${lng})`);
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

        const { lat, lng } = sanitizeCoordinates(foundLat, foundLng);
        setTempLat(lat);
        setTempLng(lng);
        if (!tempAddress) {
          setTempAddress(foundAddress);
        }

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

  // ── 📍 2. GET CURRENT GPS LOCATION ──
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      if (showToast) showToast('อุปกรณ์ของคุณไม่รองรับการดึงพิกัด GPS', true);
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { lat, lng } = sanitizeCoordinates(pos.coords.latitude, pos.coords.longitude);
        setTempLat(lat);
        setTempLng(lng);
        setGpsLoading(false);
        if (showToast) showToast(`✓ ดึงตำแหน่ง GPS ปัจจุบันสำเร็จ: (${lat}, ${lng})`);
      },
      (err) => {
        setGpsLoading(false);
        if (showToast) showToast('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาเปิดการอนุญาต Location บนเบราว์เซอร์', true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── ✅ 3. CONFIRM & SAVE PIN LOCATION ──
  const handleConfirmLocation = () => {
    const { lat, lng } = sanitizeCoordinates(tempLat, tempLng);
    setForm(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: prev.address ? prev.address : tempAddress
    }));
    setShowMapModal(false);
    if (showToast) showToast(`✓ บันทึกพิกัดแผนที่ (${lat}, ${lng}) เรียบร้อย`);
  };

  const currentLat = form.latitude ? parseFloat(form.latitude).toFixed(5) : '13.74660';
  const currentLng = form.longitude ? parseFloat(form.longitude).toFixed(5) : '100.53470';

  return (
    <div className="space-y-3 pt-1">
      {/* 1. Address Text Field */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-600">
            ที่อยู่สถานที่ (Address)
          </label>
          <button
            type="button"
            onClick={handleOpenMapModal}
            className="text-xs text-[#0F6659] hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Compass size={13} />
            <span>ปักหมุดแผนที่ / GPS</span>
          </button>
        </div>
        <textarea
          value={form.address || ''}
          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-700 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs placeholder:text-slate-400"
          placeholder="เช่น ชั้น G โซน Veranda ถ.เจริญนคร แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ 10600"
        />
      </div>

      {/* 2. Compact GPS Status Pill with Open Map Button */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">
              พิกัด GPS: <span className="font-mono text-emerald-800 font-semibold">{currentLat}, {currentLng}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              ใช้สำหรับตรวจสอบระยะทางตอนผู้ตรวจลงตรวจหน้างาน
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenMapModal}
          className="px-3 py-2 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
        >
          <Compass size={13} />
          <span>ปักหมุด</span>
        </button>
      </div>

      {/* ── 🗺️ 3. INTERACTIVE POP-UP MAP MODAL ── */}
      {showMapModal && (
        <ModalWrapper onClose={() => setShowMapModal(false)} maxWidth="max-w-md sm:max-w-xl">
          <div className="p-5 sm:p-6 space-y-4 flex flex-col max-h-[88vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Compass size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                    ปักหมุดพิกัดแผนที่สาขา
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ค้นหาชื่อสถานที่ หรือดึงพิกัดจาก GPS เครื่อง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Box & Current GPS Button */}
            <div className="space-y-2 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLocation(); } }}
                    placeholder="พิมพ์ชื่อสถานที่, วางลิงก์ Google Maps, หรือพิกัด..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-normal text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none shadow-2xs placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchLocation}
                  disabled={searching}
                  className="px-4 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>ค้นหา</span>
                </button>
              </div>

              {/* Quick GPS Button */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={handleGetCurrentGps}
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                  <span>ใช้ตำแหน่ง GPS ปัจจุบันของฉัน</span>
                </button>

                <a
                  href={`https://www.google.com/maps?q=${tempLat},${tempLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-slate-500 hover:text-[#0F6659] flex items-center gap-1"
                >
                  <span>เปิด Google Maps เต็มจอ</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>

            {/* Live Interactive Map Iframe */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-56 sm:h-64 shrink-0">
              <iframe
                title="Pop-up Map Pin Preview"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${tempLat},${tempLng}&hl=th&z=16&output=embed`}
                className="w-full h-full block"
              />
            </div>

            {/* Latitude & Longitude Manual Control */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ละติจูด (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={tempLat}
                  onChange={(e) => setTempLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  ลองติจูด (Longitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={tempLng}
                  onChange={(e) => setTempLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none shadow-2xs"
                />
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="flex-1 py-3 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>ยืนยันพิกัดนี้</span>
              </button>
            </div>

          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
