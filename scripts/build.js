'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');


const path = require('path');
// 彩色字体
const chalk = require('react-dev-utils/chalk');
const fs = require('fs-extra');
// Big-Friendly JSON. Asynchronous streaming functions for large JSON data sets.
const bfj = require('bfj');
const webpack = require('webpack');
const configFactory = require('../config/webpack.config');
const paths = require('../config/paths');
// 校验必须要拥有的文件
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printHostingInstructions = require('react-dev-utils/printHostingInstructions');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

// 生成前测量文件大小
const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
// 生成后打印文件大小
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;
// 通过判断有没有yarn.lock判断是不是使用yarn
const useYarn = fs.existsSync(paths.yarnLockFile);

// These sizes are pretty large. We'll warn for bundles exceeding them.
// 压缩后打包好的包的警告大小
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
// 压缩后打包中的包的警告大小
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

// 是否连接到一个终端上下文
const isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
// 如果没有html文件或者入口js文件
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

/*
  precess.argv 返回一个数组
  第一个参数是执行当前脚本的node进程的绝对路径
  第二个参数是当前正被执行的js文件的路径
  其余元素是任何额外的命令行参数
*/
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;

// Generate configuration
// 告诉webpack.config使用production环境的配置
const config = configFactory('production');

// We require that you explicitly set browsers and do not fall back to
// browserslist defaults.
// 需要显式的设置浏览器要求
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    // 首先获得它之前的大小，可以用来展示改变了多少
    return measureFileSizesBeforeBuild(paths.appBuild);
  })
  // 之前的文件大小
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    // 清空build文件夹下的内容（保留文件夹目录）
    fs.emptyDirSync(paths.appBuild);
    // Merge with the public folder
    // 将public文件夹下的内容copy到build中
    copyPublicFolder();
    // Start the webpack build
    // 开始使用webpack打包
    return build(previousFileSizes);
  })
  .then(
    // 信息统计、原始大小，警告
    ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

      console.log('File sizes after gzip:\n');
      // 输出打包后的文件大小及路径
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        paths.appBuild,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();

      const appPackage = require(paths.appPackageJson);
      const publicUrl = paths.publicUrlOrPath;
      const publicPath = config.output.publicPath;
      const buildFolder = path.relative(process.cwd(), paths.appBuild);
      /*
        打印托管说明

        The project was built assuming it is hosted at /.
        You can control this with the homepage field in your package.json.

        The build folder is ready to be deployed.
        You may serve it with a static server:

          yarn global add serve
          serve -s build

        Find out more about deployment here:

          https://cra.link/deployment

        ✨  Done in 4.15s.
      */
      printHostingInstructions(
        appPackage,
        publicUrl,
        publicPath,
        buildFolder,
        useYarn
      );
    },
    err => {
      // 是否是ts编译错误
      const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === 'true';
      if (tscCompileOnError) {
        console.log(
          chalk.yellow(
            // 类型编译错误
            'Compiled with the following type errors (you may want to check these before deploying your app):\n'
          )
        );
        printBuildError(err);
      } else {
        console.log(chalk.red('Failed to compile.\n'));
        printBuildError(err);
        process.exit(1);
      }
    }
  )
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
  console.log('Creating an optimized production build...');

  // 将配置加载到webpack模块，生成编译工具
  const compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      // 如果运行过程中出现错误
      if (err) {
        if (!err.message) {
          return reject(err);
        }

        let errMessage = err.message;

        // Add additional information for postcss errors
        // 如果错误中含有postcss相关错误，则在报错信息中添加postcssNode错误的地址
        if (Object.prototype.hasOwnProperty.call(err, 'postcssNode')) {
          errMessage +=
            '\nCompileError: Begins at CSS selector ' +
            err['postcssNode'].selector;
        }

        // 格式化webpack输出信息
        messages = formatWebpackMessages({
          errors: [errMessage],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          // 
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      // 如果存在报错信息
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        // 保证报错只报一次
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        // 如果使用CI配置，并且存在警告信息
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            // 将警告当作错误处理是因为使用了CI配置
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              // 大多数CI服务都会自动设置它
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      };

      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    });
  });
}

// 将public文件夹下的文件copy到build下
function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: file => file !== paths.appHtml,
  });
}
