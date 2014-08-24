function onForget() {
  resetSiteSchemes();
  loadSettingsDisplay();
  update();
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

function loadSettingsDisplay() {
  var settings = {
    'version': 1,
    'schemes': JSON.parse(localStorage['siteschemes']),
    'modifiers': JSON.parse(localStorage['sitemodifiers'])
  }
  $('settings').value = JSON.stringify(settings, null, 4);
}

function init() {
  $('forget').addEventListener('click', onForget, false);
  loadSettingsDisplay();
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);
