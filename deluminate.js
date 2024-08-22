(function() {
let scheme_prefix;
let backdrop;
let animGifHandler;
let newImageHandler;
let rootWatcher;
const rootAttribute = "hc";

function onExtensionMessage(request, sender, sendResponse) {
  if (chrome.runtime.lastError) {
    console.log(`Failed to communicate init request`);
  }
  if (request.target === 'offscreen') return;
  if (request.pingTab) return;
  if (request['manual_css']) {
    addCSSLink();
    return;
  }
  if (rootWatcher) {
    rootWatcher.disconnect();
  }
  if (request.enabled && request.scheme != 'normal') {
    const hc = scheme_prefix + request.scheme + ' ' + request.modifiers.join(' ');
    document.documentElement.setAttribute(rootAttribute, hc);
    rootWatcher = new MutationObserver((mutationList) => {
      if (checkDisconnected()) return;
      for (const mutation of mutationList) {
        if (mutation.type === "attributes" && mutation.attributeName === rootAttribute) {
          const newValue = document.documentElement.getAttribute(rootAttribute);
          if (newValue === null) {
            document.documentElement.setAttribute(rootAttribute, hc);
          }
        }
      }
    });
    rootWatcher.observe(document.documentElement, {attributes: true});
    setupFullscreenWorkaround();
  } else {
    document.documentElement.removeAttribute(rootAttribute);
    removeFullscreenWorkaround();
  }
  // Enable advanced image recognition on invert modes except "invert all
  // images" mode.
  if (request.enabled
      && request.scheme.indexOf("delumine") >= 0
      && request.scheme.indexOf("delumine-all") < 0
      && request.modifiers.indexOf("ignorebg") < 0
  ) {
    afterDomLoaded(restartDeepImageProcessing);
    newImageHandler.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } else {
    newImageHandler.disconnect();
  }
  if (request.modifiers.indexOf("ignorebg") >= 0) {
    newImageHandler.disconnect();
    afterDomLoaded(() => {
      for (const elem of document.querySelectorAll('[deluminate_imageType]')) {
        elem.removeAttribute('deluminate_imageType');
      }
    });
  }
  if (request.enabled
      && request.scheme.indexOf("delumine") >= 0
      && request.modifiers.indexOf("dynamic") >= 0
  ) {
    afterDomLoaded(() => {
      detectAlreadyDark();
      backdrop.style.display = "none";
    });
  } else if (request.enabled) {
    afterDomLoaded(() => {
      backdrop.style.display = "none";
    });
  }
  if (request.enabled && request.settings.detect_animation === 'enabled' &&
      request.scheme == 'delumine-smart') {
    afterDomLoaded(() => {
      Array.prototype.forEach.call(
        document.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
        detectAnimatedGif);
      animGifHandler.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  } else {
    animGifHandler.disconnect();
  }
  if (sendResponse) {
    sendResponse();
  }
}

function currentPageSettings() {
  return new Set(
    (document.documentElement.getAttribute(rootAttribute) ?? "")
      .split(" ").slice(1)
  );
}

function addCSSLink() {
  /* Add CSS in a way that still works on chrome URLs. */
  const cssURL = chrome.runtime.getURL('deluminate.css');
  const selector = 'link[href="' + cssURL + '"]'
  if (document.querySelector(selector) !== null) {
    return; // Don't re-add if it's already there.
  }
  const link = document.createElement('link');
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
    // If in dynamic mode, let the dynamic handler remove this page blocker.
    if (!currentPageSettings().has("dynamic")) {
      backdrop.style.display = "none";
    }
  });
}

function removeFullscreenWorkaround() {
  removeById('deluminate_backdrop');
}

function removeById(id) {
  const element = document.getElementById(id);
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
  for (let i = 0; i < needleList.length; ++i) {
    if (haystack.indexOf(needleList[i]) >= 0) {
      return true;
    }
  }
  return false;
}

function markCssImages(tag) {
  const bgImage = window.getComputedStyle(tag)['background-image'];
  let imageType;
  if (containsAny(bgImage, ['data:image/png', '.png', '.PNG'])) {
    imageType = 'png';
  } else if (containsAny(bgImage, ['.gif', '.GIF'])) {
    imageType = 'gif';
  } else if (containsAny(bgImage,
      ['data:image/jpeg', '.jpg', '.JPG', '.jpeg', '.JPEG'])) {
    imageType = 'jpg';
  } else if (containsAny(bgImage,
      ['data:image/svg', '.svg', '.SVG'])) {
    imageType = 'svg';
  } else if (containsAny(bgImage,
      ['data:image/webp', '.webp'])) {
    imageType = 'webp';
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

/*
function getPixels2d(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function getPixelsWebGL(canvas) {
  const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!context) return null;
  const pixels = new Uint8ClampedArray(context.drawingBufferWidth * context.drawingBufferHeight * 4);
  await new Promise(resolve => requestAnimationFrame(resolve));
  context.readPixels(0, 0, context.drawingBufferWidth,
    context.drawingBufferHeight, context.RGBA, context.UNSIGNED_BYTE,
    pixels,
  );
  return pixels;
}

async function classifyCanvasColor(canvas) {
  const pixels = canvas.getContext("2d") ? getPixels2d(canvas)
    : canvas.getContext('webgl2') ? await getPixelsWebGL(canvas)
    : canvas.getContext('webgl') ? await getPixelsWebGL(canvas)
    : null
    ;
  if (!pixels) return null;

  const pixelTypes = [0, 0, 0];
  for (let i = 0; i < pixels.length - 3; i += 4) {
    const pixelType = colorValenceRaw(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    pixelTypes[pixelType + 1]++;
  }
  return (pixelTypes[2] > pixelTypes[0] + pixelTypes[1]) ? "light"
    : (pixelTypes[0] > pixelTypes[1] + pixelTypes[2]) ? "dark"
    : null
    ;
}
/**/

let deepImageProcessingComplete = false;
function deepImageProcessing() {
  if (deepImageProcessingComplete) return;
  Array.prototype.forEach.call(
    document.querySelectorAll('body *:not([style*="url"])'),
    markCssImages);
  deepImageProcessingComplete = true;
}

function restartDeepImageProcessing() {
  deepImageProcessingComplete = false;
  deepImageProcessing();
}

let detectAlreadyDarkComplete = false;
function detectAlreadyDark() {
  if (detectAlreadyDarkComplete) return;
  const textColor = classifyTextColor();
  if (textColor === "light") {
    // Light text means dark mode... probably.
    document.documentElement.setAttribute('looks-dark', '');
  } else if (textColor !== "dark" && checksPreferredScheme()) {
    document.documentElement.setAttribute('looks-dark', '');
  } else {
    document.documentElement.removeAttribute('looks-dark');
  }
  detectAlreadyDarkComplete = true;
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

const grayMargin = 64;
const alphaFactor = (255 + grayMargin) / 255;
// Cheap and simple calculation to classify colors as light, dark or ambiguous.
// Return -1 for dark, 0 for gray, 1 for light.
function colorValence(color) {
  return colorValenceRaw(...colorToRGBA(color));
}

function colorValenceRaw(r, g, b, a) {
  // Simple YIQ luminance calculation, scaled to (255 * 3) for convenience.
  const lum = ((r*229)+(g*449)+(b*87))/255;
  // Alpha transparency widens the effective gray range from the middle third
  // (gray margin excluded) at 100% opaque to the whole range at 0% opaque.
  const alphaRange = a * alphaFactor;
  const grayMin = alphaRange, grayMax = (255 * 3) - alphaRange;
  return lum < grayMin ? -1
    : lum > grayMax ? 1
    : 0
    ;
}

function classifyTextColor() {
  const paras = new Set(document.querySelectorAll('p:not(footer *)'));
  // Text with line breaks is *probably* basic writing and not fancy labels.
  for (const br of document.querySelectorAll('br:not(footer *)')) {
    paras.add(br.parentElement);
  }
  const windowHeight = window.innerHeight;
  const charTypes = [0, 0, 0];
  let total = 0;
  for (const p of paras) {
    const {color, display, visibility} = getComputedStyle(p);
    if (!color || display === "none" || visibility !== "visible") continue;
    const {width = 0, height = 0, top = 0} = p.getBoundingClientRect();
    if (width * height <= 0 || top > windowHeight) continue;
    const text = p.textContent;
    charTypes[colorValence(color) + 1] += text.length;
    total += text.length;
    // Arbitrarily chosen good-enough threshold.
    if (total > 4096) break;
  }

  // If the previous selectors didn't find much of the page's text, use a
  // treeWalker.
  if (total <= 4096
      && total < (document.documentElement.textContent.length * 0.1)
  ) {
    const treeWalker = document.createTreeWalker(
      document.querySelector("body"),
      NodeFilter.SHOW_TEXT,
    );

    while (treeWalker.nextNode()) {
      const text = treeWalker.currentNode;
      const elem = text.parentElement;
      const {color, display, visibility} = getComputedStyle(elem);
      if (!color || display === "none" || visibility !== "visible") continue;
      const {width = 0, height = 0, top = 0} = elem.getBoundingClientRect();
      if (width * height <= 0 || top > windowHeight) continue;
      charTypes[colorValence(color) + 1] += text.length;
      total += text.length;
      // Arbitrarily chosen good-enough threshold.
      if (total > 4096) break;
    }
  }
  // If light text is a supermajority of the text, we'll say this page uses
  // light text overall.
  return (charTypes[2] > charTypes[0] + charTypes[1]) ? "light"
    : (charTypes[0] > charTypes[1] + charTypes[2]) ? "dark"
    : null
    ;
}

function checksPreferredScheme() {
  for (const css of document?.styleSheets ?? []) {
    try {
      for (const m of css.media ?? []) {
        if (m.includes("prefers-color-scheme")) {
          return true;
        }
      }
      const cssRules = css.rules;
      for (const rule of cssRules) {
        for (const m of rule.media ?? []) {
          if (m.includes("prefers-color-scheme")) {
            return true;
          }
        }
      }
    } catch {
      // Exceptions thrown here for CORS security errors..
    }
  }
  return false;
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

  animGifHandler = new MutationObserver(function(mutations) {
    if (checkDisconnected()) return;
    for(let i=0; i<mutations.length; ++i) {
      for(let j=0; j<mutations[i].addedNodes.length; ++j) {
        const newTag = mutations[i].addedNodes[j];
        if (newTag.querySelectorAll) {
          Array.prototype.forEach.call(
            newTag.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
            detectAnimatedGif);
        }
      }
    }
  });

  newImageHandler = new MutationObserver(function(mutations) {
    if (checkDisconnected()) return;
    for(let i=0; i<mutations.length; ++i) {
      for(let j=0; j<mutations[i].addedNodes.length; ++j) {
        const newTag = mutations[i].addedNodes[j];
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
  const watchers = [animGifHandler, newImageHandler, rootWatcher];
  for (const watcher of watchers) {
    if (watcher?.disconnect) {
      watcher.disconnect();
    }
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

const colorToRGBA = (function() {
  // Use a canvas to normalize colors for computing.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});

  const cache = {};
  function memoize(f) {
    return (key) => {
      if (!(key in cache)) {
        cache[key] = f(key);
      }
      return cache[key];
    }
  }

  return memoize(function(c) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
})();

init();
})();
