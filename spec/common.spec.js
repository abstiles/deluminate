import {
	api,
	getEnabled,
	setEnabled,
	isDisallowedUrl,
	getSiteSettings,
	setSiteScheme,
	setDefaultModifiers,
	addSiteModifier,
	delSiteModifier,
	resetSiteSchemes,
	changedFromDefault,
	siteFromUrl,
} from "../common.js";
import {
	Filter,
	Modifier,
} from "../utils.js";

import {expect} from "expect";
import {JSDOM} from "jsdom";

class FakeStorage {
	constructor() {
		this.store = {};
	}
	async set(key, value) {
		this.store[key] = value;
	}
	async get(keys) {
		if (typeof keys === "undefined") {
			return this.store;
		} else if (typeof keys === "string") {
			keys = [keys];
		}
		const result = {};
		for (const key of keys) {
			result[key] = this.store[key];
		}
		return result;
	}
	remove(keys) {
		if (typeof keys === "undefined") {
			return;
		}
		if (typeof keys === "string") {
			keys = [keys];
		}
		for (const key of keys) {
			delete this.store[key];
		}
	}
	clear() {
		this.store = {};
	}
}

api.storage = {local: new FakeStorage(), sync: new FakeStorage()}

describe("Global settings functions", function() {
  beforeEach("Reset settings", resetSiteSchemes);

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
    setEnabled('true')
    expect(getEnabled()).toBe(true);
  });

  it("disables all mods by default", function() {
    expect([...getSiteSettings().mods]).toHaveLength(0);
  });

  it("can set default modifiers", function() {
    setDefaultModifiers(['low_contrast']);
    expect([...getSiteSettings().mods]).toContain("low_contrast");
  });

  it("can enable force text inversion", function() {
    setDefaultModifiers(['forceinput']);
    expect([...getSiteSettings().mods]).toContain("forceinput");
  });

  it("can enable killing backgrounds", function() {
    setDefaultModifiers(['killbg']);
    expect([...getSiteSettings().mods]).toContain("killbg");
  });

  it("uses smart inversion by default", function() {
    expect(getSiteSettings().filter).toBe('smart');
  });

  it("can modify the default scheme", function() {
    setSiteScheme(null, 'all');
    expect(getSiteSettings().filter).toBe('all');
  });

});

describe("Site manipulation functions", function() {
  beforeEach("Reset settings", resetSiteSchemes);

  beforeEach(() => {
    global.document = new JSDOM();
  });

  it("can extract a hostname from a full URL", function() {
    var testUrl = "https://subdomain.example.com:8080/path/to/page?ans=42";
    expect(siteFromUrl(testUrl)).toEqual("subdomain.example.com");
  });

  it("will get the default scheme for a site by default", function() {
    const expectedSettings = getSiteSettings();
    expect(getSiteSettings("subdomain.example.com")).toEqual(expectedSettings);
  });

  it("can override the default scheme for a site", function() {
    var expectedScheme = "dim3";
    setSiteScheme("subdomain.example.com", expectedScheme);
    expect(getSiteSettings("subdomain.example.com").filter).toEqual(expectedScheme);
  });

  it("can reset all site scheme overrides", async function() {
    var expectedScheme = getSiteSettings().filter;
    setSiteScheme("subdomain.example.com", "dim3");
    await resetSiteSchemes();
    expect(getSiteSettings("subdomain.example.com").filter).toEqual(expectedScheme);
  });

  it("gets no site modifiers for a site by default", function() {
    var expectedModifiers = getSiteSettings().mods;
    expect(getSiteSettings("example.com").mods).toEqual(expectedModifiers);
  });

  it("can add site modifiers", function() {
    addSiteModifier("example.com", 'low_contrast');
    addSiteModifier("example.com", 'killbg');
    const mods = [...getSiteSettings("example.com").mods];
    expect(mods).toContain("low_contrast");
    expect(mods).toContain("killbg");
  });

  it("can remove site modifiers", function() {
    var expectedModifiers = 'low_contrast dynamic'
    addSiteModifier("example.com", 'low_contrast');
    addSiteModifier("example.com", 'killbg');
    addSiteModifier("example.com", 'dynamic');
    delSiteModifier("example.com", 'killbg');
    const mods = [...getSiteSettings("example.com").mods];
    expect(mods).toContain("low_contrast");
    expect(mods).toContain("dynamic");
    expect(mods).not.toContain("killbg");
  });

  it("can clear all site modifiers", async function() {
    addSiteModifier("example.com", 'low_contrast');
    addSiteModifier("example.com", 'killbg');
    await resetSiteSchemes();
    const mods = [...getSiteSettings("example.com").mods];
    expect(mods).toHaveLength(0);
  });

  it("reports site settings unchanged by default", function() {
    // This expects this variable to be set by popup.js.
    global.site = "example.com";
    expect(changedFromDefault()).toBe(false);
  });

  it("reports site settings changed when a scheme is changed", function() {
    setSiteScheme("example.com", "all");
    expect(changedFromDefault("example.com")).toBe(true);
  });

  it("reports site settings changed when a modifier is changed", function() {
    addSiteModifier("example.com", 'low_contrast');
    expect(changedFromDefault("example.com")).toBe(true);
  });

  it("reports site settings unchanged after resetting them", async function() {
    await setSiteScheme("example.com", "dim3");
    await addSiteModifier("example.com", 'low_contrast');
    expect(changedFromDefault("example.com")).toBe(true);
    await resetSiteSchemes();
    expect(changedFromDefault("example.com")).toBe(false);
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
