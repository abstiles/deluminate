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
