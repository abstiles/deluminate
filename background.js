import {Filter, Modifier} from './utils.js';
import {
  DEFAULT_SCHEME,
  refreshStore,
  syncStore,
  getEnabled,
  setEnabled,
  getSiteSettings,
  setSiteScheme,
  getGlobalSettings,
  isDisallowedUrl,
} from './common.js';

async function injectContentScripts() {
  const injectTasks = [];
  const windows = await chrome.windows.getAll({'populate': true});
  for (const window of windows) {
    for (const tab of window.tabs) {
      injectTasks.push(injectTab(tab));
    }
  }
  return Promise.allSettled(injectTasks);
}

async function injectTab(tab) {
  const url = tab.url;
  if (url.indexOf('chrome') == 0 || url.indexOf('about') == 0) {
    return [];
  }
  return await Promise.allSettled([
    injectTabJS(tab),
    injectTabCSS(tab),
  ]);
}

function tabSummary(tab) {
  const details = {url: tab.url, id: tab.id};
  return JSON.stringify(details);
}

async function injectTabJS(tab) {
  console.log(`Injecting JS into tab: ${tabSummary(tab)}`);
  try {
  return await chrome.scripting.executeScript({
    target: {tabId: tab.id, allFrames: true},
    files: ["deluminate.js"],
    injectImmediately: true,
  });
  } finally {
    console.log(`Done injecting JS into tab: ${tabSummary(tab)}`);
  }
}

async function injectTabCSS(tab) {
  console.log(`Injecting CSS into tab: ${tabSummary(tab)}`);
  var url = tab.url;
  try {
    return await chrome.scripting.insertCSS({
      target: {tabId: tab.id, allFrames: true},
      files: ["deluminate.css"],
    });
  } catch (err) {
    // Don't bother logging the expected error in this case.
    if (url.indexOf('chrome') != 0 && url.indexOf('about') != 0) {
      console.log('Error injecting CSS into tab:', url, err, tabSummary(tab));
    }
    /*
    // Race condition here where this won't work if the content script isn't
    // loaded yet.
    console.log("Telling tab to inject manually.");
    chrome.tabs.sendMessage(tab.id, {manual_css: true});
    */
  }
}

function updateTabs() {
  var msg = {
    'enabled': getEnabled()
  };

  function initTabs(windows) {
    for (const window of windows) {
      for (const tab of window.tabs) {
        const url = tab.url;
        if (isDisallowedUrl(url)) {
          continue;
        }
        const siteSettings = getSiteSettings(url);
        const msg = {
          'enabled': getEnabled(),
          'scheme': Filter[siteSettings.filter],
          'modifiers': [...siteSettings.mods].map(mod => Modifier[mod]),
          'settings': getGlobalSettings()
        };
        chrome.tabs.sendMessage(tab.id, msg, {}, () => {
          if (chrome.runtime.lastError) {
            console.log(`Failed to communicate with tab ${JSON.stringify(tab)}: ${JSON.stringify(chrome.runtime.lastError)}`);
          }
        });
      }
    }
  }

  chrome.windows.getAll({'populate': true}, initTabs);
};

function toggleEnabled() {
  setEnabled(!getEnabled());
  updateTabs();
}

function toggleSite(url) {
  const defaultScheme = getSiteSettings();
  let scheme = getSiteSettings(url).filter;
  if (scheme != "normal") {
    scheme = "normal";
  } else if (defaultScheme != "normal") {
    scheme = defaultScheme;
  } else {
    scheme = DEFAULT_SCHEME;
  }
  setSiteScheme(site, scheme);
  updateTabs();
}

