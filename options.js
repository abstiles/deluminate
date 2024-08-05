import {
  $,
  syncStore,
  getGlobalSettings,
  setGlobalSetting,
  resetSiteSchemes,
} from './common.js';

function initSettings() {
  const globalSettings = getGlobalSettings();
  if (globalSettings['detect_animation']) {
    $('detect_animation').value = globalSettings['detect_animation'];
  }
}

async function onForget() {
  await resetSiteSchemes();
  loadSettingsDisplay((await syncStore()).export());
}

// Open all links in new tabs.
function onLinkClick() {
  const links = document.getElementsByTagName("a");
  for (let i = 0; i < links.length; i++) {
    (function () {
      const ln = links[i];
      const location = ln.href;
      ln.onclick = function () {
          chrome.tabs.create({active: true, url: location});
      };
    })();
  }
}

function onDetectAnim(evt) {
  setGlobalSetting('detect_animation', evt.target.value);
}

function loadSettingsDisplay(store) {
  $('settings').value = JSON.stringify(store, null, 4);
}

function onEditSave(store) {
  return () => {
    const editSaveButton = document.getElementById('edit-save');
    const settingsText = document.getElementById('settings');

    if (!settingsText.readOnly) {
      editSaveButton.textContent = 'Edit site customizations';
      settingsText.readOnly = true;
      store['siteschemes'] = JSON.stringify(JSON.parse(settingsText.value).schemes);
      store['sitemodifiers'] = JSON.stringify(JSON.parse(settingsText.value).modifiers);
    } else {
      editSaveButton.textContent = 'Save site customizations';
      settingsText.readOnly = false;
    }
  };
}

async function init() {
  const store = await syncStore();
  initSettings();
  $('forget').addEventListener('click', onForget, false);
  $('edit-save').addEventListener('click', onEditSave(store), false);
  $('detect_animation').addEventListener('change', onDetectAnim, false);
  loadSettingsDisplay(store);
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);
