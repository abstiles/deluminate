import {Settings, SiteSettings} from "./utils.js";

export const DEFAULT_SCHEME = "delumine-smart";
const storeCache = {};
let settings = new Settings();
let storageFetched = false;

let migrationTask;
async function migrateFromLocalStorage() {
  const {migrationComplete} = await chrome.storage.local.get(['migrationComplete']);
  if (migrationComplete >= 2) {
    return;
  }
  if (migrationTask) {
    await migrationTask;
    return;
  }
  migrationTask = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: 'migrate.html',
        reasons: ['LOCAL_STORAGE'],
        justification: 'migrating local storage to cloud sync storage',
      });
    } catch {}
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'migrate',
    });
    if (result.hasOwnProperty('localStorage')) {
      Object.assign(storeCache, migrateV1toV2(result.localStorage));
      settings = Settings.import(storeCache?.sites);
      chrome.storage.local.set({migrationComplete: 2});
    }
  })();
  await migrationTask;
  migrationTask = null;
}

function parseSiteMods(sitemods) {
  // Perplexingly, I seem to have implemented settingsV1 sitemodifiers in two
  // different ways: either a whitespace-delimited string or an object with
  // key: true pairs.
  try {
    return sitemods.split(" ");
  } catch {}
  try {
    return Object.keys(sitemods);
  } catch {}
  return [];
}

function migrateV1toV2(v1) {
  const toBool = (str) => str !== "false" && Boolean(str);
  const v2 = {version: 2, enabled: toBool(v1?.enabled)};
  const settings = new Settings();
  const defaultFilter = (v1?.scheme ?? DEFAULT_SCHEME)
    .split("-").slice(1).join("-") || "normal"
    ;
  const schemeToFilter = (scheme) =>
    (scheme ?? `filter-${defaultFilter}`)
    .split("-").slice(1).join("-") || "normal"
    ;
  const defaultMods = [];
  if (toBool(v1?.low_contrast)) {
    defaultMods.push("low_contrast");
  }
  if (toBool(v1?.kill_background)) {
    defaultMods.push("killbg");
  }
  if (toBool(v1?.force_text)) {
    defaultMods.push("forceinput");
  }
  const defaultSettings = new SiteSettings(defaultFilter, defaultMods);
  settings.set_site_default(defaultSettings);

  const siteModifiers = JSON.parse(v1?.sitemodifiers ?? "{}");
  const siteSchemes = JSON.parse(v1?.siteschemes ?? "{}");
  const domains = new Set([
    ...Object.keys(siteModifiers),
    ...Object.keys(siteSchemes),
  ]);
  for (const domain of domains) {
    const siteSettings = new SiteSettings(
      schemeToFilter(siteSchemes[domain]),
      parseSiteMods(siteModifiers[domain]).map(mod => ({
        "low-contrast": "low_contrast",
        "kill_background": "killbg",
        "force_text": "forceinput",
      })[mod]),
    );
    settings.save(domain, siteSettings);
  }
  v2.sites = settings.export();
  console.log(`Settings V2: ${JSON.stringify(v2)}`);
  return v2;
}

export async function syncStore() {
  await migrateFromLocalStorage();
  return await refreshStore();
}

export async function refreshStore() {
  const items = await chrome.storage.sync.get();
  Object.assign(storeCache, items);
  settings = Settings.import(storeCache?.sites);
  storageFetched = true;
  return settings;
}

export function storeSet(key, value) {
  storeCache[key] = value;
  return chrome.storage.sync.set({[key]: value});
}

export function $(id) {
  return document.getElementById(id);
}

export function getEnabled() {
  return storeCache['enabled'];
}

export function setEnabled(enabled) {
  return storeSet('enabled', enabled);
}

export function getSiteSettings(site) {
  return settings.load(site);
}

export function setSiteSettings(site, siteSettings) {
  settings.save(site, siteSettings);
  storeCache.sites = settings.export();
  return storeSet("sites", storeCache.sites);
}

export async function resetSiteSchemes() {
  var siteSchemes = {};
  await chrome.storage.sync.remove(
    Object.keys(await chrome.storage.sync.get())
  );
  for (const key of Object.keys(storeCache)) {
    delete storeCache[key];
  }
}

export function siteFromUrl(url) {
  return new URL(url).hostname;
}

export function getGlobalSettings() {
  return storeCache['settings'] ?? {};
}

export function setGlobalSetting(key, value) {
  var globalSettings = getGlobalSettings();
  globalSettings[key] = value;
  return storeSet('settings', globalSettings);
}

export function getMatchingSite(site) {
  return settings.match(site);
}

export function setSiteScheme(site, scheme) {
  const siteSettings = settings.load(site);
  return setSiteSettings(site, new SiteSettings(scheme, siteSettings.mods));
}

export function setDefaultModifiers(modifiers) {
  const defaultSettings = settings.site_default();
  return setSiteSettings("", new SiteSettings(defaultSettings.filter, modifiers));
}

export function addSiteModifier(site, modifier) {
  const siteSettings = settings.load(site);
  const mods = siteSettings.mods.union(new Set([modifier]));
  const newSettings = new SiteSettings(siteSettings.filter, mods);
  return setSiteSettings(site, newSettings);
}

export function delSiteModifier(site, modifier) {
  const siteSettings = settings.load(site);
  const mods = siteSettings.mods.difference(new Set([modifier]));
  const newSettings = new SiteSettings(siteSettings.filter, mods);
  return setSiteSettings(site, newSettings);
}

export function changedFromDefault(site) {
  return !settings.site_default.equals(settings.load(site));
}

export function isDisallowedUrl(url) {
  if (url.indexOf('about') == 0) {
    return true;
  } else if (url.indexOf('chrome') == 0) {
    // Special case the "newtab" page, which this extension affects.
    if (siteFromUrl(url) == 'newtab')
      return false;
    else
      return true;
  }
  return false;
}
