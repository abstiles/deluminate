var DEFAULT_SCHEME = "delumine-smart";

function $(id) {
  return document.getElementById(id);
}

function getStoredBool(key, default_val) {
  default_val = typeof default_val !== 'undefined' ? default_val : 'false';

  var result = localStorage[key];
  if (result === 'true' || result === 'false') {
    return (result === 'true');
  }
  localStorage[key] = defaul_val;
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

function getModifiers() {
  var modifiers = '';
  if (getLowContrast()) {
    modifiers = 'low-contrast';
  }
  if (window.devicePixelRatio > 1) {
    modifiers += ' hidpi';
  }
  return modifiers;
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
