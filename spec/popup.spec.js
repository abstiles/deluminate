const fs = require('fs');
const path = require('path');

chrome = {
  extension: {
    getBackgroundPage: function() {
      return {
        updateTabs: function() {}
      };
    }
  }
};

describe("Popup options", () => {
  beforeAll(() => {
    var optionsHtml = fs.readFileSync(
      path.join(__dirname, "..", "popup.html"));
    global.document = require('jsdom').jsdom(optionsHtml);
    global.window = document.defaultView;

    require('../common.js');
    require('../popup.js');
  });

  it("can set the current site settings as the default", function() {
    setSiteScheme('popup.deluminate.github.io', 'test-scheme');
    addSiteModifier('popup.deluminate.github.io', 'low-contrast');

    /* Have to reset onMakeDefault's closure of "site" to test this. */
    var site = 'popup.deluminate.github.io';
    var update = function() {};
    eval(String(onMakeDefault));
    onMakeDefault();

    expect(getDefaultScheme()).toEqual('test-scheme');
    expect(getDefaultModifiers()).toEqual('low-contrast');
  });

  it("reports site settings unchanged by default", function() {
    /* Have to reset onMakeDefault's closure of "site" to test this. */
    var site = 'popup.deluminate.github.io';
    eval(String(changedFromDefault));
    expect(changedFromDefault()).toBe(false);
  });

  it("reports site settings changed when a scheme is changed", function() {
    setSiteScheme("popup.deluminate.github.io", "test-scheme");
    /* Have to reset changedFromDefault's closure of "site" to test this. */
    var site = 'popup.deluminate.github.io';
    eval(String(changedFromDefault));
    expect(changedFromDefault()).toBe(true);
  });

  it("reports site settings changed when a modifier is changed", function() {
    addSiteModifier("popup.deluminate.github.io", 'low-contrast');
    /* Have to reset changedFromDefault's closure of "site" to test this. */
    var site = 'popup.deluminate.github.io';
    eval(String(changedFromDefault));
    expect(changedFromDefault()).toBe(true);
  });

  it("reports site settings unchanged after resetting them", function() {
    setSiteScheme("popup.deluminate.github.io", "test-scheme");
    addSiteModifier("popup.deluminate.github.io", 'low-contrast');
    /* Have to reset changedFromDefault's closure of "site" to test this. */
    var site = 'popup.deluminate.github.io';
    eval(String(changedFromDefault));
    expect(changedFromDefault()).toBe(true);
    resetSiteSchemes();
    resetSiteModifiers();
    expect(changedFromDefault()).toBe(false);
  });
});
