import {Settings, SiteSettings} from "./utils.js";

export const api = typeof chrome !== "undefined" ? chrome
  : typeof browser !== "undefined" ? browser
  : {};

export const DEFAULT_SCHEME = "delumine-smart";
const DEFAULT_FILTER = DEFAULT_SCHEME.split("-").slice(1).join("-");
const storeCache = {};
let settings = new Settings(DEFAULT_FILTER);

let migrationTask;
async function migrateFromLocalStorage() {
  const {migrationComplete} = await api.storage.local.get(['migrationComplete']);
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
    } catch {
      // Already created. That's fine, just send the message.
    }
    const [{value: remoteSettings}, {value: {localStorage}}] = await Promise
      .allSettled([
        api.storage.sync.get(),
        chrome.runtime.sendMessage({target: 'offscreen', action: 'migrate'}),
    ]);
    if (remoteSettings) {
      try {
        Object.assign(storeCache, remoteSettings);
        settings = Settings.import(storeCache?.sites, DEFAULT_FILTER);
      } catch (err) {
        console.log(`Error loading remote settings: ${JSON.stringify(err)}`);
      }
    }
    if (localStorage) {
      const {sites, ...otherSettings} = migrateV1toV2(localStorage);
      // Allow local settings to override remote settings.
      Object.assign(storeCache, otherSettings);
      // Merge local site settings with any existing ones.
      settings.import(sites);
      storeCache.sites = settings.export();
      // Publish the merged site settings.
      await storeSet("sites", storeCache.sites);
      api.storage.local.set({migrationComplete: 2});
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
  } catch { /* Not a string. */ }
  try {
    return Object.keys(sitemods);
  } catch { /* Not an object. */ }
  return [];
}

const toBool = (str) => str !== "false" && Boolean(str);

function migrateV1toV2(v1) {
  const v2 = {version: 2, enabled: toBool(v1?.enabled ?? true)};
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
  defaultMods.push("dynamic");
  const settings = new Settings(defaultFilter, defaultMods);

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
      })[mod]).filter(Boolean),
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
  const items = await api.storage.sync.get();
  Object.assign(storeCache, items);
  settings = Settings.import(storeCache?.sites, DEFAULT_FILTER);
  settings.import((await api.storage.local.get("sites"))["sites"] ?? []);
  return settings;
}

export function storeSet(key, value) {
  storeCache[key] = value;
  return api.storage.sync.set({[key]: value});
}

export function $(id) {
  return document.getElementById(id);
}

export function getEnabled() {
  return storeCache?.enabled ?? true;
}

export function setEnabled(enabled) {
  return storeSet('enabled', toBool(enabled));
}

export function getSiteSettings(site) {
  const siteSettings = settings.load(site);
  if (!siteSettings) {
    throw new Error(`Could not load settings for ${site}`);
  }
  return siteSettings;
}

export function setSiteSettings(site, siteSettings) {
  settings.save(site, siteSettings);
  storeCache.sites = settings.export();
  api.storage.local.set({sites: settings.exportLocal()});
  return storeSet("sites", storeCache.sites);
}

export async function delSiteSettings(site) {
  const {sites} = await api.storage.sync.get("sites");

  return await storeSet("sites", sites.filter(siteRow => siteRow[0] !== site));
}

export async function resetSiteSchemes() {
  await api.storage.sync.remove(
    Object.keys(await api.storage.sync.get())
  );
  for (const key of Object.keys(storeCache)) {
    delete storeCache[key];
  }
  settings = new Settings(DEFAULT_FILTER);
}

export function siteFromUrl(url) {
  return new URL(url).hostname;
}

export function getGlobalSettings() {
  return storeCache['settings'] ?? {};
}

export function setGlobalSetting(key, value) {
  const globalSettings = getGlobalSettings();
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
  return !settings.site_default().equals(settings.load(site));
}

export function isFileUrl(url) {
	try {
		return (new URL(url)).origin === "file://";
	} catch {
		return false;
	}
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
