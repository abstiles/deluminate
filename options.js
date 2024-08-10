import {
  $,
  syncStore,
  getGlobalSettings,
  setGlobalSetting,
  delSiteSettings,
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
  function makeTag(tag, ...contents) {
    const element = document.createElement(tag);
    for (const child of contents) {
      console.log(`child: ${child} - ${typeof child}`);
      try {
        element.appendChild(
          typeof child === "string" ? document.createTextNode(child)
            : child
        );
      } catch {
        console.log(`Bad contents of ${tag}: ${JSON.stringify(contents)}`);
        console.log(`Bad child type: ${JSON.stringify(child)}`);
      }
    }
    return element;
  }
  function makeSiteDiv([url, filter, ...mods]) {
    const deleteBtn = url ? makeTag("button", "X") : makeTag("span", "");
    const row = makeTag('div',
      deleteBtn,
      makeTag('span', url || "DEFAULT"),
      makeTag('span', filter),
      makeTag('span', mods.join(', ')),
    );
    if (url) {
      deleteBtn.className = "delete-button";
      deleteBtn.onclick = () => {
        row.parentElement.removeChild(row);
        delSiteSettings(url);
      }
    }
    return row;
  }
  const settingsDiv = $('settings');
  const heading = makeTag("div",
    makeTag("span", ""),
    makeTag("span", "Website"),
    makeTag("span", "Filter"),
    makeTag("span", "Options"),
  );
  heading.id = "settings-heading";
  settingsDiv.appendChild(heading);
  for (const site of store) {
    settingsDiv.appendChild(makeSiteDiv(site));
  }
}

async function init() {
  const store = await syncStore();
  initSettings();
  $('forget').addEventListener('click', onForget, false);
  $('detect_animation').addEventListener('change', onDetectAnim, false);
  loadSettingsDisplay(store.export());
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);
