var scheme_prefix;
var fullscreen_workaround;

function onExtensionMessage(request) {
  if (request.enabled && request.scheme != 'normal') {
    hc = scheme_prefix + request.scheme + ' ' + request.modifiers;
    if (window.devicePixelRatio > 1) {
      hc += ' hidpi';
    }
    document.documentElement.setAttribute('hc', hc);
    if (document.body != null &&
        document.getElementById("deluminate_fullscreen_workaround") == null)
      document.body.appendChild(fullscreen_workaround);
  } else {
    document.documentElement.removeAttribute('hc');
    workaround_div = document.getElementById("deluminate_fullscreen_workaround");
    if (workaround_div != null)
      workaround_div.remove();
  }
}

function onEvent(evt) {
  if (evt.keyCode == 122 /* F11 */ &&
      evt.shiftKey) {
    chrome.runtime.sendMessage({'toggle_global': true});
    evt.stopPropagation();
    evt.preventDefault();
    return false;
  }
  if (evt.keyCode == 123 /* F12 */ &&
      evt.shiftKey) {
    chrome.runtime.sendMessage({'toggle_site': true});
    evt.stopPropagation();
    evt.preventDefault();
    return false;
  }
  return true;
}

function init() {
  if (window == window.top) {
    scheme_prefix = '';
  } else {
    scheme_prefix = 'nested_';
  }
  fullscreen_workaround = document.createElement('div');
  fullscreen_workaround.id = scheme_prefix + "deluminate_fullscreen_workaround";

  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage({'init': true}, onExtensionMessage);
  document.addEventListener('keydown', onEvent, false);
  window.onload = function() {
    document.body.appendChild(fullscreen_workaround);
  }
}

init();
