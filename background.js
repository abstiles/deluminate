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

let initializationCompletePromise;

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
    await chrome.scripting.executeScript({
      target: {tabId: tab.id, allFrames: true},
      files: ["deluminate.js"],
      injectImmediately: true,
    });
    console.log(`Done injecting JS into tab: ${tabSummary(tab)}`);
  } catch (err) {
    // Don't bother logging the expected error in this case.
    if (tab.url.indexOf('chrome') != 0 && tab.url.indexOf('about') != 0) {
      console.log('Error injecting JS into tab:', tab.url, err, tabSummary(tab));
    }
  }
}

async function injectTabCSS(tab) {
  console.log(`Injecting CSS into tab: ${tabSummary(tab)}`);
  const url = tab.url;
  try {
    await chrome.scripting.insertCSS({
      target: {tabId: tab.id, allFrames: true},
      files: ["deluminate.css"],
    });
    console.log(`Done injecting CSS into tab: ${tabSummary(tab)}`);
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
  setSiteScheme(url, scheme);
  updateTabs();
}

function messageDispatcher(request, sender, sendResponse) {
  // Offscreen document messages are handled differently or are fire-and-forget for this dispatcher.
  if (request.target === 'offscreen') {
    // If a response is needed for offscreen messages, it should be handled before this point
    // or the message should indicate if it expects a response.
    return false; // Assuming no async response needed from this dispatcher for offscreen.
  }

  if (request['detect_gif']) {
    isAnimatedGif(request.src).then(sendResponse)
    return true;
  }

  // For other messages, ensure initialization is complete.
  (async () => {
    try {
      // Wait for initial settings load for most operations.
      if (initializationCompletePromise && 
          (request['update_tabs'] || request['toggle_global'] || request['toggle_site'] || request['init'])) {
        await initializationCompletePromise;
      }

      if (request['update_tabs']) {
        console.log("Received update tabs message.");
        updateTabs();
        sendResponse({status: "tabs_updated"});
      } else if (request['toggle_global']) {
        toggleEnabled();
        sendResponse({status: "global_toggled"});
      } else if (request['toggle_site']) {
        toggleSite(sender.tab ? sender.tab.url : 'www.example.com');
        sendResponse({status: "site_toggled"});
      } else if (request['log']) {
        console.log("Log:", tabSummary(sender.tab), request.log);
        sendResponse({status: "logged"});
      } else if (request['init']) {
        const url = sender.tab ? sender.tab.url : request['url'];
        const siteSettings = getSiteSettings(url);
        const msg = {
          'enabled': getEnabled(),
          'scheme': Filter[siteSettings.filter],
          'modifiers': [...siteSettings.mods].map(mod => Modifier[mod]),
          'settings': getGlobalSettings()
        };
        sendResponse(msg);
      } else {
        // Default response for unhandled messages or messages that don't need a specific reply
        sendResponse({});
      }
    } catch (error) {
      console.error("Error processing message:", request, error);
      sendResponse({error: error.message || "Failed to process message after initialization check"});
    }
  })();

  return true; // Crucial: indicates that sendResponse will be (or might be) called asynchronously.
}

function init() {
  console.log("Initializing service worker.");

  initializationCompletePromise = (async () => {
    try {
      console.log("Fetching settings.");
      await syncStore();
      console.log("Injecting content scripts.");
      await injectContentScripts();
      console.log("Deluminate is ready.");
    } catch (error) {
      console.error("Error during initial setup:", error);
      // This error will propagate to awaiters of initializationCompletePromise
      throw error; 
    }
  })();

  chrome.runtime.onMessage.addListener(messageDispatcher);

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "loading") {
      // Ping the tab to see if content script is alive
      chrome.tabs.sendMessage(tabId, {pingTab: true}, {}, () => {
        if (chrome.runtime.lastError) {
          // No listener, or other error means content script might not be there.
          console.log(`Tab updated, reinjecting ${tab.url}: ${JSON.stringify(changeInfo)}`);
          // Ensure initialization is complete before injecting,
          // as injection might lead to immediate 'init' message from content script.
          initializationCompletePromise.then(() => injectTab(tab)).catch(err => {
            console.error("Failed to inject tab after initialization on tab update:", err);
          });
        }
      });
    }
  });

  chrome.tabs.onReplaced.addListener(function (addedTabId) {
    chrome.tabs.get(addedTabId, function(tab) {
      console.log("Tab replaced, reinjecting:", tab.url);
      initializationCompletePromise.then(() => injectTab(tab)).catch(err => {
            console.error("Failed to inject tab after initialization on tab replace:", err);
      });
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' || area === 'local') {
      // Ensure initialization is complete before refreshing store and updating tabs,
      // though refreshStore itself should be safe.
      initializationCompletePromise.then(() => {
        refreshStore().then(() => {
          updateTabs();
        });
      }).catch(err => {
        console.error("Failed to process storage change due to initialization error:", err);
      });
    }
  });

  if (navigator.appVersion.indexOf("Mac") != -1) {
    chrome.action.setTitle({'title': 'Deluminate (Shift+F11)'});
  }

  chrome.commands.onCommand.addListener(function(command) {
    // Commands should also ideally wait for initialization if they rely on settings.
    initializationCompletePromise.then(() => {
      switch(command) {
        case 'command_toggle_global':
          toggleEnabled();
          break;
        case 'command_toggle_site':
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
              console.log('site toggled: ' + tabs[0].url);
              toggleSite(tabs[0].url);
            }
          });
          break;
      }
    }).catch(err => {
      console.error("Failed to execute command due to initialization error:", err);
    });
  });

  chrome.runtime.onInstalled.addListener(async ({reason}) => {
    console.log(`Install event - reason: ${reason}`);
    try {
      // Wait for the main initialization to complete.
      // init() runs on every service worker start, including after install/update.
      await initializationCompletePromise;
      console.log("Main initialization complete. onInstalled can proceed with install/update specific tasks.");
      
      // Example: Set/update a version in local storage
      const currentVersion = chrome.runtime.getManifest().version;
      if (reason === 'install') {
        console.log("Deluminate installed. Version:", currentVersion);
        await chrome.storage.local.set({ installedVersion: currentVersion });
      } else if (reason === 'update') {
        const { installedVersion: previousVersion } = await chrome.storage.local.get('installedVersion');
        console.log(`Deluminate updated from ${previousVersion || 'unknown'} to ${currentVersion}`);
        await chrome.storage.local.set({ installedVersion: currentVersion });
        // Perform any other update-specific tasks here.
      }

    } catch (error) {
      console.error("Error during onInstalled (after main initialization attempt):", error);
    }
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
