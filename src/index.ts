import { resolve as pathResolve, basename } from 'path';
import { stat } from 'fs-extra';
import chalk from 'chalk';
import bb from 'bluebird';
import ProgressBar from 'ascii-progress';

import {
  IBaseProjectInfo,
  IProjectInfo,
  IProjectCheckResult,
  LintResult,
  INodeVersionMapping,
} from './interface';
import { execAsync } from './utils';

const nodeVersionMapping: INodeVersionMapping = {
  8: '8.11.1',
  4: '4.3.1',
};

const deployIgnoreProjects = ['HDCubeWorker', 'CubeWorker', '__test__'];

const PROJECT_PATH = process.cwd();

async function isFile(filePath: string) {
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

async function getHeadFiles(rootPath: string, headLength: string) {
  return execAsync(`cd ${rootPath} && git diff --name-only HEAD~${headLength}`);
}

function getModifiedProjects(str: string) {
  let arr = str.split('\n');
  let result: { [key: string]: any } = {};

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

async function runJshint({ alias, path, nodeVersion }: IProjectInfo) {
  let data = await execAsync(`cd ${alias} && gulp jshint`, {
    env: JSON.parse(
      JSON.stringify(process.env).replace(
        /node\/v\d+\.\d+\.\d+/g,
        `node/v${nodeVersionMapping[nodeVersion]}`
      )
    ),
  });

  let result: LintResult = {};

  if (/line.*/gi.test(data)) {
    data = data.replace(/line.*/gi, (str) => {
      return `${chalk.red(path)}\n${chalk.red(str)}`;
    });

    result.isError = true;
  }

  result.str = `${alias} \n ${data}`;
  return result;
}

async function runEslint({ path, alias, nodeVersion }: IProjectInfo) {
  let data = await execAsync(`cd ${path}/server && gulp lint`, {
    env: JSON.parse(
      JSON.stringify(process.env).replace(
        /node\/v\d+\.\d+\.\d+/g,
        `node/v${nodeVersionMapping[nodeVersion]}`
      )
    ),
  });

  let result: LintResult = {};

  if (/src\/.*\d+:\d+/gi.test(data)) {
    data = data.replace(/src\/.*\d+:\d+/gi, (str) => {
      return `${chalk.blueBright(alias)}\n${chalk.red(str)}`;
    });

    result.isError = true;
  }

  result.str = `${path} \n ${data}`;
  return result;
}

async function runLint(project: IProjectInfo): Promise<IProjectCheckResult> {
  let lintResult: LintResult;

  if (project.jshint) {
    lintResult = await runJshint(project);
  } else if (project.eslint) {
    lintResult = await runEslint(project);
  } else {
    lintResult = {
      isWarning: true,
    };
  }

  return { ...project, ...lintResult };
}

async function projectsLint(projects: IProjectInfo[]) {
  console.info('\n');
  let bar = new ProgressBar({
    schema: 'run lint.... :bar :percent',
    total: projects.length + 1,
  });

  bar.tick();

  return bb.map(projects, async (project) => {
    let result = await runLint(project);
    bar.tick();
    return result;
  });
}

function splitProjects(projects: IProjectInfo[]) {
  let v4Project = projects.filter((project) => {
    return project.nodeVersion === '4';
  });

  let v8Project = projects.filter((project) => {
    return project.nodeVersion === '8';
  });

  return {
    v4Project,
    v8Project,
  };
}

function lintLog(projects: IProjectCheckResult[]) {
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

function showDeployProject(projects: IProjectInfo[]) {
  let { v4Project, v8Project } = splitProjects(projects);

  let v4Str = v4Project
    .map((item) => {
      return item.alias;
    })
    .filter((alias) => {
      return deployIgnoreProjects.indexOf(alias) === -1;
    })
    .join(',');

  let v8Str = v8Project
    .map((item) => {
      return item.alias;
    })
    .filter((alias) => {
      return deployIgnoreProjects.indexOf(alias) === -1;
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

async function getProjectLintInfo(projectPath: string) {
  let jshintClientFile = await isFile(`${projectPath}/.jshintrc_client`);
  let jshintServerFile = await isFile(`${projectPath}/.jshintrc_server`);
  let eslintFile = await isFile(`${projectPath}/server/.eslintrc.js`);

  let isJshint = jshintClientFile || jshintServerFile;
  let isEslint = eslintFile;
  let nodeVersion: keyof INodeVersionMapping = isEslint ? '8' : '4';
  return {
    jshint: isJshint,
    eslint: isEslint,
    lintPath: isEslint ? `${projectPath}/server/` : projectPath,
    nodeVersion,
  };
}

async function getProjectsBaseInfo(
  rootPath: string,
  headFilesStr: string
): Promise<IBaseProjectInfo[]> {
  let arr = getModifiedProjects(headFilesStr);

  let baseProjectInfo = await bb
    .map(Object.keys(arr), (project) => {
      let p = pathResolve(rootPath, project);
      return {
        alias: basename(p),
        path: p,
      };
    })
    .filter(async ({ path }) => {
      try {
        let stats = await stat(path);
        if (stats.isDirectory()) {
          return true;
        }

        return false;
      } catch (e) {
        console.warn(e);
        return false;
      }
    });

  return baseProjectInfo;
}

async function getProjectInfo(baseProjectInfo: IBaseProjectInfo): Promise<IProjectInfo> {
  let lintInfo = await getProjectLintInfo(baseProjectInfo.path);

  return { ...lintInfo, ...baseProjectInfo };
}

async function getProjects(projectsBaseInfo: IBaseProjectInfo[]) {
  return bb.map(projectsBaseInfo, (baseProjectInfo) => {
    return getProjectInfo(baseProjectInfo);
  });
}

async function init() {
  let headLength = process.argv[2] || '1';
  let isDeploy = !!process.argv[3];

  let rootPath = await getRootPath();
  let headFilesStr = await getHeadFiles(rootPath, headLength);

  let projectsBaseInfo = await getProjectsBaseInfo(rootPath, headFilesStr);
  let projects = await getProjects(projectsBaseInfo);

  console.info(JSON.stringify(projects));

  showDeployProject(projects);
  if (isDeploy) {
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
