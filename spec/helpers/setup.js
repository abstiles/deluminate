const path = require('path')
var reporters = require('jasmine-reporters');
var junitReporter = new reporters.JUnitXmlReporter({
  savePath: path.join(__dirname, '..', 'junitresults'),
  consolidateAll: false
});
jasmine.getEnv().addReporter(junitReporter);
