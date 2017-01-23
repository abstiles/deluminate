const fs = require('fs');
const path = require('path');

describe("Available options", () => {
  beforeAll(() => {
    var optionsHtml = fs.readFileSync(
      path.join(__dirname, "..", "options.html"));
    global.document = require('jsdom').jsdom(optionsHtml);
    global.window = document.defaultView;

    require('../common.js');
    require('../options.js');
  });

  it("can forget all site-specific settings", function() {
    setSiteScheme("options.deluminate.github.io", 'test-scheme');
    addSiteModifier("options.deluminate.github.io", 'test-mod');
    // changedFromDefault expects this variable to be set by popup.js.
    global.site = "options.deluminate.github.io";
    expect(changedFromDefault()).toBe(true);
    onForget();
    expect(changedFromDefault()).toBe(false);
  });
});
