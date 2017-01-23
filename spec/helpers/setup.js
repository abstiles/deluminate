const path = require('path')
var reporters = require('jasmine-reporters');
var junitReporter = new reporters.JUnitXmlReporter({
  savePath: path.join(__dirname, '..', 'junitresults'),
  consolidateAll: false
});
jasmine.getEnv().addReporter(junitReporter);

/* Needed for tests which interact with the local storage. */
require('mock-local-storage');
afterEach(localStorage.clear);
