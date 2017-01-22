require('../common.js');

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
