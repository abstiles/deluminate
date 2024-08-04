import {Settings, SiteSettings} from "./utils.js";

export const DEFAULT_SCHEME = "delumine-smart";
const storeCache = {};
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
      migrateV1toV2(result.localStorage);
      // chrome.storage.local.set({migrationComplete: true});
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
    .split("-")[1] ?? "normal"
    ;
  const schemeToFilter = (scheme) =>
    (scheme ?? `filter-${defaultFilter}`)
    .split("-")[1] ?? "normal"
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
}

export async function syncStore() {
  await migrateFromLocalStorage();
  return await refreshStore();
}

export async function refreshStore() {
  const items = await chrome.storage.sync.get();
  Object.assign(storeCache, items);
  storageFetched = true;
  return storeCache;
}

export function storeSet(key, value) {
  storeCache[key] = value;
  chrome.storage.sync.set({[key]: value});
}

export function $(id) {
  return document.getElementById(id);
}

function getStoredBool(key, default_val) {
  default_val = typeof default_val !== 'undefined' ? default_val : 'false';

  var result = storeCache[key];
  if (result === true || result === false) {
    return result;
  }
  if (result === 'true' || result === 'false') {
    return (result === 'true');
  }
  if (storageFetched) {
    storeSet(key, default_val);
  }
  return (default_val.toString() === 'true');
}

export function getEnabled() {
  return getStoredBool('enabled', true);
}

export function setEnabled(enabled) {
  storeSet('enabled', enabled);
}

export function getLowContrast() {
  return getStoredBool('low_contrast');
}

export function setLowContrast(low_contrast) {
  storeSet('low_contrast', low_contrast);
}

export function getForceText() {
  return getStoredBool('force_text');
}

export function setForceText(force_text) {
  storeSet('force_text', force_text);
}

export function getKillBackground() {
  return getStoredBool('kill_background');
}

export function setKillBackground(kill_background) {
  storeSet('kill_background', kill_background);
}

export function getKeyAction() {
  var keyAction = storeCache['keyaction'];
  if (keyAction == 'global' || keyAction == 'site') {
    return keyAction;
  }
  keyAction = 'global';
  if (storageFetched) {
    storeSet('keyaction', keyAction);
  }
  return keyAction;
}

export function setKeyAction(keyAction) {
  if (keyAction != 'global' && keyAction != 'site') {
    keyAction = 'global';
  }
  storeSet('keyaction', keyAction);
}

export function getDefaultScheme() {
  var scheme = storeCache['scheme'];
  if (scheme) {
    return scheme;
  }
  scheme = DEFAULT_SCHEME;
  if (storageFetched) {
    storeSet('scheme', scheme);
  }
  return scheme;
}

export function setDefaultScheme(scheme) {
  if (!(scheme)) {
    scheme = DEFAULT_SCHEME;
  }
  storeSet('scheme', scheme);
}

export function getSiteScheme(site) {
  var scheme = getDefaultScheme();
  try {
    var siteSchemes = JSON.parse(storeCache['siteschemes']);
    scheme = siteSchemes[site];
    if (!(scheme)) {
      scheme = getDefaultScheme();
    }
  } catch (e) {
    scheme = getDefaultScheme();
  }
  return scheme;
}

export function setSiteScheme(site, scheme) {
  if (!(scheme)) {
    scheme = getDefaultScheme();
  }
  var siteSchemes = {};
  try {
    siteSchemes = JSON.parse(storeCache['siteschemes']);
    siteSchemes['www.example.com'] = getDefaultScheme();
  } catch (e) {
    siteSchemes = {};
  }
  siteSchemes[site] = scheme;
  storeSet('siteschemes', JSON.stringify(siteSchemes));
}

export function resetSiteSchemes() {
  var siteSchemes = {};
  storeSet('siteschemes', JSON.stringify(siteSchemes));
}

export function siteFromUrl(url) {
  return new URL(url).hostname;
}

