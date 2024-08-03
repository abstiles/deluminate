var scheme_prefix;
var backdrop;
var animGifHandler;
var newImageHandler;
var deluminateFullyInitialized = false;

function onExtensionMessage(request) {
  if (chrome.runtime.lastError) {
    console.log(`Failed to communicate init request`);
  }
  if (request.target === 'offscreen') return;
  deluminateFullyInitialized = true;
  if (request['manual_css']) {
    addCSSLink();
    return;
  }
  if (request.enabled && request.scheme != 'normal') {
    hc = scheme_prefix + request.scheme + ' ' + request.modifiers;
    document.documentElement.setAttribute('hc', hc);
    setupFullscreenWorkaround();
  } else {
    document.documentElement.removeAttribute('hc');
    removeFullscreenWorkaround();
  }
  // Enable advanced image recognition on invert modes except "invert all
  // images" mode.
  if (request.enabled
      && request.scheme.indexOf("delumine") >= 0
      && request.scheme.indexOf("delumine-all") < 0) {
    newImageHandler.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } else {
      newImageHandler.disconnect();
  }
  if (request.enabled && request.settings.detect_animation === 'enabled' &&
      request.scheme == 'delumine-smart') {
    Array.prototype.forEach.call(
      document.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
      detectAnimatedGif);
    animGifHandler.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } else {
    animGifHandler.disconnect();
  }
}

function addCSSLink() {
  /* Add CSS in a way that still works on chrome URLs. */
  var cssURL = chrome.runtime.getURL('deluminate.css');
  var selector = 'link[href="' + cssURL + '"]'
  if (document.querySelector(selector) !== null) {
    return; // Don't re-add if it's already there.
  }
  var link = document.createElement('link');
  link.href = cssURL;
  link.rel = 'stylesheet';
  link.media = 'screen';
  document.documentElement.insertBefore(link, null);
}

function setupFullscreenWorkaround() {
  // Skip adding this in nested iframes
  if (window != window.top) return;
  if (document.getElementById("deluminate_backdrop") == null) {
    addBackdrop();
  }
}

function addBackdrop() {
  // This results in a more instant, if imperfect, inversion. Injected CSS
  // apparently takes a moment to be processed.
  backdrop.style.background = "black";
  backdrop.style.position = 'fixed';
  backdrop.style.top = 0;
  backdrop.style.left = 0;
  backdrop.style.height = '100vh';
  backdrop.style.width = '100vw';
  backdrop.style.pointerEvents = 'none';
  backdrop.style['z-index'] = 2147483647;

  /* Adding to the root node rather than body so it is not subject to absolute
   * positioning of the body. */
  document.documentElement.appendChild(backdrop);
  afterDomLoaded(() => {
    backdrop.style.display = "none";
  });
}

function removeFullscreenWorkaround() {
  removeById('deluminate_backdrop');
}

function removeById(id) {
  element = document.getElementById(id);
  if (element !== null) {
    element.remove();
  }
}

function onEvent(evt) {
  if (checkDisconnected()) return true;
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

function containsAny(haystack, needleList) {
  for (var i = 0; i < needleList.length; ++i) {
    if (haystack.indexOf(needleList[i]) >= 0) {
      return true;
    }
  }
  return false;
}

function markCssImages(tag) {
  var bgImage = window.getComputedStyle(tag)['background-image'];
  var imageType;
  if (containsAny(bgImage, ['data:image/png', '.png', '.PNG'])) {
    imageType = 'png';
  } else if (containsAny(bgImage, ['.gif', '.GIF'])) {
    imageType = 'gif';
  } else if (containsAny(bgImage,
      ['data:image/jpeg', '.jpg', '.JPG', '.jpeg', '.JPEG'])) {
    imageType = 'jpg';
  } else if (containsAny(bgImage, ['url', 'data:image'])) {
    imageType = 'unknown';
  }
  if (imageType) {
    tag.setAttribute('deluminate_imageType', imageType);
  } else {
    tag.removeAttribute('deluminate_imageType');
  }
}

function detectAnimatedGif(tag) {
  if (checkDisconnected()) return;
  chrome.runtime.sendMessage(
    { 'detect_gif': true
    , 'src': tag.src
    },
    {},
    function(result) {
      if (chrome.runtime.lastError) {
        console.log(`Failed to request gif detection`);
      }
      if (result) {
        tag.setAttribute('deluminate_imageType', 'animated gif');
      }
    });
}

function deepImageProcessing() {
  Array.prototype.forEach.call(
    document.querySelectorAll('body *:not([style*="url"])'),
    markCssImages);
}

function afterDomLoaded(cb) {
  if(document.readyState !== "loading") {
    cb();
  } else {
    document.addEventListener('DOMContentLoaded', cb);
  }
}

function log() {
  if (checkDisconnected()) return;
  const msg = Array.prototype.slice.call(arguments).join(' ');
  chrome.runtime.sendMessage({'log': msg});
}

function init() {
  if (window == window.top) {
    scheme_prefix = '';
  } else {
    scheme_prefix = 'nested_';
  }
  log("Initializing.", scheme_prefix);

  backdrop = document.createElement('div');
  backdrop.id = scheme_prefix + "deluminate_backdrop";

  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage(
    {'init': true, 'url': window.document.baseURI},
    {},
    onExtensionMessage,
  );
  document.addEventListener('keydown', onEvent, false);
  afterDomLoaded(deepImageProcessing);

  animGifHandler = new MutationObserver(function(mutations, obs) {
    for(var i=0; i<mutations.length; ++i) {
      for(var j=0; j<mutations[i].addedNodes.length; ++j) {
        var newTag = mutations[i].addedNodes[j];
        if (newTag.querySelectorAll) {
          Array.prototype.forEach.call(
            newTag.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
            detectAnimatedGif);
        }
      }
    }
  });

  newImageHandler = new MutationObserver(function(mutations, obs) {
    if (checkDisconnected()) return;
    for(var i=0; i<mutations.length; ++i) {
      for(var j=0; j<mutations[i].addedNodes.length; ++j) {
        var newTag = mutations[i].addedNodes[j];
        if (newTag.querySelectorAll) {
          Array.prototype.forEach.call(
            newTag.querySelectorAll('*:not([style*="url"])'),
            markCssImages);
        }
      }
    }
  });

  setupFullscreenWorkaround();
}

function unloadAll() {
  if (animGifHandler?.disconnect) {
    animGifHandler.disconnect();
  }
  if (newImageHandler?.disconnect) {
    newImageHandler.disconnect();
  }
  document.removeEventListener('keydown', onEvent, false);
}

function checkDisconnected() {
  if (!chrome.runtime?.id) {
    unloadAll();
    return true;
  }
  return false;
}

init();
