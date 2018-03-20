function initSettings() {
  var globalSettings = getGlobalSettings();
  if (globalSettings['detect_animation']) {
    $('detect_animation').value = globalSettings['detect_animation'];
  }
}

function onForget() {
  resetSiteSchemes();
  resetSiteModifiers();
  loadSettingsDisplay();
}

// Open all links in new tabs.
function onLinkClick() {
  var links = document.getElementsByTagName("a");
  for (var i = 0; i < links.length; i++) {
    (function () {
      var ln = links[i];
      var location = ln.href;
      ln.onclick = function () {
          chrome.tabs.create({active: true, url: location});
      };
    })();
  }
}

function onDetectAnim(evt) {
  setGlobalSetting('detect_animation', evt.target.value);
}

function loadSettingsDisplay() {
  var settings = {
    'version': 1,
    'schemes': JSON.parse(localStorage['siteschemes']),
    'modifiers': JSON.parse(localStorage['sitemodifiers'] || '{}')
  }
  $('settings').value = JSON.stringify(settings, null, 4);
}

function init() {
  initSettings();
  $('forget').addEventListener('click', onForget, false);
  $('detect_animation').addEventListener('change', onDetectAnim, false);
  loadSettingsDisplay();
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);

/* Necessary node bootstrapping for testing. */
if (typeof(global) !== 'undefined') {
  global.onForget = onForget;
}
