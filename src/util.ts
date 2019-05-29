import bb from 'bluebird';
import { readdir, stat } from 'fs-extra';
import flattenDeep from 'lodash/flattenDeep';
import { resolve as pathResolve } from 'path';

function getProjectPath(index = 2): string {
  return process.argv[index] ? pathResolve(process.cwd(), process.argv[index]) : process.cwd();
}

async function getDeepFiles(
  dirPath: string,
  {
    extname,
    deep,
    exclude = ['.git', '.idea', 'node_modules'],
  }: {
  extname?: string | RegExp;
  deep?: number;
  exclude?: string[];
  } = {}
): Promise<string[]> {
  let stats = await stat(dirPath);

  // 如果是文件, 直接返回数据
  if (stats.isFile()) {
    if (extname && dirPath.match(extname)) {
      return [];
    }

    return [dirPath];
  }

  if (deep === 0) {
    return [];
  }
  if (deep) {
    // eslint-disable-next-line no-param-reassign
    deep -= 1;
  }

  let fileNames = await readdir(dirPath);

  let filePaths = fileNames
    .filter((fileName) => {
      if (exclude && exclude.length) {
        return exclude.indexOf(fileName) < 0;
      }
      return true;
    })
    .map((fileName) => {
      return pathResolve(dirPath, fileName);
    });

  let files = await bb.map(filePaths, (filePath) => {
    return getDeepFiles(filePath, { extname, deep });
  });

  return flattenDeep<string>(files);
}

export { getProjectPath, getDeepFiles };
