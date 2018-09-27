import { resolve as pathResolve, basename } from 'path';
import { stat } from 'fs-extra';
import chalk from 'chalk';
import bb from 'bluebird';

import { execAsync } from './utils';

const PROJECT_PATH = process.cwd();

async function isFile(filePath) {
  try {
    let stats = await stat(filePath);
    return stats.isFile();
  } catch (e) {
    return false;
  }
}

async function getRootPath() {
  let str = await execAsync(`cd ${PROJECT_PATH} && git rev-parse --show-toplevel`);
  return str.replace(/[\r\n]/, '');
}

async function getHeadFiles(rootPath, headLength) {
  return execAsync(`cd ${rootPath} && git diff --name-only HEAD~${headLength}`);
}

function getModifiedProjects(str) {
  let arr = str.split('\n');
  let result = {};

  arr.forEach((item) => {
    if (!item) {
      return;
    }

    let key = item.replace(/\/.*/, '');
    if (!key) {
      return;
    }

    result[key] = (result[key] || 0) + 1;
  });

  return result;
}

async function getModifiedInfo(rootPath, headFilesStr) {
  let arr = getModifiedProjects(headFilesStr);

  let modifiedProjects = await bb
    .map(Object.keys(arr), (project) => {
      let p = pathResolve(rootPath, project);
      return {
        projectName: basename(p),
        projectPath: p,
      };
    })
    .filter(async ({ projectPath }) => {
      try {
        let stats = await stat(projectPath);
        if (stats.isDirectory()) {
          return true;
        }

        return false;
      } catch (e) {
        console.warn(e);
        return false;
      }
    });

  return modifiedProjects;
}

async function getLintType(projects) {
  return bb.map(projects, async ({ projectPath, projectName }) => {
    let jshintClientFile = await isFile(`${projectPath}/.jshintrc_client`);
    let jshintServerFile = await isFile(`${projectPath}/.jshintrc_server`);
    let eslintFile = await isFile(`${projectPath}/server/.eslintrc.js`);

    let isJshint = jshintClientFile || jshintServerFile;
    let isEslint = eslintFile;
    return {
      projectPath,
      projectName,
      jshint: isJshint,
      eslint: isEslint,
      nodeVersion: isEslint ? '8.11.1' : '4.3.1',
    };
  });
}

interface LintResult {
  projectPath: string;
  str?: string;
  isWarning?: boolean;
  isError?: boolean;
}

async function runJshint({ projectPath, projectName, nodeVersion }) {
  let data = await execAsync(`cd ${projectPath} && gulp jshint`, {
    env: JSON.parse(
      JSON.stringify(process.env).replace(/node\/v\d+\.\d+\.\d+/g, `node/v${nodeVersion}`)
    ),
  });

  let result: LintResult = {
    projectPath,
  };

  if (/line.*/gi.test(data)) {
    data = data.replace(/line.*/gi, (str) => {
      return `${chalk.red(projectName)}\n${chalk.red(str)}`;
    });

    result.isError = true;
  }

  result.str = `${projectPath} \n ${data}`;
  return result;
}

async function runEslint({ projectPath, projectName, nodeVersion }) {
  let data = await execAsync(`cd ${projectPath}/server && gulp lint`, {
    env: JSON.parse(
      JSON.stringify(process.env).replace(/node\/v\d+\.\d+\.\d+/g, `node/v${nodeVersion}`)
    ),
  });

  let result: LintResult = {
    projectPath,
  };

  if (/src\/.*\d+:\d+/gi.test(data)) {
    data = data.replace(/src\/.*\d+:\d+/gi, (str) => {
      return `${chalk.blueBright(projectName)}\n${chalk.red(str)}`;
    });

    result.isError = true;
  }

  result.str = `${projectPath} \n ${data}`;
  return result;
}

async function runLint(project) {
  let data;
  if (project.jshint) {
    data = await runJshint(project);
  } else if (project.eslint) {
    data = await runEslint(project);
  } else {
    project.isWarning = true;
  }

  return { ...project, ...data };
}

async function projectsLint(projects) {
  return bb.map(projects, (project) => {
    return runLint(project);
  });
}

function splitProjects(projects) {
  let v4Project = projects.filter((project) => {
    return project.nodeVersion === '4.3.1';
  });

  let v8Project = projects.filter((project) => {
    return project.nodeVersion === '8.11.1';
  });

  return {
    v4Project,
    v8Project,
  };
}

function lintLog(projects) {
  projects.forEach((item) => {
    if (item && item.str) {
      console.info(item.str);
      console.info('\n');
    }
  });

  let successArr: any[] = [];
  let failedArr: any[] = [];
  let warningArr: any[] = [];

  projects.forEach((item) => {
    if (item.isError) {
      failedArr.push(item);
    } else if (item.isWarning) {
      warningArr.push(item);
    } else {
      successArr.push(item);
    }
  });

  console.info('\n');
  console.info(
    chalk.green(`success: ${successArr.length}`),
    chalk.red(`failed: ${failedArr.length}`),
    chalk.yellow(`warning: ${warningArr.length}`)
  );
  console.info('\n');
}

function showDeployProject(projects) {
  let { v4Project, v8Project } = splitProjects(projects);

  let v4Str = v4Project
    .map((item) => {
      return item.projectName;
    })
    .join(',');

  let v8Str = v8Project
    .map((item) => {
      return item.projectName;
    })
    .join(',');

  if (v8Str) {
    console.info(chalk.blue('make deploy-esnext-stage\n') + chalk.green(`${v8Str}`));
    console.info('\n');
  }
  if (v4Str) {
    console.info(chalk.blue('make deploy-stage\n') + chalk.green(`${v4Str}`));
  }
}

async function init() {
  let headLength = process.argv[2] || '1';
  let isDeploy = !!process.argv[3];

  let rootPath = await getRootPath();
  let headFilesStr = await getHeadFiles(rootPath, headLength);
  // eslint-disable-next-line no-unused-vars
  let projects = await getModifiedInfo(rootPath, headFilesStr);
  projects = await getLintType(projects);

  console.info(JSON.stringify(projects));

  if (isDeploy) {
    showDeployProject(projects);
    return;
  }

  projects = await projectsLint(projects);
  lintLog(projects);
}

(async () => {
  try {
    await init();
  } catch (e) {
    console.warn(e);
  }
})();
