var scheme_prefix;
var fullscreen_workaround;
var backdrop;
var animGifHandler;
var newImageHandler;
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
    document.documentElement.setAttribute('hc', hc);
    if (request.scheme.indexOf("delumine") >= 0) {
      injectInstantInversion();
    }
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

function injectInstantInversion() {
  // This results in a more instant, if imperfect, inversion. Injected CSS
  // apparently takes a moment to be processed.
  document.documentElement.style.filter = "hue-rotate(180deg) invert(100%)";
  afterDomLoaded(() => {
    // Restore filter control to the injected CSS.
    document.documentElement.style.filter = "";
  });
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
  fullscreen_workaround.style['z-index'] = -2147483647;

  backdrop.style.position = 'fixed';
  backdrop.style.top = 0;
  backdrop.style.left = 0;
  backdrop.style.height = '100vh';
  backdrop.style.width = '100vw';
  backdrop.style['z-index'] = -2147483648;

  resetFullscreenWorkaroundBackground();
  resetFullscreenWorkaroundHeight();
  /* Adding to the root node rather than body so it is not subject to absolute
   * positioning of the body. */
  document.documentElement.appendChild(fullscreen_workaround);
  document.documentElement.appendChild(backdrop);
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
  removeById('deluminate_fullscreen_workaround');
  removeById('deluminate_backdrop');
}

function removeById(id) {
  element = document.getElementById(id);
  if (element !== null) {
    element.remove();
  }
}

function getScrollbarWidth() {
  const outer = document.createElement('div');
  const inner = document.createElement('div');

  outer.style.visibility = 'hidden';
  outer.style.width = '100px';
  inner.style.width = '100%';
  outer.appendChild(inner);
  document.documentElement.appendChild(outer);

  const widthWithoutScrollbar = outer.offsetWidth;
  outer.style.overflow = 'scroll';
  const widthWithScrollbar = inner.offsetWidth;
  document.documentElement.removeChild(outer);
  return (widthWithoutScrollbar - widthWithScrollbar);
}

function detectScrollbars(element) {
  return {
    'vertical': element.scrollHeight > element.clientHeight,
    'horizontal': element.scrollWidth > element.clientWidth,
  }
}

function getVisibleRect() {
  // One of the following strategies should give the right value for the
  // actually visible region of the document:
  var innerWindow = getWindowMinusScrollbars();
  var documentClient = getDocumentClientRegion();

  // Take the smallest value among the strategies for determining visible
  // region to avoid the "flashing scrollbar" phenomenon.
  var visibleHeight = Math.min(innerWindow.height, documentClient.height);
  var visibleWidth = Math.min(innerWindow.width, documentClient.width);

  return {
    'top': window.scrollY,
    'left': window.scrollX,
    'height': visibleHeight,
    'width': visibleWidth,
  }
}

function getWindowMinusScrollbars() {
  // Get the visible area by grabbing the inner window size and compensating
  // for any scrollbars present. This works to identify the real visible
  // region in most cases, but fails for Windows 8+.
  var scrollbarsPresent = detectScrollbars(document.documentElement);
  return {
    'height': window.innerHeight - (scrollbarsPresent.horizontal
                                   ? scw
                                   : 0),
    'width': window.innerWidth - (scrollbarsPresent.vertical
                                 ? scw
                                 : 0),
  };
}

function getDocumentClientRegion() {
  // Get the visible area based on what the document reports as its client
  // dimensions, which usually looks like the visible region minus the
  // scrollbars, but this has been known to report the dimensions *including*
  // scrollbars on Linux.
  return {
    'height': document.documentElement.clientHeight,
    'width': document.documentElement.clientWidth,
  };
}

var scw = getScrollbarWidth();

function resetFullscreenWorkaroundHeight() {
  // We need to calculate the size of the page _minus_ the current size of the
  // fullscreen workaround div, so that an initial large size does not
  // permanently peg the page at that minimum size.
  //
  // First, reduce the height of the fullscreen workaround div to the smallest
  // it can be while still covering the viewable region.
  var visibleRegion = getVisibleRect();
  var lowestVisiblePoint = visibleRegion.top + visibleRegion.height;
  var rightestVisiblePoint = visibleRegion.left + visibleRegion.width;
  fullscreen_workaround.style.height = lowestVisiblePoint + 'px';
  fullscreen_workaround.style.width = rightestVisiblePoint + 'px';

  // Yield to the renderer, then reset the size to the calculated region.
  setTimeout(() => {
    var body_scroll_height;
    try {
      body_scroll_height = document.body.scrollHeight;
    } catch(err) {
      body_scroll_height = 0;
    }
    var page_height = Math.max(body_scroll_height,
                               document.documentElement.scrollHeight,
                               document.documentElement.clientHeight);
    var body_scroll_width;
    try {
      body_scroll_width = document.body.scrollWidth;
    } catch(err) {
      body_scroll_width = 0;
    }
    var page_width = Math.max(body_scroll_width,
                              document.documentElement.scrollWidth,
                              document.documentElement.clientWidth);

    fullscreen_workaround.style.height = page_height + 'px';
    fullscreen_workaround.style.width = page_width + 'px';
  }, 0);
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
  } else {
    new_style_item.style.backgroundColor =
      computeEffectiveCanvasColor(new_style_item.style.backgroundColor);
  }
  return new_style_item.style.background;
}

function computeEffectiveCanvasColor(color) {
  var rgbaColorRegex = /rgba\((\d+), (\d+), (\d+), (\d*\.?\d+)\)/;
  var match = rgbaColorRegex.exec(color);
  if (!match) {
    // If this regex doesn't match, it has no alpha component, so it's fine.
    return color;
  }
  // Compute the effective canvas color by simulating the blending (due to an
  // alpha channel) against the default white background. This must be
  // calculated manually.
  var [_, r, g, b, a] = match.map(Number);
  // Calculate the alpha-weighted blend against a white background.
  [r, g, b] = [r, g, b].map(channel => {
    var channelComponent = channel * a;
    var whiteComponent = 255 * (1 - a);
    var result = Math.round(channelComponent + whiteComponent);
    var clampedTo8bit = result <= 0   ? 0
                      : result >= 255 ? 255
                      : result
    return clampedTo8bit;
  });
  return `rgb(${r}, ${g}, ${b})`;
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
  backdrop = document.createElement('div');
  backdrop.id = scheme_prefix + "deluminate_backdrop";

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

  newImageHandler = new MutationObserver(function(mutations, obs) {
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
