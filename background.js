function injectContentScripts() {
  chrome.windows.getAll({'populate': true}, function(windows) {
    for (var i = 0; i < windows.length; i++) {
      var tabs = windows[i].tabs;
      for (var j = 0; j < tabs.length; j++) {
        var url = tabs[j].url;
        if (url.indexOf('chrome') == 0 || url.indexOf('about') == 0) {
          continue;
        }
        chrome.tabs.executeScript(tabs[j].id, {
          file: 'deluminate.js',
          allFrames: true,
          matchAboutBlank: true,
          runAt: 'document_start'
        });
      }
    }
  });
};

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
        if (request['init']) {
          var url = sender.tab ? sender.tab.url : request['url'];
          var scheme = getDefaultScheme();
          var modifiers = getDefaultModifiers();
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
