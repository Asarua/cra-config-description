'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');


const jest = require('jest');
const execSync = require('child_process').execSync;
let argv = process.argv.slice(2);

// 是否在git仓库中
function isInGitRepository() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// 是否在Mercurial仓库中
function isInMercurialRepository() {
  try {
    execSync('hg --cwd . root', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Watch unless on CI or explicitly running all tests
if (
  // 如果未配置CI
  !process.env.CI &&
  // 未配置监听的环境变量
  argv.indexOf('--watchAll') === -1 &&
  argv.indexOf('--watchAll=false') === -1
) {
  // https://github.com/facebook/create-react-app/issues/5210
  // 是否在版本控制仓库中
  const hasSourceControl = isInGitRepository() || isInMercurialRepository();
  argv.push(hasSourceControl ? '--watch' : '--watchAll');
}

jest.run(argv);
