var DEFAULT_SCHEME = "delumine-smart";
var DEFAULT_MODS = [];

function $(id) {
  return document.getElementById(id);
}

function getStoredBool(key, default_val) {
  default_val = typeof default_val !== 'undefined' ? default_val : 'false';

  var result = localStorage[key];
  if (result === 'true' || result === 'false') {
    return (result === 'true');
  }
  localStorage[key] = default_val;
  return (default_val.toString() === 'true');
}

function getEnabled() {
  return getStoredBool('enabled', true);
}

function setEnabled(enabled) {
  localStorage['enabled'] = enabled;
}

function getLowContrast() {
  return getStoredBool('low_contrast');
}

function setLowContrast(low_contrast) {
  localStorage['low_contrast'] = low_contrast;
}

function getForceText() {
  return getStoredBool('force_text');
}

function setForceText(force_text) {
  localStorage['force_text'] = force_text;
}

function getKillBackground() {
  return getStoredBool('kill_background');
}

function setKillBackground(kill_background) {
  localStorage['kill_background'] = kill_background;
}

function getKeyAction() {
  var keyAction = localStorage['keyaction'];
  if (keyAction == 'global' || keyAction == 'site') {
    return keyAction;
  }
  keyAction = 'global';
  localStorage['keyaction'] = keyAction;
  return keyAction;
}

function setKeyAction(keyAction) {
  if (keyAction != 'global' && keyAction != 'site') {
    keyAction = 'global';
  }
  localStorage['keyaction'] = keyAction;
}

function getDefaultScheme() {
  var scheme = localStorage['scheme'];
  if (scheme) {
    return scheme;
  }
  scheme = DEFAULT_SCHEME;
  localStorage['scheme'] = scheme;
  return scheme;
}

function setDefaultScheme(scheme) {
  if (!(scheme)) {
    scheme = DEFAULT_SCHEME;
  }
  localStorage['scheme'] = scheme;
}

function getSiteScheme(site) {
  var scheme = getDefaultScheme();
  try {
    var siteSchemes = JSON.parse(localStorage['siteschemes']);
    scheme = siteSchemes[site];
    if (!(scheme)) {
      scheme = getDefaultScheme();
    }
  } catch (e) {
    scheme = getDefaultScheme();
  }
  return scheme;
}

function setSiteScheme(site, scheme) {
  if (!(scheme)) {
    scheme = getDefaultScheme();
  }
  var siteSchemes = {};
  try {
    siteSchemes = JSON.parse(localStorage['siteschemes']);
    siteSchemes['www.example.com'] = getDefaultScheme();
  } catch (e) {
    siteSchemes = {};
  }
  siteSchemes[site] = scheme;
  localStorage['siteschemes'] = JSON.stringify(siteSchemes);
}

function resetSiteSchemes() {
  var siteSchemes = {};
  localStorage['siteschemes'] = JSON.stringify(siteSchemes);
}

function siteFromUrl(url) {
  var a = document.createElement('a');
  a.href = url;
  return a.hostname;
}

function getSiteModifiers(site) {
  var modifiers = getDefaultModifiers();
  try {
    var siteModifiers = JSON.parse(localStorage['sitemodifiers'] || '{}');
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

function getDefaultModifiers() {
  var modifiers = [];
  if (getLowContrast()) {
    modifiers.push('low-contrast');
  }
  if (getForceText()) {
    modifiers.push('force_text');
  }
  return modifiers.join(' ');
}

function getGlobalSettings() {
  var globalSettings;
  try {
    globalSettings = JSON.parse(localStorage['settings']);
  } catch(e) {
    globalSettings = {};
  }
  return globalSettings;
}

function setGlobalSetting(key, value) {
  var globalSettings = getGlobalSettings();
  globalSettings[key] = value;
  localStorage['settings'] = JSON.stringify(globalSettings);
}

function setDefaultModifiers(modifiers) {
  var low_contrast = (modifiers.indexOf('low-contrast') > -1).toString();
  var force_text = (modifiers.indexOf('force_text') > -1).toString();
  var kill_background = (modifiers.indexOf('kill_background') > -1).toString();
  localStorage['low_contrast'] = low_contrast;
  localStorage['force_text'] = force_text;
  localStorage['kill_background'] = kill_background;
}

function addSiteModifier(site, modifier) {
  var siteModifiers = {};
  try {
    siteModifiers = JSON.parse(localStorage['sitemodifiers'] || '{}');
    siteModifiers['www.example.com'] = getDefaultModifiers();
  } catch (e) {
    siteModifiers = {};
  }
  try {
    siteModifiers[site][modifier] = true;
  } catch (e) {
    siteModifiers[site] = {};
    // Get a list of non-empty modifiers
    defaultModifiers = getDefaultModifiers().split(' ').filter(
      function(x) { return x.length > 0; }
    );
    for (var i = 0; i < defaultModifiers.length; i++) {
      siteModifiers[site][defaultModifiers[i]] = true;
    }
    siteModifiers[site][modifier] = true;
  }
  localStorage['sitemodifiers'] = JSON.stringify(siteModifiers);
}

function delSiteModifier(site, modifier) {
  var siteModifiers = {};
  try {
    siteModifiers = JSON.parse(localStorage['sitemodifiers'] || '{}');
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
  localStorage['sitemodifiers'] = JSON.stringify(siteModifiers);
}

function changedFromDefault() {
  var siteModList = getSiteModifiers(site);
  var defaultModList = getDefaultModifiers();
  return (getSiteScheme(site) != getDefaultScheme() ||
          siteModList != defaultModList);
}

function isDisallowedUrl(url) {
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

function getSettingsViewed() {
  return getStoredBool('settings_viewed');
}

function setSettingsViewed() {
  localStorage['settings_viewed'] = true;
}
