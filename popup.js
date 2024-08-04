import UrlSelector from './url_selector.js';
import {
  $,
  syncStore,
  getEnabled,
  setEnabled,
  siteFromUrl,
  getMatchingSite,
  getSiteSettings,
  setSiteSettings,
  setSiteScheme,
  addSiteModifier,
  delSiteModifier,
  isDisallowedUrl,
} from './common.js';

const nullSelector = {get_site: () => null,}
let selector;
var site;
var key1;
var key2;

function setRadio(name, value) {
  var radios = document.querySelectorAll('input[name="' + name + '"]');
  // Convention: trailing digits on scheme represent subschemes. Strip them
  // before looking for the correct radio to enable.
  value = value.replace(/\d+$/, '');
  for (var i = 0; i < radios.length; i++) {
    radios[i].checked = (radios[i].value.lastIndexOf(value, 0) === 0);
    radios[i].disabled = !getEnabled();
  }
}

function update() {
  document.body.className = getEnabled() ? '' : 'disabled';

  if (getEnabled()) {
    // $('title').innerText = 'Deluminate is Enabled';
    $('toggle').innerHTML = 'Deluminate is Enabled ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'block';
  } else {
    // $('title').innerText = 'Deluminate is Disabled';
    $('toggle').innerHTML = 'Deluminate is Disabled ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'none';
  }

  const currentSettings = getSiteSettings(selector.get_site());
  setRadio('scheme', currentSettings.filter);
  $('toggle_contrast').checked = currentSettings.mods.has("low_contrast");
  $('force_textfield').checked = currentSettings.mods.has("forceinput");
  $('kill_bgfield').checked = currentSettings.mods.has("killbg");
  $('dynamic').checked = currentSettings.mods.has("dynamic");
  if (selector.get_site()) {
    $('make_default').disabled = !changedFromDefault();
  }
}

function changedFromDefault() {
  return !getSiteSettings().equals(getSiteSettings(selector.get_site()));
}

async function onToggle() {
  await setEnabled(!getEnabled());
  update();
}

async function onRadioChange(name, value) {
  switch (name) {
    case 'scheme':
      if (selector.get_site()) {
        await setSiteScheme(selector.get_site(), value);
      } else {
        await setDefaultScheme(value);
      }
      break;
  }
  update();
}

async function onLowContrast(evt) {
  if (evt.target.checked) {
    await addSiteModifier(selector.get_site(), 'low_contrast');
  } else {
    await delSiteModifier(selector.get_site(), 'low_contrast');
  }
  update();
}

async function onForceText(evt) {
  if (evt.target.checked) {
    await addSiteModifier(selector.get_site(), 'forceinput');
  } else {
    await delSiteModifier(selector.get_site(), 'forceinput');
  }
  update();
}

async function onKillBackground(evt) {
  if (evt.target.checked) {
    await addSiteModifier(selector.get_site(), 'killbg');
  } else {
    await delSiteModifier(selector.get_site(), 'killbg');
  }
  update();
}

async function onDynamic(evt) {
  if (evt.target.checked) {
    await addSiteModifier(selector.get_site(), 'dynamic');
  } else {
    await delSiteModifier(selector.get_site(), 'dynamic');
  }
  update();
}

async function onDimLevel(evt) {
  let dimLevel = "dim" + evt.target.value;
  $('dim_radio').value = dimLevel;
  await setSiteScheme(selector.get_site(), dimLevel);
  update();
}

async function onMakeDefault() {
  await setSiteSettings(null, getSiteSettings(selector.get_site()));
  update();
}

function addRadioListeners(name) {
  var radios = document.querySelectorAll('input[name="' + name + '"]');
  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', function(evt) {
      onRadioChange(evt.target.name, evt.target.value);
    }, false);
    radios[i].addEventListener('click', function(evt) {
      onRadioChange(evt.target.name, evt.target.value);
    }, false);
  }
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

function onSettings() {
  chrome.tabs.create({active: true, url: "options.html"});
}

async function init() {
  addRadioListeners('scheme');
  $('toggle_contrast').addEventListener('change', onLowContrast, false);
  $('force_textfield').addEventListener('change', onForceText, false);
  $('kill_bgfield').addEventListener('change', onKillBackground, false);
  $('dynamic').addEventListener('change', onDynamic, false);
  $('dim_amount').addEventListener('input', onDimLevel, false);
  $('toggle').addEventListener('click', onToggle, false);
  $('make_default').addEventListener('click', onMakeDefault, false);
  $('settings').addEventListener('click', onSettings, false);
  key1 = 'Shift+F11';
  key2 = 'Shift+F12';

  await syncStore();

  chrome.windows.getLastFocused({'populate': true}, function(window) {
    site = '';
    for (var i = 0; i < window.tabs.length; i++) {
      var tab = window.tabs[i];
      if (tab.active) {
        if (isDisallowedUrl(tab.url)) {
          $('scheme_title').innerText = 'Default color scheme:';
          $('make_default').style.display = 'none';
          selector = nullSelector;
        } else {
          site = siteFromUrl(tab.url);
          $('scheme_title').innerHTML = 'Color scheme for ' +
              '<div id="selector"></div>' +
              '<div class="kb">(Toggle: ' + key2 + ')</div>';
          selector = new UrlSelector(tab.url);
          selector.render_to($('selector'));
          selector.select_site(getMatchingSite(tab.url));
          $('make_default').style.display = 'block';
          break;
        }
      }
    }
    const currentSettings = getSiteSettings(selector.get_site());
    const currentScheme = currentSettings.filter;
    if (currentScheme.includes('dim')) {
      let currentDimLevel = currentScheme.replace(/.*(\d+)$/, '$1');
      $('dim_amount').value = currentDimLevel;
      $('dim_radio').value = 'dim' + currentDimLevel;
    }
    update();
  });
}

function onEvent(evt) {
  if (evt.keyCode == 122 /* F11 */ &&
      evt.shiftKey) {
    chrome.runtime.sendMessage({'toggle_global': true});
    evt.stopPropagation();
    evt.preventDefault();
    update();
    return false;
  }
  if (evt.keyCode == 123 /* F12 */ &&
      evt.shiftKey) {
    chrome.runtime.sendMessage({'toggle_site': true});
    evt.stopPropagation();
    evt.preventDefault();
    update();
    return false;
  }
  return true;
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);
document.addEventListener('keydown', onEvent, false);

if (typeof(global) !== 'undefined') {
    global.onMakeDefault = onMakeDefault;
    global.changedFromDefault = changedFromDefault;
}
