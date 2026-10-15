const http = require('http');
const crypto = require('crypto');
const url = require('url');

const PORT = 5090;
const DEFAULT_ISSUER = 'https://au-identity.local/system';
const DEFAULT_AUDIENCE = 'QSC';
const DEFAULT_QSC_CALLBACK = 'http://localhost:2000/sso/callback';

console.log('🔄 กำลังสร้างกุญแจเข้ารหัส RSA (RS256)...');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const KEY_ID = 'mock-au-portal-key-' + Date.now();
const jwkExport = publicKey.export({ format: 'jwk' });
const jwk = {
  kty: jwkExport.kty,
  use: 'sig',
  alg: 'RS256',
  kid: KEY_ID,
  n: jwkExport.n,
  e: jwkExport.e,
};

console.log(`✅ RSA Key พร้อมใช้งาน (Key ID: ${KEY_ID})`);

// PDP Server State ที่สามารถปรับแต่งได้แบบ Real-time
let currentPdpConfig = {
  status: 200,
  roles: ['AUDITOR'],
  permissions: [
    'audit.start', 'audit.submit', 'audit.edit', 'audit.view',
    'dashboard.view', 'menu.dashboard', 'menu.audit', 'menu.schedules',
    'menu.cap', 'cap.approve', 'menu.analytics'
  ],
  branchCodes: ['ACW', 'EV-M10', 'EV-M4'],
  brandCodes: [], // ว่างไว้เพื่อให้ QSC ผูกแบรนด์จากสาขาให้อัตโนมัติ
};

