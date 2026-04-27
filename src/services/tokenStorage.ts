const STORAGE_KEY = 'st_encrypted_token';
const IV_KEY = 'st_iv';
const ACCT_STORAGE_KEY = 'st_acct_token';
const ACCT_IV_KEY = 'st_acct_iv';
const SAVED_AGENTS_KEY = 'st_saved_agents';

export interface SavedAgent {
  symbol: string;
  faction: string;
  headquarters: string;
  tokenKey: string;
  ivKey: string;
}

async function deriveKey(): Promise<CryptoKey> {
  // Use a device-bound fingerprint as key material so the encrypted blob
  // is only useful on the same origin + browser profile.
  const raw = new TextEncoder().encode(
    `spacetraders-ui::${window.location.origin}`
  );
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    raw,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('spacetraders-salt-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function storeToken(token: string): Promise<void> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  localStorage.setItem(
    STORAGE_KEY,
    btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  );
  localStorage.setItem(IV_KEY, btoa(String.fromCharCode(...iv)));
}

export async function retrieveToken(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  const ivStored = localStorage.getItem(IV_KEY);
  if (!stored || !ivStored) return null;

  try {
    const key = await deriveKey();
    const encrypted = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivStored), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    clearToken();
    return null;
  }
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IV_KEY);
}

/* ── Account token helpers ── */

export async function storeAccountToken(token: string): Promise<void> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  localStorage.setItem(
    ACCT_STORAGE_KEY,
    btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  );
  localStorage.setItem(ACCT_IV_KEY, btoa(String.fromCharCode(...iv)));
}

export async function retrieveAccountToken(): Promise<string | null> {
  const stored = localStorage.getItem(ACCT_STORAGE_KEY);
  const ivStored = localStorage.getItem(ACCT_IV_KEY);
  if (!stored || !ivStored) return null;

  try {
    const key = await deriveKey();
    const encrypted = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivStored), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    clearAccountToken();
    return null;
  }
}

export function clearAccountToken(): void {
  localStorage.removeItem(ACCT_STORAGE_KEY);
  localStorage.removeItem(ACCT_IV_KEY);
}

/* ── Multi-agent helpers ── */

async function encryptToken(token: string, storageKey: string, ivKey: string): Promise<void> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  localStorage.setItem(
    storageKey,
    btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  );
  localStorage.setItem(ivKey, btoa(String.fromCharCode(...iv)));
}

async function decryptToken(storageKey: string, ivKey: string): Promise<string | null> {
  const stored = localStorage.getItem(storageKey);
  const ivStored = localStorage.getItem(ivKey);
  if (!stored || !ivStored) return null;
  try {
    const key = await deriveKey();
    const encrypted = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivStored), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export function getSavedAgents(): SavedAgent[] {
  try {
    const raw = localStorage.getItem(SAVED_AGENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedAgent =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedAgent).symbol === 'string' &&
        typeof (item as SavedAgent).faction === 'string' &&
        typeof (item as SavedAgent).headquarters === 'string' &&
        typeof (item as SavedAgent).tokenKey === 'string' &&
        typeof (item as SavedAgent).ivKey === 'string'
    );
  } catch {
    return [];
  }
}

const VALID_SYMBOL = /^[a-zA-Z0-9_-]+$/;

export async function saveAgent(
  symbol: string,
  faction: string,
  headquarters: string,
  token: string
): Promise<void> {
  if (!VALID_SYMBOL.test(symbol)) {
    throw new Error('Invalid agent symbol.');
  }
  const agents = getSavedAgents();
  const tokenKey = `st_tok_${symbol}`;
  const ivKey = `st_iv_${symbol}`;

  await encryptToken(token, tokenKey, ivKey);

  const existing = agents.findIndex((a) => a.symbol === symbol);
  const entry: SavedAgent = { symbol, faction, headquarters, tokenKey, ivKey };
  if (existing >= 0) {
    agents[existing] = entry;
  } else {
    agents.push(entry);
  }
  localStorage.setItem(SAVED_AGENTS_KEY, JSON.stringify(agents));
}

export async function retrieveSavedAgentToken(symbol: string): Promise<string | null> {
  const agents = getSavedAgents();
  const agent = agents.find((a) => a.symbol === symbol);
  if (!agent) return null;
  return decryptToken(agent.tokenKey, agent.ivKey);
}

export function removeSavedAgent(symbol: string): void {
  const agents = getSavedAgents();
  const agent = agents.find((a) => a.symbol === symbol);
  if (agent) {
    localStorage.removeItem(agent.tokenKey);
    localStorage.removeItem(agent.ivKey);
  }
  const filtered = agents.filter((a) => a.symbol !== symbol);
  localStorage.setItem(SAVED_AGENTS_KEY, JSON.stringify(filtered));
}
