(function() {
"use strict";

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.target !== 'offscreen') return;
    if (request.action === 'migrate') {
      const copyLocalStorage = {};
      Object.assign(copyLocalStorage, localStorage);
      sendResponse({localStorage: copyLocalStorage});
    }
  }
);

})();
