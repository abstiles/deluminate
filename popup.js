import UrlSelector from './url_selector.js';
import {
  $,
  syncStore,
  getEnabled,
  setEnabled,
  getMatchingSite,
  getSiteSettings,
  setSiteSettings,
  setSiteScheme,
  addSiteModifier,
  delSiteModifier,
  isDisallowedUrl,
  isFileUrl,
} from './common.js';

const nullSelector = {get_site: () => null,}
let selector;
let key1;
let key2;

function setRadio(name, value) {
  const radios = document.querySelectorAll('input[name="' + name + '"]');
  // Convention: trailing digits on scheme represent subschemes. Strip them
  // before looking for the correct radio to enable.
  value = value.replace(/\d+$/, '');
  for (let i = 0; i < radios.length; i++) {
    radios[i].checked = (radios[i].value.lastIndexOf(value, 0) === 0);
    radios[i].disabled = !getEnabled();
  }
}

function update() {
  document.body.className = getEnabled() ? '' : 'disabled';

  if (getEnabled()) {
    $('toggle').innerHTML = 'Deluminate is Enabled ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'block';
  } else {
    $('toggle').innerHTML = 'Deluminate is Disabled ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'none';
  }

  const currentSettings = getSiteSettings(selector.get_site());
  setRadio('scheme', currentSettings.filter);
  const optChecks = document.querySelectorAll('#inversion-options input');
  for (const input of optChecks) {
    input.checked = currentSettings.mods.has(input.id);
  }
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
      await setSiteScheme(selector.get_site(), value);
      break;
  }
  update();
}

async function onOptionToggle(evt) {
  if (evt.target.checked) {
    await addSiteModifier(selector.get_site(), evt.target.id);
  } else {
    await delSiteModifier(selector.get_site(), evt.target.id);
  }
  update();
}

async function onDimLevel(evt) {
  const dimLevel = "dim" + evt.target.value;
  $('dim_radio').value = dimLevel;
  await setSiteScheme(selector.get_site(), dimLevel);
  update();
}

async function onMakeDefault() {
  await setSiteSettings(null, getSiteSettings(selector.get_site()));
  update();
}

function addRadioListeners(name) {
  const radios = document.querySelectorAll('input[name="' + name + '"]');
  for (let i = 0; i < radios.length; i++) {
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
  const links = document.getElementsByTagName("a");
  for (let i = 0; i < links.length; i++) {
      (function () {
          const ln = links[i];
          ln.onclick = function (evt) {
            chrome.tabs.create({active: true, url: evt.target.href});
            evt.preventDefault();
          };
      })();
  }
}

function onSettings() {
  chrome.tabs.create({active: true, url: "options.html"});
}

async function init() {
  addRadioListeners('scheme');
  const optChecks = document.querySelectorAll('#inversion-options input');
  for (const input of optChecks) {
    input.addEventListener('change', onOptionToggle, false);
  }
  $('dim_amount').addEventListener('input', onDimLevel, false);
  $('toggle').addEventListener('click', onToggle, false);
  $('make_default').addEventListener('click', onMakeDefault, false);
  $('settings').addEventListener('click', onSettings, false);
  const settingsIcon = document.createElement('img');
  settingsIcon.src = chrome.runtime.getURL('settings.svg');
  $('settings').appendChild(settingsIcon)
  key1 = 'Shift+F11';
  key2 = 'Shift+F12';

  await syncStore();

  const window = await chrome.windows.getLastFocused({'populate': true});
  for (const tab of window.tabs) {
    if (!tab.active) continue;
    if (isDisallowedUrl(tab.url)) {
      $('scheme_title').innerText = 'Default color scheme:';
      $('make_default').style.display = 'none';
      selector = nullSelector;
    } else if (isFileUrl(tab.url)) {
      const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
      if (isAllowed) {
        $('scheme_title').innerText = 'File color scheme:';
      } else {
        $('scheme_title').innerText = '';
        $('extension-settings').href = `chrome://extensions/?id=${chrome.runtime.id}`;
        $('local-files-error').removeAttribute('hidden');
        $('settings-form').setAttribute('inert', '');
      }
      selector = {get_site: () => tab.url};
    } else {
      $('scheme_title').innerHTML = 'Color scheme for ' +
          '<div id="selector"></div>' +
          '<div class="kb">(Toggle: ' + key2 + ')</div>';
      selector = new UrlSelector(tab.url);
      selector.render_to($('selector'));
      selector.select_site(getMatchingSite(tab.url));
      $('make_default').style.display = 'block';
    }
    break;
  }
  const currentSettings = getSiteSettings(selector.get_site());
  const currentScheme = currentSettings.filter;
  if (currentScheme.includes('dim')) {
    const currentDimLevel = currentScheme.replace(/.*(\d+)$/, '$1');
    $('dim_amount').value = currentDimLevel;
    $('dim_radio').value = 'dim' + currentDimLevel;
  }
  update();
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
