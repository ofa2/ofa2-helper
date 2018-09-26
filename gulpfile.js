const gulp = require('gulp');

const $ = require('gulp-load-plugins')({
  pattern: ['gulp-*', 'del'],
  // ,lazy: false
});

const config = require('./tools/gulp-tasks/config')(gulp, $);
const pipeline = require('./tools/gulp-tasks//pipeline');

function transformTaskName(taskName) {
  return `__${taskName}`;
}

function loadTask(taskName, configName = taskName) {
  gulp.task(transformTaskName(taskName), pipeline(gulp, $, config[configName]));
}

let taskName = process.argv[2];

if (!taskName) {
  taskName = 'lint';
}

if (taskName === 'build') {
  let tasks = ['lint', 'clean', 'build', 'cp'];

  let seriesNames = tasks.map((name) => {
    loadTask(name);

    return transformTaskName(name);
  });

  gulp.task(taskName, gulp.series(...seriesNames));
} else if (config[taskName]) {
  loadTask(taskName);
  gulp.task(taskName, gulp.series(transformTaskName(taskName)));

  if (taskName === 'lint') {
    gulp.task('default', gulp.series(taskName));
  }
} else {
  console.info('no task found');
}
