var scheme_prefix;
var fullscreen_workaround;

function onExtensionMessage(request) {
  if (request.enabled && request.scheme != 'normal') {
    hc = scheme_prefix + request.scheme + ' ' + request.modifiers;
    if (request.settings.hw_accel === 'enabled' ||
        request.settings.hw_accel !== 'disabled' && window.devicePixelRatio > 1) {
      hc += ' hw_accel';
    }
    document.documentElement.setAttribute('hc', hc);
    addFullscreenWorkaround();
  } else {
    document.documentElement.removeAttribute('hc');
    workaround_div = document.getElementById("deluminate_fullscreen_workaround");
    if (workaround_div != null)
      workaround_div.remove();
  }
}

function addFullscreenWorkaround() {
  var style;
  /* If the DOM is not loaded, wait before adding the workaround to it.
   * Otherwise add it immediately. */
  if (document.body == null) {
    document.addEventListener('DOMContentLoaded', function() {
      style = window.getComputedStyle(document.documentElement);
      fullscreen_workaround.style.backgroundColor = style['background-color'];
      document.body.appendChild(fullscreen_workaround);
    });
  } else if (document.body != null &&
      document.getElementById("deluminate_fullscreen_workaround") == null) {
    style = window.getComputedStyle(document.documentElement);
    fullscreen_workaround.style.backgroundColor = style['background-color'];
    document.body.appendChild(fullscreen_workaround);
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
  if (window == window.top || !window.top.injected) {
    scheme_prefix = '';
    window.top.injected = true;
  } else {
    scheme_prefix = 'nested_';
  }

  /* Add CSS in a way that is slightly faster than injectCSS. */
  var link = document.createElement('link');
  link.href =  chrome.extension.getURL('deluminate.css');
  link.rel = 'stylesheet';
  document.documentElement.insertBefore(link, null);

  /* To reduce flicker, slam a black background in place ASAP. */
  var color = document.documentElement.style.backgroundColor;
  if (scheme_prefix != "nested_") {
    document.documentElement.style.backgroundColor = "#000";
  }
  /* Restore the original color when body elements appear. */
  var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
          if (mutation.target.nodeName == "BODY") {
              observer.disconnect();
              document.documentElement.style.backgroundColor = color || "";
          }
      });
  });
  if (document.body && document.body.firstChild) {
    document.documentElement.style.backgroundColor = color || "";
  } else {
    observer.observe(document, { childList: true, subtree: true });
  }

  fullscreen_workaround = document.createElement('div');
  fullscreen_workaround.id = scheme_prefix + "deluminate_fullscreen_workaround";

  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage({'init': true, 'url': window.top.document.baseURI},
      onExtensionMessage);
  document.addEventListener('keydown', onEvent, false);
}

init();