function messageDispatcher(request, sender, sendResponse) {
  if (request.target === 'offscreen') return;
  if (request['update_tabs']) {
    updateTabs();
  }
  if (request['toggle_global']) {
    toggleEnabled();
  }
  if (request['toggle_site']) {
    toggleSite(sender.tab ? sender.tab.url : 'www.example.com');
  }
  if (request['log']) {
    console.log("Log:", tabSummary(sender.tab), request.log);
  }
  if (request['detect_gif']) {
    isAnimatedGif(request.src).then(sendResponse)
    return true;
  }
  if (request['init']) {
    var url = sender.tab ? sender.tab.url : request['url'];
    const siteSettings = getSiteSettings(url);
    var msg = {
      'enabled': getEnabled(),
      'scheme': Filter[siteSettings.filter],
      'modifiers': [...siteSettings.mods].map(mod => Modifier[mod]),
      'settings': getGlobalSettings()
    };
    sendResponse(msg);
  } else {
    sendResponse();
  }
}

function init() {
  console.log("Initializing service worker.");
  chrome.runtime.onMessage.addListener(messageDispatcher);

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "loading") {
      console.log(`Tab updated, reinjecting ${tab.url}: ${JSON.stringify(changeInfo)}`);
      injectTab(tab);
    }
  });
  /* Ensure tab CSS is re-inserted into replaced tabs. */
  chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    chrome.tabs.get(addedTabId, function(tab) {
      console.log("Tab replaced, reinjecting:", tab.url);
      injectTab(tab);
    });
  });


  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      refreshStore().then(() => {
        updateTabs();
      });
    }
  });

  if (navigator.appVersion.indexOf("Mac") != -1) {
    chrome.action.setTitle({'title': 'Deluminate (Shift+F11)'});
  }
  chrome.commands.onCommand.addListener(function(command) {
    switch(command) {
      case 'command_toggle_global':
        toggleEnabled();
        break;
      case 'command_toggle_site':
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          console.log('site toggled: ' + tabs[0].url);
          toggleSite(tabs[0].url);
        });
        break;
    }
  });

  let asyncInitializing = true;
  (async () => {
    try {
      console.log("Fetching settings.");
      await syncStore();
      console.log("Injecting content scripts.");
      await injectContentScripts();
      console.log("Deluminate is ready.");
    } finally {
      asyncInitializing = false;
    }
  })();

  chrome.runtime.onInstalled.addListener(async ({reason}) => {
    console.log(`Install event - reason: ${reason}`);
    // It is unclear to me whether there are cases in which the browser runs the
    // top-level code (i.e., init) or fires the onInstalled event without doing
    // the other. This listener might be wholly redundant if we're doing all the
    // same things in init. Either way, don't run this code if init is running.
    if (asyncInitializing) {
      console.log("Already initializing, skipping onInstall steps.");
      return;
    }
    await syncStore();
    console.log("Updated settings cache.");
    await injectContentScripts();
    console.log("Reloaded all tabs.");
  });
}

async function isAnimatedGif(src) {
  if (src.indexOf('data:') == 0) {
    return;
  }
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const arr = new Uint8Array(arrayBuffer);

  // make sure it's a gif (GIF8)
  if (arr[0] !== 0x47 || arr[1] !== 0x49 ||
      arr[2] !== 0x46 || arr[3] !== 0x38) {
    return false;
  }

  //ported from php http://www.php.net/manual/en/function.imagecreatefromgif.php#104473
  //an animated gif contains multiple "frames", with each frame having a
  //header made up of:
  // * a static 4-byte sequence (\x00\x21\xF9\x04)
  // * 4 variable bytes
  // * a static 2-byte sequence (\x00\x2C) (some variants may use \x00\x21 ?)
  // We read through the file til we reach the end of the file, or we've found
  // at least 2 frame headers
  let frames = 0;
  const length = arr.length;
  for (let i=0; i < length - 9; ++i) {
    if (arr[i] === 0x00 && arr[i+1] === 0x21 &&
        arr[i+2] === 0xF9 && arr[i+3] === 0x04 &&
        arr[i+8] === 0x00 &&
        (arr[i+9] === 0x2C || arr[i+9] === 0x21))
    {
      frames++;
    }
    if (frames > 1) {
      break;
    }
  }

  // if frame count > 1, it's animated
  return frames > 1;
}

init();
