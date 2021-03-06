const { basename } = require('path'),
      globSync = require('glob').sync;

module.exports = globSync('./functions/**/*.js', { cwd: __dirname }).reduce((obj, fn) => {
  return Object.assign({
    [basename(fn, '.js')]: require(fn)
  }, obj);
}, {});
