'use strict';

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

// Make sure that including paths.js after env.js will read .env variables.
// 清除由于commonjs引起的缓存
delete require.cache[require.resolve('./paths')];

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  throw new Error(
    'The NODE_ENV environment variable is required but was not specified.'
  );
}

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
// 如果要使用env文件，解析env文件配置
// ps: paths.dotenv = process.cwd() + '.env'，(当前项目根目录下的绝对路径 + .env)
const dotenvFiles = [
  // demo: .env.test.local
  `${paths.dotenv}.${NODE_ENV}.local`,
  // Don't include `.env.local` for `test` environment
  // since normally you expect tests to produce the same
  // results for everyone
  // demo: .env.local
  NODE_ENV !== 'test' && `${paths.dotenv}.local`,
  // demo: .env.test
  `${paths.dotenv}.${NODE_ENV}`,
  // .env
  paths.dotenv,
].filter(Boolean);

// Load environment variables from .env* files. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.  Variable expansion is supported in .env files.
// .env文件不会修改任何已经定义的env变量，它是用来扩展的
// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
// 将存在的.env文件进行遍历
dotenvFiles.forEach(dotenvFile => {
  // 如果存在这个文件
  if (fs.existsSync(dotenvFile)) {
    // 使用dotenv-expand插件加载，它在我们之前使用的dotenv库的顶部添加了变量扩展。 它使我们可以使用动态字符串格式，并可以使用.env文件
    require('dotenv-expand')(
      // 加载dotenv包使用env配置
      require('dotenv').config({
        path: dotenvFile,
      })
    );
  }
});

// We support resolving modules according to `NODE_PATH`.
// This lets you use absolute paths in imports inside large monorepos:
// https://github.com/facebook/create-react-app/issues/253.
// It works similar to `NODE_PATH` in Node itself:
// https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
// Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
// Otherwise, we risk importing Node.js core modules into an app instead of webpack shims.
// https://github.com/facebook/create-react-app/issues/1023#issuecomment-265344421
// We also resolve them to make sure all tools using them work consistently.
const appDirectory = fs.realpathSync(process.cwd());
// 支持使用NODE_PATH
process.env.NODE_PATH = (process.env.NODE_PATH || '')
  /*
    path.delimiter —— 提供平台特定的定界符
    ps:
      windows: 
        console.log(process.env.PATH);
        打印: 'C:\Windows\system32;C:\Windows;C:\Program Files\node\'

        process.env.PATH.split(path.delimiter);
        返回: ['C:\\Windows\\system32', 'C:\\Windows', 'C:\\Program Files\\node\\']
      posix:
        console.log(process.env.PATH);
        打印: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin'

        process.env.PATH.split(path.delimiter);
        返回: ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/bin']
  */
  // 根据平台提供的定界符进行环境变量分割
  .split(path.delimiter)
  // 获取存在，但是不是绝对路径的文件夹
  .filter(folder => folder && !path.isAbsolute(folder))
  // 将其变为绝对路径
  .map(folder => path.resolve(appDirectory, folder))
  // 进行拼接
  .join(path.delimiter);

// Grab NODE_ENV and REACT_APP_* environment variables and prepare them to be
// injected into the application via DefinePlugin in webpack configuration.
const REACT_APP = /^REACT_APP_/i;

// 获取所有的env
function getClientEnvironment(publicUrl) {
  // 获取process.env上的所有相关变量
  const raw = Object.keys(process.env)
    // 获取与react相关的变量
    .filter(key => REACT_APP.test(key))
    .reduce(
      // 与默认env进行合并
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        // Most importantly, it switches React into the correct mode.
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Useful for resolving the correct path to static assets in `public`.
        // For example, <img src={process.env.PUBLIC_URL + '/img/logo.png'} />.
        // This should only be used as an escape hatch. Normally you would put
        // images into the `src` and `import` them in code to get their paths.
        PUBLIC_URL: publicUrl,
        // We support configuring the sockjs pathname during development.
        // These settings let a developer run multiple simultaneous projects.
        // They are used as the connection `hostname`, `pathname` and `port`
        // in webpackHotDevClient. They are used as the `sockHost`, `sockPath`
        // and `sockPort` options in webpack-dev-server.
        WDS_SOCKET_HOST: process.env.WDS_SOCKET_HOST,
        WDS_SOCKET_PATH: process.env.WDS_SOCKET_PATH,
        WDS_SOCKET_PORT: process.env.WDS_SOCKET_PORT,
        // Whether or not react-refresh is enabled.
        // react-refresh is not 100% stable at this time,
        // which is why it's disabled by default.
        // It is defined here so it is available in the webpackHotDevClient.
        FAST_REFRESH: process.env.FAST_REFRESH !== 'false',
      }
    );
  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { raw, stringified };
}

module.exports = getClientEnvironment;
