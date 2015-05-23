var scheme_prefix;
var fullscreen_workaround;
var animGifHandler;

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

function addFullscreenWorkaround() {
  // Skip adding this in nested iframes
  if (window != window.top) return;
  var style;
  /* If the DOM is not loaded, wait before adding the workaround to it.
   * Otherwise add it immediately. */
  if (document.body == null) {
    document.addEventListener('DOMContentLoaded', function() {
      style = window.getComputedStyle(document.documentElement);
      fullscreen_workaround.style.backgroundColor = style['background-color'];
      if (document.documentElement.scrollHeight <
          document.documentElement.clientHeight) {
        fullscreen_workaround.setAttribute('enabled', true);
      } else {
        fullscreen_workaround.setAttribute('enabled', false);
      }
      document.body.appendChild(fullscreen_workaround);
    });
  } else if (document.body != null &&
      document.getElementById("deluminate_fullscreen_workaround") == null) {
    style = window.getComputedStyle(document.documentElement);
    fullscreen_workaround.style.backgroundColor = style['background-color'];
    if (document.documentElement.scrollHeight <
        document.documentElement.clientHeight) {
      fullscreen_workaround.setAttribute('enabled', true);
    } else {
      fullscreen_workaround.setAttribute('enabled', false);
    }
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

function init() {
  if (window == window.top || !window.top.injected) {
    scheme_prefix = '';
    window.top.injected = true;
  } else {
    scheme_prefix = 'nested_';
  }

  setTimeout(function () {
    /* Add CSS in a way that is slightly faster than injectCSS. */
    var link = document.createElement('link');
    link.href =  chrome.extension.getURL('deluminate.css');
    link.rel = 'stylesheet';
    link.media = 'screen';
    document.documentElement.insertBefore(link, null);
  }, 50);

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
  document.addEventListener('DOMContentLoaded', deepImageProcessing);
  window.addEventListener('resize', function() {
    if (document.documentElement.scrollHeight <
        document.documentElement.clientHeight) {
      fullscreen_workaround.setAttribute('enabled', true);
    } else {
      fullscreen_workaround.setAttribute('enabled', false);
    }
  }, false);

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
}

init();