export function getSiteModifiers(site) {
  var modifiers = getDefaultModifiers();
  try {
    var siteModifiers = JSON.parse(storeCache['sitemodifiers'] || '{}');
    if (site in siteModifiers) {
      var modifierList = [];
      for (var mod in siteModifiers[site]) {
        modifierList.push(mod);
      }
      modifiers = modifierList.join(' ');
    } else {
      modifiers = getDefaultModifiers();
    }
  } catch (e) {
    modifiers = getDefaultModifiers();
  }
  return modifiers;
}

export function getDefaultModifiers() {
  var modifiers = [];
  if (getLowContrast()) {
    modifiers.push('low-contrast');
  }
  if (getForceText()) {
    modifiers.push('force_text');
  }
  if (getKillBackground()) {
    modifiers.push('kill_background');
  }
  return modifiers.join(' ');
}

export function getGlobalSettings() {
  var globalSettings;
  try {
    globalSettings = JSON.parse(storeCache['settings']);
  } catch(e) {
    globalSettings = {};
  }
  return globalSettings;
}

export function setGlobalSetting(key, value) {
  var globalSettings = getGlobalSettings();
  globalSettings[key] = value;
  storeSet('settings', JSON.stringify(globalSettings));
}

export function setDefaultModifiers(modifiers) {
  var low_contrast = (modifiers.indexOf('low-contrast') > -1).toString();
  var force_text = (modifiers.indexOf('force_text') > -1).toString();
  var kill_background = (modifiers.indexOf('kill_background') > -1).toString();
  storeSet('low_contrast', low_contrast);
  storeSet('force_text', force_text);
  storeSet('kill_background', kill_background);
}

export function addSiteModifier(site, modifier) {
  var siteModifiers = {};
  try {
    siteModifiers = JSON.parse(storeCache['sitemodifiers'] || '{}');
    siteModifiers['www.example.com'] = getDefaultModifiers();
  } catch (e) {
    siteModifiers = {};
  }
  try {
    siteModifiers[site][modifier] = true;
  } catch (e) {
    siteModifiers[site] = {};
    // Get a list of non-empty modifiers
    let defaultModifiers = getDefaultModifiers().split(' ').filter(
      function(x) { return x.length > 0; }
    );
    for (var i = 0; i < defaultModifiers.length; i++) {
      siteModifiers[site][defaultModifiers[i]] = true;
    }
    siteModifiers[site][modifier] = true;
  }
  storeSet('sitemodifiers', JSON.stringify(siteModifiers));
}

export function delSiteModifier(site, modifier) {
  var siteModifiers = {};
  try {
    siteModifiers = JSON.parse(storeCache['sitemodifiers'] || '{}');
    siteModifiers['www.example.com'] = getDefaultModifiers();
  } catch (e) {
    siteModifiers = {};
  }
  try {
    delete siteModifiers[site][modifier];
  } catch (e) {
    siteModifiers[site] = {};
    // Get a list of non-empty modifiers
    defaultModifiers = getDefaultModifiers().split(' ').filter(
      function(x) { x }
    );
    for (var i = 0; i < defaultModifiers.length; i++) {
      siteModifiers[site][defaultModifiers[i]] = true;
    }
    delete siteModifiers[site][modifier];
  }
  storeSet('sitemodifiers', JSON.stringify(siteModifiers));
}

export function resetSiteModifiers() {
  var siteModifiers = {};
  storeSet('sitemodifiers', JSON.stringify(siteModifiers));
}

export function changedFromDefault() {
  var siteModList = getSiteModifiers(site);
  var defaultModList = getDefaultModifiers();
  return (getSiteScheme(site) != getDefaultScheme() ||
          siteModList != defaultModList);
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

export function getSettingsViewed() {
  return getStoredBool('settings_viewed');
}

export function setSettingsViewed() {
  storeSet('settings_viewed', true);
}
