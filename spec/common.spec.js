require('../common.js');

const jsdom = require('jsdom')

describe("A stored bool getter", function() {
  beforeEach(function() {
    localStorage.setItem('presentTrue', true);
    localStorage.setItem('presentFalse', false);
    localStorage.setItem('presentNonBool', 'string, not a bool');
  });

  it("gets a boolean when present", function() {
    expect(getStoredBool('presentTrue')).toBe(true);
    expect(getStoredBool('presentFalse')).toBe(false);
  });

  it("gets false by default when not present", function() {
    expect(getStoredBool('notPresent')).toBe(false);
  });

  it("gets a specified default bool when not present", function() {
    expect(getStoredBool('notPresent', true)).toBe(true);
  });

  it("treats non-boolean values as not present", function() {
    expect(getStoredBool('presentNonBool', true)).toBe(true);
  });
});

describe("Global settings functions", function() {
  it("shows the extension is enabled by default", function() {
    expect(getEnabled()).toBe(true);
  });

  it("can disable the extension", function() {
    // Arg must be a string because mock cannot override key access notation.
    setEnabled('false')
    expect(getEnabled()).toBe(false);
  });

  it("can re-enable the extension", function() {
    // Arg must be a string because mock cannot override key access notation.
    setEnabled('false')
    expect(getEnabled()).toBe(false);
    // Arg must be a string because mock cannot override key access notation.
    setEnabled('true')
    expect(getEnabled()).toBe(true);
  });

  it("disables low contrast by default", function() {
    expect(getLowContrast()).toBe(false);
  });

  it("can enable low contrast", function() {
    // Arg must be a string because mock cannot override key access notation.
    setLowContrast('true');
    expect(getLowContrast()).toBe(true);
  });

  it("can disable low contrast", function() {
    // Arg must be a string because mock cannot override key access notation.
    setLowContrast('false');
    expect(getLowContrast()).toBe(false);
  });

  it("disables force text inversion by default", function() {
    expect(getForceText()).toBe(false);
  });

  it("can enable force text inversion", function() {
    // Arg must be a string because mock cannot override key access notation.
    setForceText('true');
    expect(getForceText()).toBe(true);
  });

  it("can disable force text inversion", function() {
    // Arg must be a string because mock cannot override key access notation.
    setForceText('false');
    expect(getForceText()).toBe(false);
  });

  it("disables killing backgrounds by default", function() {
    expect(getKillBackground()).toBe(false);
  });

  it("can enable killing backgrounds", function() {
    // Arg must be a string because mock cannot override key access notation.
    setKillBackground('true');
    expect(getKillBackground()).toBe(true);
  });

  it("can disable killing backgrounds", function() {
    // Arg must be a string because mock cannot override key access notation.
    setKillBackground('false');
    expect(getKillBackground()).toBe(false);
  });

  it("uses smart inversion by default", function() {
    expect(getDefaultScheme()).toBe('delumine-smart');
  });

  it("can modify the default scheme", function() {
    setDefaultScheme('new-scheme');
    expect(getDefaultScheme()).toBe('new-scheme');
  });

  it("can reset the default scheme to its default", function() {
    setDefaultScheme();
    expect(getDefaultScheme()).toBe('delumine-smart');
  });

  it("can assemble the default modifiers", function() {
    // Arg must be a string because mock cannot override key access notation.
    setLowContrast('true');
    setKillBackground('true');
    setForceText('true');
    var modifierString = getDefaultModifiers();
    expect(modifierString).toContain('low-contrast');
    expect(modifierString).toContain('force_text');
    expect(modifierString).toContain('kill_background');
  });

  it("can disassemble and save a set of default modifiers", function() {
    var newModifiers = 'low-contrast force_text kill_background';
    setDefaultModifiers(newModifiers);
    var modifierString = getDefaultModifiers();
    expect(modifierString).toContain('low-contrast');
    expect(modifierString).toContain('force_text');
    expect(modifierString).toContain('kill_background');

    setDefaultModifiers('not-a-real-modifier');
    modifierString = getDefaultModifiers();
    expect(modifierString).not.toContain('low-contrast');
    expect(modifierString).not.toContain('force_text');
    expect(modifierString).not.toContain('kill_background');
  });

  it("has no global settings by default", function() {
    expect(getGlobalSettings()).toEqual({});
  });

  it("can set arbitrary global settings", function() {
    setGlobalSetting('someSetting', 42);
    expect(getGlobalSettings().someSetting).toEqual(42);
    setGlobalSetting('someSetting', true);
    expect(getGlobalSettings().someSetting).toBe(true);
  });

  it("initially marks the settings page as not viewed", function() {
    expect(getSettingsViewed()).toBe(false);
  });

  it("can mark the settings page as viewed", function() {
    setSettingsViewed();
    // Must convert to string because mock cannot override key access notation.
    localStorage.settings_viewed = localStorage.settings_viewed.toString();
    expect(getSettingsViewed()).toBe(true);
  });
});

