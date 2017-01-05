var scheme_prefix;
var fullscreen_workaround;
var animGifHandler;
var resize_observer;
var background_observer;
var size_checker_interval;
var deluminateFullyInitialized = false;

function onExtensionMessage(request) {
  deluminateFullyInitialized = true;
  if (request['manual_css']) {
    addCSSLink();
    return;
  }
  if (request.enabled && request.scheme != 'normal') {
    hc = scheme_prefix + request.scheme + ' ' + request.modifiers;
    if (request.settings.hw_accel === 'enabled' ||
        request.settings.hw_accel !== 'disabled' && window.devicePixelRatio > 1) {
      hc += ' hw_accel';
    }
    document.documentElement.setAttribute('hc', hc);
    if (request.scheme.indexOf("delumine") >= 0) {
      // This results in a more instant, if imperfect, inversion. Injected CSS
      // apparently takes a moment to be processed.
      var oldStyle = document.documentElement.getAttribute('style');
      document.documentElement.setAttribute(
        'style', "filter: hue-rotate(180deg) invert(100%)");
      afterDomLoaded(() => {
        if (oldStyle !== null) {
          document.documentElement.setAttribute('style', oldStyle);
        } else {
          document.documentElement.removeAttribute('style');
        }
      });
    }
    setupFullscreenWorkaround();
  } else {
    document.documentElement.removeAttribute('hc');
    removeFullscreenWorkaround();
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
  var cssURL = chrome.extension.getURL('deluminate.css');
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
  if (document.getElementById("deluminate_fullscreen_workaround") == null) {
    addFullscreenWorkaround();
  } else {
    resetFullscreenWorkaroundBackground();
    resetFullscreenWorkaroundHeight();
  }
}

function addFullscreenWorkaround() {
  fullscreen_workaround.style.position = 'absolute';
  fullscreen_workaround.style.top = 0;
  fullscreen_workaround.style.left = 0;
  fullscreen_workaround.style.width = '100%';
  fullscreen_workaround.style.height = '100%';
  fullscreen_workaround.style.display = 'block';
  fullscreen_workaround.style['z-index'] = -2147483648;

  resetFullscreenWorkaroundBackground();
  resetFullscreenWorkaroundHeight();
  /* Adding to the root node rather than body so it is not subject to absolute
   * positioning of the body. */
  document.documentElement.appendChild(fullscreen_workaround);
  // Need to periodically reset the size (e.g., for loaded images)
  size_checker_interval = setInterval(resetFullscreenWorkaroundHeight, 1000);
  resize_observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  background_observer.observe(document.documentElement, {
    childList: true,
    attributes: true
  });
  afterDomLoaded(function() {
    resetFullscreenWorkaroundBackground();
    resetFullscreenWorkaroundHeight();
    background_observer.observe(document.head, {
      childList: true,
      attributes: true,
      subtree: true,
      characterData: true
    });
    background_observer.observe(document.body, {
      attributes: true
    });
  });
}

function removeFullscreenWorkaround() {
  var workaround_div;
  resize_observer.disconnect();
  clearInterval(size_checker_interval);
  background_observer.disconnect();
  workaround_div = document.getElementById("deluminate_fullscreen_workaround");
  if (workaround_div != null) {
    workaround_div.remove();
  }
}

function resetFullscreenWorkaroundHeight() {
  var body_scroll_height;
  try {
    body_scroll_height = document.body.scrollHeight;
  } catch(err) {
    body_scroll_height = 0;
  }
  var page_height = Math.max(body_scroll_height,
                             document.documentElement.clientHeight);
  var body_scroll_width;
  try {
    body_scroll_width = document.body.scrollWidth;
  } catch(err) {
    body_scroll_width = 0;
  }
  var page_width = Math.max(body_scroll_width,
                            document.documentElement.clientWidth);
  fullscreen_workaround.style.height = page_height + 'px';
  fullscreen_workaround.style.width = page_width + 'px';
}

function calculateBackground() {
  if (!deluminateFullyInitialized) {
    return 'black';
  }
  var root_style = window.getComputedStyle(document.documentElement);
  if (!domContentLoaded) {
    // We're still pre-DOM-load, so keep things black.
    if (root_style.filter.indexOf('invert') >= 0) {
      return 'white';
    } else {
      return 'black';
    }
  }
  var body_style = window.getComputedStyle(document.body);
  var no_color = 'rgba(0, 0, 0, 0)';
  var no_image = 'none';
  var new_style_item = document.createElement('div');
  if (root_style.backgroundColor != no_color ||
      root_style.backgroundImage != no_image) {
    new_style_item.style.background = root_style.background;
  } else {
    new_style_item.style.background = body_style.background;
  }
  /* Force an unspecified background color to white so it gets inverted to
   * black properly. */
  if (new_style_item.style.backgroundColor == no_color) {
    new_style_item.style.backgroundColor = 'white';
  }
  return new_style_item.style.background;
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
  }
  if (imageType) {
    tag.setAttribute('deluminate_imageType', imageType);
  }
}

function detectAnimatedGif(tag) {
  chrome.runtime.sendMessage(
    { 'detect_gif': true
    , 'src': tag.src
    },
    function(result) {
      if (result.is_animated) {
        tag.setAttribute('deluminate_imageType', 'animated gif');
      }
    });
}

function deepImageProcessing() {
  Array.prototype.forEach.call(
    document.querySelectorAll('body *:not([style*="url"])'),
    markCssImages);
}

var domContentLoaded = false;
function domLoaded() {
  domContentLoaded = true;
}

function afterDomLoaded(cb) {
  if(domContentLoaded) {
    cb();
  } else {
    document.addEventListener('DOMContentLoaded', cb);
  }
}

function log() {
  chrome.runtime.sendMessage({'log':
                             Array.prototype.slice.call(arguments).join(' ')});
}

function resetFullscreenWorkaroundBackground() {
  fullscreen_workaround.style.background = calculateBackground();
  markCssImages(fullscreen_workaround);
}

function init() {
  if (window == window.top) {
    scheme_prefix = '';
  } else {
    scheme_prefix = 'nested_';
  }
  log("Initializing.", scheme_prefix);

  fullscreen_workaround = document.createElement('div');
  fullscreen_workaround.id = scheme_prefix + "deluminate_fullscreen_workaround";

  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage({'init': true, 'url': window.document.baseURI},
      onExtensionMessage);
  document.addEventListener('keydown', onEvent, false);
  document.addEventListener('DOMContentLoaded', domLoaded);
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

  resize_observer = new MutationObserver(function(mutations, obs) {
    if (mutations.length > 0) {
      resetFullscreenWorkaroundHeight();
    }
  });

  background_observer = new MutationObserver(function(mutations, obs) {
    if (mutations.length > 0) {
      resetFullscreenWorkaroundBackground();
    }
  });

  window.addEventListener('resize', resetFullscreenWorkaroundHeight);
  setupFullscreenWorkaround();
}

init();
