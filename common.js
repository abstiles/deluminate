var DEFAULT_SCHEME = "deluminate-smart";

function $(id) {
  return document.getElementById(id);
}

function getEnabled() {
  var result = localStorage['enabled'];
  if (result === 'true' || result === 'false') {
    return (result === 'true');
  }
  localStorage['enabled'] = 'true';
  return true;
}

function setEnabled(enabled) {
  localStorage['enabled'] = enabled;
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
  if (isLowContrast()) {
    modifiers = 'low-contrast';
  }
  return modifiers;
}

function isLowContrast() {
  var result = localStorage['low_contrast'];

  if (result === 'true' || result === 'false') {
    return (result === 'true');
  }
  localStorage['low_contrast'] = 'false';
  return false;
}

function isDisallowedUrl(url) {
  return url.indexOf('chrome') == 0 || url.indexOf('about') == 0;
}
