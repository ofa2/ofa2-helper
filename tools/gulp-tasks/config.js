const ts = require('gulp-typescript');
const utils = require('./utils');

const tsProject = ts.createProject('tsconfig.json');

function exportConfig(gulp, $) {
  return {
    clean: {
      pipelines: [
        {
          do: [
            () => {
              return $.del(['dist/**/*']);
            },
          ],
        },
      ],
    },
    build: {
      src: ['**/*', '!**/*.d.ts'],
      opt: {
        cwd: 'src/',
        base: 'src/',
      },
      pipelines: [
        {
          src: ['**/*.ts'],
          opt: { restore: true },
          do: [$.sourcemaps.init(), $.babel(), $.sourcemaps.write('.')],
        },
      ],
      dist: './dist',
    },

    lint: {
      src: ['**/*.ts'],
      opt: {
        cwd: 'src/',
        base: 'src/',
      },
      pipelines: [
        {
          do: [
            tsProject(ts.reporter.longReporter()),
            $.eslint(),
            $.eslint.result((result) => {
              utils.eslintReporter(result);
            }),
            $.eslint.failOnError(),
          ],
        },
      ],
    },

    cp: {
      src: ['package.json', '.gitignore'],
      opt: {
        cwd: './',
        base: './',
      },
      dist: './dist',
    },
  };
}

module.exports = exportConfig;
