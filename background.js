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
}

function updateTabs() {
  var msg = {
    'enabled': getEnabled()
  };
  chrome.windows.getAll({'populate': true}, function(windows) {
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
  });
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

function init() {
  injectContentScripts();
  updateTabs();

  chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (request['toggle_global']) {
          toggleEnabled();
        }
        if (request['toggle_site']) {
          toggleSite(sender.tab ? sender.tab.url : 'www.example.com');
        }
        if (request['log']) {
          console.log(sender.tab, request.log);
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
      });

  /* Ensure tab CSS is re-inserted into replaced tabs. */
  chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    chrome.tabs.get(addedTabId, function(tab) {
      console.log("Tab replaced, reinjecting CSS into it:", tab);
      injectTabCSS(tab);
    });
  });


  document.addEventListener('storage', function(evt) {
    updateTabs();
  }, false);

  if (navigator.appVersion.indexOf("Mac") != -1) {
    chrome.browserAction.setTitle({'title': 'Deluminate (Cmd+Shift+F11)'});
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
};

init();
