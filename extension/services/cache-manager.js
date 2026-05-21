// SC Analytics Platform — Cache Manager
// In-memory + chrome.storage cache with TTL support

const memCache = new Map();

export const CacheManager = {
  async get(key) {
    const mem = memCache.get(key);
    if (mem && Date.now() < mem.expires) return mem.value;
    const stored = await chrome.storage.local.get('cache_' + key);
    const entry = stored['cache_' + key];
    if (entry && Date.now() < entry.expires) { memCache.set(key, entry); return entry.value; }
    return null;
  },

  async set(key, value, ttlMs = 60000) {
    const entry = { value, expires: Date.now() + ttlMs };
    memCache.set(key, entry);
    await chrome.storage.local.set({ ['cache_' + key]: entry });
  },

  async delete(key) {
    memCache.delete(key);
    await chrome.storage.local.remove('cache_' + key);
  },

  async clear() {
    memCache.clear();
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter(k => k.startsWith('cache_'));
    await chrome.storage.local.remove(cacheKeys);
  }
};