describe("Site manipulation functions", function() {
  beforeEach(() => {
    global.document = jsdom.jsdom();
  });

  it("can extract a hostname from a full URL", function() {
    var testUrl = "https://subdomain.example.com:8080/path/to/page?ans=42";
    expect(siteFromUrl(testUrl)).toEqual("subdomain.example.com");
  });

  it("will get the default scheme for a site by default", function() {
    var expectedScheme = getDefaultScheme();
    expect(getSiteScheme("subdomain.example.com")).toEqual(expectedScheme);
  });

  it("can override the default scheme for a site", function() {
    var expectedScheme = "test-scheme";
    setSiteScheme("subdomain.example.com", expectedScheme);
    expect(getSiteScheme("subdomain.example.com")).toEqual(expectedScheme);
  });

  it("can reset all site scheme overrides", function() {
    var expectedScheme = getDefaultScheme();
    setSiteScheme("subdomain.example.com", "test-scheme");
    resetSiteSchemes();
    expect(getSiteScheme("subdomain.example.com")).toEqual(expectedScheme);
  });

  it("gets no site modifiers for a site by default", function() {
    var expectedModifiers = getDefaultModifiers();
    expect(getSiteModifiers("example.com")).toEqual(expectedModifiers);
  });

  it("can add site modifiers", function() {
    var expectedModifiers = 'mod1 mod2'
    addSiteModifier("example.com", 'mod1');
    addSiteModifier("example.com", 'mod2');
    expect(getSiteModifiers("example.com")).toEqual(expectedModifiers);
  });

  it("can remove site modifiers", function() {
    var expectedModifiers = 'mod1 mod3'
    addSiteModifier("example.com", 'mod1');
    addSiteModifier("example.com", 'mod2');
    addSiteModifier("example.com", 'mod3');
    delSiteModifier("example.com", 'mod2');
    expect(getSiteModifiers("example.com")).toEqual(expectedModifiers);
  });

  it("can clear all site modifiers", function() {
    addSiteModifier("example.com", 'mod1');
    addSiteModifier("example.com", 'mod2');
    resetSiteModifiers();
    expect(getSiteModifiers("example.com")).toEqual('');
  });

  it("reports site settings unchanged by default", function() {
    // This expects this variable to be set by popup.js.
    global.site = "example.com";
    expect(changedFromDefault()).toBe(false);
  });

  it("reports site settings changed when a scheme is changed", function() {
    setSiteScheme("example.com", "test-scheme");
    // changedFromDefault expects this variable to be set by popup.js.
    global.site = "example.com";
    expect(changedFromDefault()).toBe(true);
  });

  it("reports site settings changed when a modifier is changed", function() {
    addSiteModifier("example.com", 'mod1');
    // changedFromDefault expects this variable to be set by popup.js.
    global.site = "example.com";
    expect(changedFromDefault()).toBe(true);
  });

  it("reports site settings unchanged after resetting them", function() {
    setSiteScheme("example.com", "test-scheme");
    addSiteModifier("example.com", 'mod1');
    // changedFromDefault expects this variable to be set by popup.js.
    global.site = "example.com";
    expect(changedFromDefault()).toBe(true);
    resetSiteSchemes();
    resetSiteModifiers();
    expect(changedFromDefault()).toBe(false);
  });
});

describe("Url classifier", function() {
  it("reports ordinary URLs as allowed", function() {
    expect(isDisallowedUrl("https://www.example.com/path")).toBe(false);
  });

  it("reports the new tab page as allowed", function() {
    expect(isDisallowedUrl("chrome://newtab/")).toBe(false);
  });

  it("reports chrome URLs (other than new tab) as not allowed", function() {
    expect(isDisallowedUrl("chrome://extensions/")).toBe(true);
  });

  it("reports about URLs as not allowed", function() {
    expect(isDisallowedUrl("about:blank")).toBe(true);
  });
});
