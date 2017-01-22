describe("A suite", function() {
  it("can interact with the local storage", function() {
    expect(true).toBe(true);
    localStorage.setItem('test', 'hello world');
    expect(localStorage.getItem('test')).toBe('hello world');
  });
});
