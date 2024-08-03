import {
  DEFAULT_SCHEME,
  refreshStore,
  getEnabled,
  setEnabled,
  getDefaultScheme,
  getSiteScheme,
  setSiteScheme,
  siteFromUrl,
  getSiteModifiers,
  getDefaultModifiers,
  getGlobalSettings,
  isDisallowedUrl,
} from './common.js';

function injectContentScripts() {
  chrome.windows.getAll({'populate': true}, function(windows) {
    for (var i = 0; i < windows.length; i++) {
      var tabs = windows[i].tabs;
      for (var j = 0; j < tabs.length; j++) {
        var url = tabs[j].url;
        if (url.indexOf('chrome') == 0 || url.indexOf('about') == 0) {
          continue;
        }
        injectTabCSS(tabs[j]);
      }
    }
  });
};

function injectTabCSS(tab) {
  return;
  /*
  console.log("Injecting CSS into tab:", tab);
  var url = tab.url;
  chrome.tabs.insertCSS(tab.id, {
    file: 'deluminate.css',
    allFrames: true,
    matchAboutBlank: true,
    runAt: 'document_start'
  }, function() {
    if (chrome.runtime.lastError) {
      // Don't bother logging the expected error in this case.
      if (url.indexOf('chrome') != 0 && url.indexOf('about') != 0) {
        console.log('Error injecting CSS into tab:', url,
                    chrome.runtime.lastError.message, tab);
      }
      console.log("Telling tab to inject manually.");
      chrome.tabs.sendMessage(tab.id, {manual_css: true});
    }
  });
  */
}

function updateTabs() {
  var msg = {
    'enabled': getEnabled()
  };

  function initTabs(windows) {
    for (var i = 0; i < windows.length; i++) {
      var tabs = windows[i].tabs;
      for (var j = 0; j < tabs.length; j++) {
        var url = tabs[j].url;
        if (isDisallowedUrl(url)) {
          continue;
        }
        var msg = {
          'enabled': getEnabled(),
          'scheme': getSiteScheme(siteFromUrl(url)),
          'modifiers': getSiteModifiers(siteFromUrl(url)),
          'settings': getGlobalSettings()
        };
        chrome.tabs.sendMessage(tabs[j].id, msg);
      }
    }
  };

  chrome.windows.getAll({'populate': true}, initTabs);
};

function toggleEnabled() {
  setEnabled(!getEnabled());
  updateTabs();
}

function toggleSite(url) {
  var site = siteFromUrl(url);
  var scheme = getSiteScheme(site);
  if (scheme != "normal") {
    scheme = "normal";
  } else if (getDefaultScheme() != "normal") {
    scheme = getDefaultScheme();
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
    console.log(JSON.stringify(sender.tab), request.log);
  }
  if (request['detect_gif']) {
    isAnimatedGif(request.src).then(sendResponse)
    return true;
  }
  if (request['init']) {
    var url = sender.tab ? sender.tab.url : request['url'];
    var scheme = getDefaultScheme();
    var modifiers = getDefaultModifiers();
    if (sender.tab) {
      injectTabCSS(sender.tab);
    }
    if (url) {
      scheme = getSiteScheme(siteFromUrl(url));
      modifiers = getSiteModifiers(siteFromUrl(url));
    }
    var msg = {
      'enabled': getEnabled(),
      'scheme': scheme,
      'modifiers': modifiers,
      'settings': getGlobalSettings()
    };
    sendResponse(msg);
  }
}

function init() {
  chrome.runtime.onMessage.addListener(messageDispatcher);

  injectContentScripts();
  updateTabs();

  /* Ensure tab CSS is re-inserted into replaced tabs. */
  chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    chrome.tabs.get(addedTabId, function(tab) {
      console.log("Tab replaced, reinjecting CSS into it:", tab);
      injectTabCSS(tab);
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
    chrome.action.setTitle({'title': 'Deluminate (Cmd+Shift+F11)'});
  }
  chrome.commands.onCommand.addListener(function(command) {
    switch(command) {
      case 'command_toggle_global':
        console.log('global toggled');
        toggleEnabled();
        break;
      case 'command_toggle_site':
        console.log('site toggled');
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          console.log('site toggled: ' + tabs[0].url);
          toggleSite(tabs[0].url);
        });
        break;
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
