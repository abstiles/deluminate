var scheme_prefix;
var fullscreen_workaround;
var animGifHandler;
var resize_observer;
var background_observer;
var size_checker_interval;

function onExtensionMessage(request) {
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
  /* If the DOM is not loaded, wait before adding the workaround to it.
   * Otherwise add it immediately. */
  if (document.body == null) {
    document.addEventListener('DOMContentLoaded', function() {
      addFullscreenWorkaround();
    });
  } else if (document.body != null &&
      document.getElementById("deluminate_fullscreen_workaround") == null) {
    addFullscreenWorkaround();
  }
}

function addFullscreenWorkaround() {
  fullscreen_workaround.style.background = calculateBackground();
  resetFullscreenWorkaroundHeight();
  /* Adding to the root node rather than body so it is not subject to absolute
   * positioning of the body. */
  document.documentElement.appendChild(fullscreen_workaround);
  markCssImages(fullscreen_workaround);
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
  background_observer.observe(document.head, {
    childList: true,
    attributes: true,
    subtree: true,
    characterData: true
  });
  background_observer.observe(document.body, {
    attributes: true
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
  fullscreen_workaround.style.height = 0;
  var new_height = Math.max(document.body.scrollHeight,
                            document.documentElement.clientHeight)
  var new_width = Math.max(document.body.scrollWidth,
                           document.documentElement.clientWidth)
  fullscreen_workaround.style.height = new_height + 'px';
  fullscreen_workaround.style.width = new_width + 'px';
}

function calculateBackground() {
  var no_color = 'rgba(0, 0, 0, 0)';
  var no_image = 'none';
  var new_style_item = document.createElement('div');
  var root_style = window.getComputedStyle(document.documentElement);
  var body_style = window.getComputedStyle(document.body);
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

function isAnimatedGif(src, cb) {
  var request = new XMLHttpRequest();
  if (src.indexOf('data:') == 0) {
    return;
  }
  request.open('GET', src, true);
  request.responseType = 'arraybuffer';
  request.addEventListener('load', function () {
    var arr = new Uint8Array(request.response),
      i, len, length = arr.length, frames = 0;

    // make sure it's a gif (GIF8)
    if (arr[0] !== 0x47 || arr[1] !== 0x49 ||
        arr[2] !== 0x46 || arr[3] !== 0x38) {
      cb(false);
      return;
    }

    //ported from php http://www.php.net/manual/en/function.imagecreatefromgif.php#104473
    //an animated gif contains multiple "frames", with each frame having a
    //header made up of:
    // * a static 4-byte sequence (\x00\x21\xF9\x04)
    // * 4 variable bytes
    // * a static 2-byte sequence (\x00\x2C) (some variants may use \x00\x21 ?)
    // We read through the file til we reach the end of the file, or we've found
    // at least 2 frame headers
    for (i=0, len = length - 9; i < len; ++i) {
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
    cb(frames > 1);
  });
  request.send();
}

function markCssImages(tag) {
  var bgImage = window.getComputedStyle(tag)['background-image'];
  var imageType;
  if (containsAny(bgImage, ['data:image/png', '.png', '.PNG'])) {
    imageType = 'png';
  } else if (containsAny(bgImage, ['data:image/gif', '.gif', '.GIF'])) {
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
  isAnimatedGif(tag.src, function(isAnimated) {
    if (isAnimated) {
      tag.setAttribute('deluminate_imageType', 'animated gif');
    }
  });
}

function deepImageProcessing() {
  Array.prototype.forEach.call(
    document.querySelectorAll('body *:not([style*="url"])'),
    markCssImages);
}

function log() {
  chrome.runtime.sendMessage({'log':
                             Array.prototype.slice.call(arguments).join(' ')});
}

function jsonify(o) {
  var cache = [];
  s = JSON.stringify(o, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Circular reference found, discard key
              return;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  });
  cache = null;
  return s;
}

function init() {
  if (window == window.top || !window.top.injected) {
    scheme_prefix = '';
    window.top.injected = true;
  } else {
    scheme_prefix = 'nested_';
  }
  log("Initializing.", scheme_prefix);

  if (window.top.document.baseURI.indexOf("chrome-extension") == 0) {
    addCSSLink();
  }

  fullscreen_workaround = document.createElement('div');
  fullscreen_workaround.id = scheme_prefix + "deluminate_fullscreen_workaround";

  chrome.runtime.onMessage.addListener(onExtensionMessage);
  chrome.runtime.sendMessage({'init': true, 'url': window.top.document.baseURI},
      onExtensionMessage);
  document.addEventListener('keydown', onEvent, false);
  document.addEventListener('DOMContentLoaded', deepImageProcessing);

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
      fullscreen_workaround.style.background = calculateBackground();
      markCssImages(fullscreen_workaround);
    }
  });

  window.addEventListener('resize', resetFullscreenWorkaroundHeight);
}

init();
