import { PublicClientApplication } from '@azure/msal-browser';
import api from './api';

export const SSO_CALLBACK_PATH = '/sso/callback';

// ค่า tenant/client id ได้จาก backend (AuPortal:EntraTenantId / EntraClientId) — ไม่ต้องตั้ง VITE_ENTRA_* ซ้ำฝั่งนี้
let configPromise = null;
export function getSsoConfig() {
  if (!configPromise) {
    configPromise = api.get('/auth/sso/config')
      .then((r) => r.data)
      .catch((e) => { configPromise = null; throw e; });
  }
  return configPromise;
}

// MSAL จัดการ Authorization Code + PKCE + state + nonce ให้เอง
let msalPromise = null;
export function getMsal() {
  if (!msalPromise) {
    msalPromise = (async () => {
      const cfg = await getSsoConfig();
      if (!cfg.entraEnabled) throw new Error('entra_not_configured');
      const instance = new PublicClientApplication({
        auth: {
          clientId: cfg.clientId,
          authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
          redirectUri: `${window.location.origin}${SSO_CALLBACK_PATH}`, // ต้องลงทะเบียนเป็นชนิด SPA ใน App Registration กลาง
          navigateToLoginRequestUrl: false,                              // ให้ผลลัพธ์ถูกประมวลผลที่หน้า callback เลย
        },
        cache: { cacheLocation: 'sessionStorage' },                      // ไม่ใช้ localStorage
      });
      await instance.initialize();
      return instance;
    })().catch((e) => { msalPromise = null; throw e; });
  }
  return msalPromise;
}

export async function startEntraLogin() {
  const msal = await getMsal();
  await msal.loginRedirect({ scopes: ['openid', 'profile'] });
}
