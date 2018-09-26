/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */

const chalk = require('chalk');
const notifier = require('node-notifier');
const path = require('path');

const projectPath = path.resolve(__dirname, '../../') + '/';

const svc = {
  eslintReporter(result) {
    let isNotify = false;
    if (result.messages.length) {
      result.messages.forEach((item) => {
        let location = `${result.filePath.replace(projectPath, '')}:${item.line}:${item.column}`;
        let ruleId = `${item.ruleId}`;
        let message = `${item.message}`;

        if (item.severity === 1) {
          console.log(`${chalk.yellow(location)}\n${chalk.blue(ruleId)} ${chalk.gray(message)}`);
        } else {
          console.log(`${chalk.red(location)}\n${chalk.blue(ruleId)} ${chalk.gray(message)}`);
        }
        console.log(chalk.gray(`// eslint-disable-next-line ${ruleId}`));
        console.log();

        if (!isNotify) {
          isNotify = true;
          notifier.notify({
            title: `${message}    ${svc.formatDate('hh:mm:ss')}`,
            subtitle: ruleId,
            message: location,
          });
        }
      });
    }
  },
  formatDate(fmt, date = new Date()) {
    let o = {
      'y+': date.getFullYear(),
      'M+': date.getMonth() + 1, // 月份
      'd+': date.getDate(), // 日
      'h+': date.getHours(), // 小时
      'm+': date.getMinutes(), // 分
      's+': date.getSeconds(), // 秒
      'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
      'S+': date.getMilliseconds(), // 毫秒
    };

    Object.keys(o).forEach((key) => {
      if (new RegExp(`(${key})`).test(fmt)) {
        // eslint-disable-next-line no-param-reassign
        fmt = fmt.replace(RegExp.$1, `00${o[key]}`.substr(-RegExp.$1.length));
      }
    });

    return fmt;
  },
};

module.exports = svc;