function generateLaunchToken({
  sub = 'U001',
  oid = 'U001',
  name = 'QC3 Test',
  email = 'qc3@afteryou.co.th',
  iss = DEFAULT_ISSUER,
  aud = DEFAULT_AUDIENCE,
  expiresInSeconds = 300,
  isExpired = false,
  extraClaims = {},
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: KEY_ID,
  };

  const actualSub = sub || oid || 'U001';
  const payload = {
    iss: iss || DEFAULT_ISSUER,
    aud: aud || DEFAULT_AUDIENCE,
    sub: actualSub,
    oid: oid || actualSub,
    name: name,
    email: email,
    jti: crypto.randomUUID(),
    iat: isExpired ? now - 1000 : now,
    nbf: isExpired ? now - 1000 : now - 5,
    exp: isExpired ? now - 100 : now + Number(expiresInSeconds),
    ...extraClaims,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${b64Header}.${b64Payload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(privateKey).toString('base64url');

  return {
    token: `${unsignedToken}.${signature}`,
    header,
    payload,
  };
}

function renderPortalHtml() {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AU Single Sign-On Portal (Mock Server)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'IBM Plex Sans Thai', sans-serif; }
    code, pre, .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen pb-16">
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
          D
        </div>
        <div>
          <div class="text-base font-bold text-slate-900 leading-tight">Portal Doraemon</div>
          <div class="text-[11px] text-slate-500 font-medium">SSO Gateway</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          PDP Active (:5090)
        </span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-8">
    
    <!-- Quick Presets Bar -->
    <div class="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>⚡ เลือก Preset ทดสอบด่วน:</span>
        </span>
        <span class="text-[11px] text-slate-400">คลิกเพื่อเติมข้อมูล Token & สิทธิ์ PDP ทันที</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="applyPreset('u001')" class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1.5">
          <span>🟢</span> QC3 Test (U001 - ปกติ)
        </button>
        <button onclick="applyPreset('admin')" class="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold transition flex items-center gap-1.5">
          <span>🔵</span> Admin (admin - ทุกสาขา)
        </button>
        <button onclick="applyPreset('unlinked')" class="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition flex items-center gap-1.5">
          <span>🟠</span> ผู้ใช้ไม่มีใน DB (เทส 403)
        </button>
        <button onclick="applyPreset('expired')" class="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition flex items-center gap-1.5">
          <span>🔴</span> Token หมดอายุ
        </button>
        <button onclick="applyPreset('invalid_aud')" class="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold transition flex items-center gap-1.5">
          <span>⚠️</span> Audience ไม่ตรง
        </button>
        <button onclick="applyPreset('pdp_fail')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition flex items-center gap-1.5">
          <span>❌</span> PDP ล่ม (503)
        </button>
      </div>
    </div>

    <!-- Token & PDP Customizer Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      
      <!-- Editor Form (7 cols) -->
      <div class="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🛠 ปรับแต่งข้อมูล Token (JWT Claims)</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">แก้ไขค่าของ Claims ที่จะถูกเข้ารหัสลงใน Token RS256 ส่งไปยัง QSC</p>
          </div>
          <button onclick="resetToDefaults()" class="text-xs text-slate-500 hover:text-slate-800 font-semibold underline">
            รีเซ็ตค่าเริ่มต้น
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="font-bold text-slate-700 block mb-1">
              Subject (<code class="text-blue-600 font-mono">sub</code> / Username):
            </label>
            <input type="text" id="cfg-sub" value="U001" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
            <span class="text-[10px] text-slate-400">ใช้จับคู่กับ Username ใน QSC DB (เช่น U001, admin)</span>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              Object ID (<code class="text-blue-600 font-mono">oid</code>):
            </label>
            <input type="text" id="cfg-oid" value="U001" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
            <span class="text-[10px] text-slate-400">รหัส Entra OID หรือรหัสอ้างอิงของระบบ</span>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              ชื่อ-นามสกุล (<code class="text-blue-600 font-mono">name</code>):
            </label>
            <input type="text" id="cfg-name" value="QC3 Test" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              อีเมล (<code class="text-blue-600 font-mono">email</code>):
            </label>
            <input type="text" id="cfg-email" value="qc3@afteryou.co.th" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              Issuer (<code class="text-blue-600 font-mono">iss</code>):
            </label>
            <input type="text" id="cfg-iss" value="https://au-identity.local/system" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px] text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              Audience (<code class="text-blue-600 font-mono">aud</code>):
            </label>
            <input type="text" id="cfg-aud" value="QSC" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px] text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">
              อายุ Token (วินาที):
            </label>
            <input type="number" id="cfg-ttl" value="300" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none">
          </div>

          <div class="flex items-center pt-5">
            <label class="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" id="cfg-expired" class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300">
              <span class="text-xs font-bold text-rose-700">จำลอง Token หมดอายุ (Expired Token)</span>
            </label>
          </div>
        </div>

        <!-- PDP Section inside Form -->
        <div class="pt-4 border-t border-slate-100 space-y-4">
          <div>
            <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🎯 สิทธิ์จาก PDP (/api/pdp/my-grants)</span>
            </h4>
            <p class="text-[11px] text-slate-500">สิทธิ์และขอบเขตสาขา/แบรนด์ที่ PDP จะส่งมอบให้ QSC</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="font-bold text-slate-700 block mb-1">สถานะ PDP Response:</label>
              <select id="cfg-pdp-status" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="200">200 OK (ตอบสิทธิ์ปกติ)</option>
                <option value="401">401 Unauthorized (Token ไม่ผ่าน)</option>
                <option value="503">503 Service Unavailable (PDP ล่ม)</option>
                <option value="empty">200 OK แต่ไม่มีสิทธิ์ (Empty Grants)</option>
              </select>
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">สาขาที่ให้เข้าถึง (Branch Codes):</label>
              <input type="text" id="cfg-pdp-branches" value="ACW, EV-M10, EV-M4" placeholder="เช่น ACW, EV-M10 หรือ *" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="text-[10px] text-slate-400">ใส่รหัสสาขาคั่นด้วย comma หรือใส่ * สำหรับทุกสาขา</span>
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">แบรนด์ที่ให้เข้าถึง (Brand Codes):</label>
              <input type="text" id="cfg-pdp-brands" value="" placeholder="เว้นว่างไว้ = ตรวจหาแบรนด์จากสาขาอัตโนมัติ" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="text-[10px] text-emerald-600 font-medium">เว้นว่างไว้: QSC จะผูกแบรนด์ (AU, MK ฯลฯ) จากสาขาให้อัตโนมัติ</span>
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Roles (บทบาท เช่น AUDITOR, ADMIN):</label>
              <input type="text" id="cfg-pdp-roles" value="AUDITOR" placeholder="เช่น AUDITOR หรือ ADMIN" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="md:col-span-2">
              <label class="font-bold text-slate-700 block mb-1">Permissions (คั่นด้วย comma):</label>
              <input type="text" id="cfg-pdp-perms" value="audit.start, audit.submit, audit.edit, audit.view, dashboard.view, menu.dashboard, menu.audit, menu.schedules, menu.cap, cap.approve, menu.analytics" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span class="text-[10px] text-slate-400">เช่น audit.start, audit.submit, audit.edit, forms.manage, users.manage</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Live Preview & Launch Card (5 cols) -->
      <div class="lg:col-span-5 flex flex-col justify-between space-y-6">
        
        <!-- Live Payload Preview Box -->
        <div class="bg-slate-900 rounded-3xl p-5 shadow-xl text-white flex-1 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Live Payload Preview (JSON)
            </span>
            <span class="text-[10px] text-slate-400 font-mono">RS256</span>
          </div>
          <pre id="live-payload-view" class="flex-1 bg-slate-950 p-3 rounded-2xl text-[11px] font-mono text-emerald-300 overflow-auto max-h-72 border border-slate-800"></pre>
        </div>

        <!-- Launch Card -->
        <div class="bg-white rounded-3xl p-6 shadow-md border-2 border-[#0F6659]/40">
          <div class="mb-4">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">เป้าหมาย SSO</div>
            <div class="text-base font-black text-slate-900">Q.S.C. System (Port :2000)</div>
            <div class="text-xs text-slate-500 font-mono mt-0.5 break-all">${DEFAULT_QSC_CALLBACK}</div>
          </div>

          <div class="space-y-2">
            <button onclick="launchWithCustomConfig()" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] hover:from-[#0c5348] hover:to-[#116e5f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0F6659]/25 hover:shadow-xl transition cursor-pointer">
              <span>🚀 ยิง Token นี้เข้า QSC (SSO Launch)</span>
            </button>
            
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="inspectCurrentToken()" class="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                🔍 ตรวจสอบ Token เต็ม
              </button>
              <button onclick="copyRawToken()" class="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                📋 คัดลอก JWT Token
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Technical Specs Reference Box -->
    <div class="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>🛠 ข้อมูลทางเทคนิค (SSO Path B - AU Portal Gateway)</span>
        </h4>
        <span class="text-[11px] text-slate-400 font-mono">Port :5090</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div class="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
          <div class="text-slate-400 text-[11px] mb-1">JWKS Endpoint:</div>
          <a href="/api/auth/jwks" target="_blank" class="text-emerald-400 hover:underline break-all">http://localhost:5090/api/auth/jwks</a>
        </div>
        <div class="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
          <div class="text-slate-400 text-[11px] mb-1">PDP Grants Endpoint:</div>
          <span class="text-blue-400 break-all">GET /api/pdp/my-grants?subject={sub}&application=${DEFAULT_AUDIENCE}</span>
        </div>
      </div>
    </div>
  </main>

  <!-- Modal View Token -->
  <div id="modal-token" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <h3 class="text-base font-bold text-slate-900">🔍 ตรวจสอบโครงสร้าง Launch Token (JWT RS256)</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
      </div>
      <div class="space-y-3 text-xs">
        <div>
          <label class="font-bold text-slate-700">Decoded Payload Claims (JSON):</label>
          <pre id="token-payload-view" class="mt-1 p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-auto max-h-48"></pre>
        </div>
        <div>
          <label class="font-bold text-slate-700">Raw Signed JWT Token:</label>
          <textarea id="token-raw-view" readonly class="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] h-28 text-slate-600 break-all"></textarea>
        </div>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">ปิด</button>
        <button onclick="launchWithCustomConfig()" class="px-4 py-2 rounded-xl bg-[#0F6659] hover:bg-[#0c5348] text-white text-xs font-bold">ส่ง Token นี้ไปยัง QSC ทันที</button>
      </div>
    </div>
  </div>

  <script>
    const inputs = ['cfg-sub', 'cfg-oid', 'cfg-name', 'cfg-email', 'cfg-iss', 'cfg-aud', 'cfg-ttl', 'cfg-expired'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', updateLivePreview);
      el.addEventListener('change', updateLivePreview);
    });

    let currentGeneratedToken = null;

    function getFormValues() {
      return {
        sub: document.getElementById('cfg-sub').value.trim(),
        oid: document.getElementById('cfg-oid').value.trim(),
        name: document.getElementById('cfg-name').value.trim(),
        email: document.getElementById('cfg-email').value.trim(),
        iss: document.getElementById('cfg-iss').value.trim(),
        aud: document.getElementById('cfg-aud').value.trim(),
        expiresInSeconds: parseInt(document.getElementById('cfg-ttl').value, 10) || 300,
        isExpired: document.getElementById('cfg-expired').checked,
      };
    }

    function getPdpFormValues() {
      const perms = document.getElementById('cfg-pdp-perms').value.split(',').map(s => s.trim()).filter(Boolean);
      const branches = document.getElementById('cfg-pdp-branches').value.split(',').map(s => s.trim()).filter(Boolean);
      const brandVal = document.getElementById('cfg-pdp-brands').value.trim();
      const brands = brandVal ? brandVal.split(',').map(s => s.trim()).filter(Boolean) : [];
      const roles = document.getElementById('cfg-pdp-roles').value.split(',').map(s => s.trim()).filter(Boolean);
      return {
        status: document.getElementById('cfg-pdp-status').value,
        roles: roles.length > 0 ? roles : ['AUDITOR'],
        permissions: perms,
        branchCodes: branches,
        brandCodes: brands,
      };
    }

    async function syncPdpConfig() {
      const pdpData = getPdpFormValues();
      await fetch('/api/pdp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdpData),
      });
    }

    async function updateLivePreview() {
      const vals = getFormValues();
      try {
        const res = await fetch('/api/token/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vals),
        });
        const data = await res.json();
        currentGeneratedToken = data.token;
        document.getElementById('live-payload-view').textContent = JSON.stringify(data.payload, null, 2);
      } catch (err) {
        console.error('Error generating token preview', err);
      }
    }

    async function launchWithCustomConfig() {
      await syncPdpConfig();
      const vals = getFormValues();
      const res = await fetch('/api/token/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      const data = await res.json();
      const targetUrl = '${DEFAULT_QSC_CALLBACK}?token=' + encodeURIComponent(data.token);
      window.location.href = targetUrl;
    }

    async function inspectCurrentToken() {
      const vals = getFormValues();
      const res = await fetch('/api/token/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      const data = await res.json();
      currentGeneratedToken = data.token;
      document.getElementById('token-payload-view').textContent = JSON.stringify(data.payload, null, 2);
      document.getElementById('token-raw-view').value = data.token;
      document.getElementById('modal-token').classList.remove('hidden');
    }

    async function copyRawToken() {
      if (!currentGeneratedToken) {
        const vals = getFormValues();
        const res = await fetch('/api/token/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vals),
        });
        const data = await res.json();
        currentGeneratedToken = data.token;
      }
      navigator.clipboard.writeText(currentGeneratedToken).then(() => {
        alert('คัดลอก JWT Token เรียบร้อยแล้ว!');
      });
    }

    function closeModal() {
      document.getElementById('modal-token').classList.add('hidden');
    }

    function applyPreset(type) {
      if (type === 'u001') {
        document.getElementById('cfg-sub').value = 'U001';
        document.getElementById('cfg-oid').value = 'U001';
        document.getElementById('cfg-name').value = 'QC3 Test';
        document.getElementById('cfg-email').value = 'qc3@afteryou.co.th';
        document.getElementById('cfg-iss').value = 'https://au-identity.local/system';
        document.getElementById('cfg-aud').value = 'QSC';
        document.getElementById('cfg-ttl').value = '300';
        document.getElementById('cfg-expired').checked = false;
        document.getElementById('cfg-pdp-status').value = '200';
        document.getElementById('cfg-pdp-roles').value = 'AUDITOR';
        document.getElementById('cfg-pdp-branches').value = 'ACW, EV-M10, EV-M4';
        document.getElementById('cfg-pdp-brands').value = '';
        document.getElementById('cfg-pdp-perms').value = 'audit.start, audit.submit, audit.edit, audit.view, dashboard.view, menu.dashboard, menu.audit, menu.schedules, menu.cap, cap.approve, menu.analytics';
      } else if (type === 'admin') {
        document.getElementById('cfg-sub').value = 'admin';
        document.getElementById('cfg-oid').value = '4fdb527a-4289-4608-9768-b7ac9c32dc8d';
        document.getElementById('cfg-name').value = 'จิรวัฒน์ (Admin)';
        document.getElementById('cfg-email').value = 'admin@afteryou.co.th';
        document.getElementById('cfg-iss').value = 'https://au-identity.local/system';
        document.getElementById('cfg-aud').value = 'QSC';
        document.getElementById('cfg-ttl').value = '300';
        document.getElementById('cfg-expired').checked = false;
        document.getElementById('cfg-pdp-status').value = '200';
        document.getElementById('cfg-pdp-roles').value = 'ADMIN';
        document.getElementById('cfg-pdp-branches').value = '*';
        document.getElementById('cfg-pdp-brands').value = '';
        document.getElementById('cfg-pdp-perms').value = 'activity.view, audit.delete, audit.edit, audit.reopen, audit.start, audit.submit, cap.approve, cap.resolve, dashboard.executive, forms.manage, locations.manage, menu.admin, menu.analytics, menu.audit, menu.cap, menu.dashboard, menu.forms, menu.schedules, roles.manage, schedules.manage, users.manage';
      } else if (type === 'unlinked') {
        document.getElementById('cfg-sub').value = 'UNKNOWN_999';
        document.getElementById('cfg-oid').value = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        document.getElementById('cfg-name').value = 'ผู้ใช้ไม่มีในระบบ QSC';
        document.getElementById('cfg-email').value = 'unlinked@afteryou.co.th';
        document.getElementById('cfg-iss').value = 'https://au-identity.local/system';
        document.getElementById('cfg-aud').value = 'QSC';
        document.getElementById('cfg-ttl').value = '300';
        document.getElementById('cfg-expired').checked = false;
        document.getElementById('cfg-pdp-status').value = '200';
        document.getElementById('cfg-pdp-roles').value = 'AUDITOR';
        document.getElementById('cfg-pdp-branches').value = 'ACW';
        document.getElementById('cfg-pdp-brands').value = '';
        document.getElementById('cfg-pdp-perms').value = 'audit.view';
      } else if (type === 'expired') {
        document.getElementById('cfg-expired').checked = true;
      } else if (type === 'invalid_aud') {
        document.getElementById('cfg-aud').value = 'wrong-application-code';
      } else if (type === 'pdp_fail') {
        document.getElementById('cfg-pdp-status').value = '503';
      }
      updateLivePreview();
      syncPdpConfig();
    }

    function resetToDefaults() {
      applyPreset('u001');
    }

    // Initial load
    updateLivePreview();
    syncPdpConfig();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${method} ${pathname}`);

  if (pathname === '/api/auth/jwks' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ keys: [jwk] }));
  }

  if (pathname === '/api/pdp/config' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const cfg = JSON.parse(body || '{}');
        currentPdpConfig = {
          status: cfg.status ? (cfg.status === 'empty' ? 'empty' : parseInt(cfg.status, 10)) : 200,
          roles: cfg.roles && cfg.roles.length > 0 ? cfg.roles : ['AUDITOR'],
          permissions: cfg.permissions || ['audit.view', 'audit.create', 'dashboard.view'],
          branchCodes: cfg.branchCodes || ['ACW', 'ASP'],
          brandCodes: cfg.brandCodes || [],
        };
        console.log('  -> Updated PDP Config:', JSON.stringify(currentPdpConfig));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, config: currentPdpConfig }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/pdp/my-grants' && method === 'GET') {
    const subject = parsedUrl.query.subject;
    const application = parsedUrl.query.application;

    console.log(`  -> PDP Query: subject=${subject}, app=${application}, statusConfig=${currentPdpConfig.status}`);

    if (currentPdpConfig.status === 401) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized', message: 'Token invalid or expired' }));
    }

    if (currentPdpConfig.status === 503) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'service_unavailable', message: 'PDP database unreachable' }));
    }

    if (currentPdpConfig.status === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          subject: subject || 'U001',
          application: application || 'QSC',
          roles: [],
          grants: [],
          computedAt: new Date().toISOString()
        },
        error: null
      }));
    }

    const branchScopes = (currentPdpConfig.branchCodes || []).map(code => ({
      dimension: 'branch',
      code: code,
      name: `Branch ${code}`,
    }));

    const brandScopes = (currentPdpConfig.brandCodes || []).map(code => ({
      dimension: 'brand',
      code: code,
      name: `Brand ${code}`,
    }));

    const allScopes = [...branchScopes, ...brandScopes];

    const grants = (currentPdpConfig.permissions || []).map(p => {
      return {
        permission: p,
        scopes: allScopes,
        unscoped: allScopes.length === 0,
      };
    });

    const grantsResponse = {
      success: true,
      data: {
        subject: subject || 'U001',
        application: application || 'QSC',
        roles: currentPdpConfig.roles || ['AUDITOR'],
        grants: grants,
        computedAt: new Date().toISOString()
      },
      error: null
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(grantsResponse));
  }

  if (pathname === '/api/pdp/check' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ allowed: true, reason: 'Approved by Mock AU PDP' }));
  }

  if (pathname === '/api/token/generate' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const tokenResult = generateLaunchToken({
          sub: payload.sub,
          oid: payload.oid,
          name: payload.name,
          email: payload.email,
          iss: payload.iss,
          aud: payload.aud,
          expiresInSeconds: payload.expiresInSeconds,
          isExpired: !!payload.isExpired,
          extraClaims: payload.extraClaims || {},
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(tokenResult));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'bad_request', message: err.message }));
      }
    });
    return;
  }

  if (pathname === '/launch' && method === 'GET') {
    const queryId = parsedUrl.query.sub || parsedUrl.query.oid || 'U001';
    const tokenResult = generateLaunchToken({
      sub: queryId,
      oid: queryId,
    });
    const target = `${DEFAULT_QSC_CALLBACK}?token=${encodeURIComponent(tokenResult.token)}`;
    res.writeHead(302, { Location: target });
    return res.end();
  }

  if (pathname === '/' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderPortalHtml());
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌐 Mock AU Portal Server กำลังรันที่: http://localhost:${PORT}`);
  console.log(`🔑 JWKS Endpoint: http://localhost:${PORT}/api/auth/jwks`);
  console.log(`🎯 PDP Endpoint:  http://localhost:${PORT}/api/pdp/my-grants`);
  console.log(`🚀 เปิดเบราว์เซอร์ไปที่: http://localhost:${PORT} เพื่อทดสอบ`);
  console.log('====================================================');
});
