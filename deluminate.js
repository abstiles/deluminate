var scheme_prefix;

function onExtensionMessage(request) {
  if (request.enabled) {
    document.documentElement.setAttribute('hc', scheme_prefix + request.scheme + ' ' + request.modifiers);
  } else {
    document.documentElement.removeAttribute('hc');
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
  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage({'init': true}, onExtensionMessage);
  document.addEventListener('keydown', onEvent, false);
}

init();
