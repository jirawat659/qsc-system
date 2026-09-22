import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Navigation, ExternalLink, Loader2, X, Check, Compass, ZoomIn, ZoomOut } from "lucide-react";
import ModalWrapper from '../../../shared/ModalWrapper';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Normalize coordinates (handle Longitude/Latitude swap or missing decimals)
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

  // ── 🗺️ INITIALIZE INTERACTIVE LEAFLET MAP WITH CENTER PIN ──
  useEffect(() => {
    if (!showMapModal) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const initialLat = tempLat || 13.7466;
      const initialLng = tempLng || 100.5347;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false,
        dragging: true,
        tap: true,
        touchZoom: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // 📱 Prevent touch gestures on map from scrolling parent modal or page
      if (mapContainerRef.current) {
        L.DomEvent.disableScrollPropagation(mapContainerRef.current);
        L.DomEvent.disableClickPropagation(mapContainerRef.current);
      }

      // Track center coordinates in real-time as user moves/pans the map
      map.on('move', () => {
        const center = map.getCenter();
        setTempLat(parseFloat(center.lat.toFixed(6)));
        setTempLng(parseFloat(center.lng.toFixed(6)));
      });

      map.on('moveend', () => {
        const center = map.getCenter();
        setTempLat(parseFloat(center.lat.toFixed(6)));
        setTempLng(parseFloat(center.lng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMapModal]);

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
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1 });
        }
        if (showToast) showToast(`อัปเดตพิกัดสำเร็จ: (${lat}, ${lng})`);
        setSearching(false);
        return;
      }

      // Check 2: Google Maps URL with @lat,lng e.g. @13.7466,100.5347 or q=13.7466,100.5347
      const urlCoordMatch = q.match(/(@|q=)([-+]?\d{1,2}(?:\.\d+)?),([-+]?\d{1,3}(?:\.\d+)?)/);
      if (urlCoordMatch) {
        const { lat, lng } = sanitizeCoordinates(parseFloat(urlCoordMatch[2]), parseFloat(urlCoordMatch[3]));
        setTempLat(lat);
        setTempLng(lng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1 });
        }
        if (showToast) showToast(`สกัดพิกัดจาก Google Maps สำเร็จ: (${lat}, ${lng})`);
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

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
        }

        if (showToast) showToast(`เลื่อนหมุดไปยัง: ${data[0].name || q}`);
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
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1 });
        }
        setGpsLoading(false);
        if (showToast) showToast(`เลื่อนหมุดไปตำแหน่ง GPS ปัจจุบัน: (${lat}, ${lng})`);
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
    if (showToast) showToast(`บันทึกพิกัดแผนที่ (${lat}, ${lng}) เรียบร้อย`);
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
        </div>
        <textarea
          value={form.address || ''}
          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-normal text-slate-700 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs placeholder:text-slate-400"
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
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenMapModal}
          className="px-3 py-2 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
        >
          <Compass size={13} />
          <span>เลือก</span>
        </button>
      </div>

      {/* ── 🗺️ 3. INTERACTIVE POP-UP MAP MODAL WITH RED CENTER PIN ── */}
      {showMapModal && (
        <ModalWrapper onClose={() => setShowMapModal(false)} maxWidth="max-w-md sm:max-w-xl" zIndex={10050}>
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col max-h-[88dvh] overflow-y-auto overscroll-contain">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0">
                  <Compass size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                    ปักหมุดพิกัดแผนที่สาขา
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    เลื่อนแผนที่ให้หมุดสีแดงอยู่ตรงตำแหน่งที่ต้องการ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
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
                    className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-normal text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none shadow-2xs placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchLocation}
                  disabled={searching}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>ค้นหา</span>
                </button>
              </div>

              {/* Quick GPS Button & Open Maps */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleGetCurrentGps}
                  disabled={gpsLoading}
                  className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 min-h-[36px] sm:min-h-[38px] text-center"
                >
                  {gpsLoading ? <Loader2 size={13} className="animate-spin shrink-0" /> : <Navigation size={13} className="shrink-0" />}
                  <span className="truncate">ใช้<span className="hidden sm:inline">ตำแหน่ง</span> GPS ปัจจุบัน</span>
                </button>

                <a
                  href={`https://www.google.com/maps?q=${tempLat},${tempLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 text-xs font-bold shadow-2xs cursor-pointer active:scale-95 transition-all min-h-[36px] sm:min-h-[38px] text-center"
                >
                  <ExternalLink size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">เปิด<span className="hidden sm:inline">ดูใน</span> Google Maps</span>
                </a>
              </div>
            </div>

            {/* 🔴 INTERACTIVE DRAGGABLE MAP WITH RED CENTER PIN MARKER */}
            <div
              className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-52 sm:h-72 shrink-0 touch-none select-none"
              style={{ touchAction: 'none' }}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Leaflet Map Canvas */}
              <div
                ref={mapContainerRef}
                className="w-full h-full z-0 cursor-grab active:cursor-grabbing touch-none select-none"
                style={{ touchAction: 'none' }}
                onTouchMove={(e) => e.stopPropagation()}
              />

              {/* 🎯 FIXED RED CENTER PIN MARKER (จุดปักหมุดแดงตรงกลางจอ) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[1000] pointer-events-none flex flex-col items-center select-none">
                <div className="bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md mb-1 whitespace-nowrap">
                  📍 ตำแหน่งที่ปักหมุด
                </div>
                <div className="relative flex flex-col items-center">
                  <MapPin size={38} className="text-red-500 fill-red-500 drop-shadow-lg -mb-1" />
                  {/* Pin Base Shadow / Target Dot */}
                  <div className="w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white shadow-md animate-ping" />
                </div>
              </div>

              {/* Map Zoom Controls */}
              <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-[1000] flex flex-col gap-1 shadow-md rounded-xl overflow-hidden bg-white/90 backdrop-blur-xs border border-slate-200">
                <button
                  type="button"
                  onClick={() => mapInstanceRef.current?.zoomIn()}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 text-slate-700 font-bold transition-colors cursor-pointer border-b border-slate-100"
                  title="ขยายแผนที่"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => mapInstanceRef.current?.zoomOut()}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 text-slate-700 font-bold transition-colors cursor-pointer"
                  title="ย่อแผนที่"
                >
                  <ZoomOut size={14} />
                </button>
              </div>

              {/* Hint badge at top of map */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-xs px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-slate-200/80 text-[10px] sm:text-[11px] font-semibold text-slate-600 shadow-xs pointer-events-none">
                เลื่อนแผนที่เพื่อปรับจุดปักหมุด
              </div>
            </div>

            {/* Latitude & Longitude Real-Time Display */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] sm:text-xs font-bold text-slate-700">พิกัดปัจจุบันที่กึ่งกลาง:</span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-[#0F6659]">
                {tempLat.toFixed(6)}, {tempLng.toFixed(6)}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex gap-2.5 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100 shrink-0 bg-white sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="flex-1 py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs sm:text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="flex-1 py-2.5 sm:py-3 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-xs sm:text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-1.5"
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
