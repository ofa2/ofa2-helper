import bb from 'bluebird';
import { ensureFile, readFile, writeFile } from 'fs-extra';
import { camelize, decamelize, pascalize } from 'humps';
import escapeRegExp from 'lodash/escapeRegExp';
import { basename } from 'path';

import { getDeepFiles, getProjectPath } from './util';

let replaceName = process.argv[3];
let deepState = process.argv[4];
let dirPath = getProjectPath(2);

async function load(): Promise<void> {
  if (!replaceName) {
    throw new Error('no replaceName found');
  }

  let originName = basename(dirPath);
  let decamelizeOriginName = decamelize(originName, { separator: '-' });
  let decamelizeReplaceName = decamelize(replaceName, { separator: '-' });

  let camelizeOriginName = camelize(originName);
  let camelizeReplaceName = camelize(replaceName);

  let pascalizeOriginName = pascalize(originName);
  let pascalizeReplaceName = pascalize(replaceName);

  let files = getDeepFiles(dirPath);

  await bb
    .map(files, async (filePath) => {
      let fileReg = new RegExp(escapeRegExp(decamelizeOriginName), 'g');
      let writeFilePath = filePath.replace(fileReg, decamelizeReplaceName);

      let doc = await readFile(filePath, 'utf8');
      let docReg2 = new RegExp(escapeRegExp(decamelizeOriginName), 'g');
      doc = doc.replace(docReg2, decamelizeReplaceName);

      let docReg1 = new RegExp(escapeRegExp(camelizeOriginName), 'g');
      doc = doc.replace(docReg1, camelizeReplaceName);

      let docReg3 = new RegExp(escapeRegExp(pascalizeOriginName), 'g');
      doc = doc.replace(docReg3, pascalizeReplaceName);

      if (deepState) {
        if (/\.route\.js$/.test(writeFilePath)) {
          doc = doc.replace(/'main\./g, `'main.${deepState}.`);
          doc = doc.replace(/'@main/g, `'@main.${deepState}`);
          doc = doc.replace(/templateUrl\s*:\s*'app\//, `templateUrl: 'app/${deepState}/`);
        } else if (/\.module\.js$/.test(writeFilePath)) {
          doc = doc.replace(/.*\.tpl',/g, '');
        }
      }

      return {
        filePath,
        writeFilePath,
        doc,
      };
    })
    .mapSeries(async (obj) => {
      console.info('start write: ', obj.writeFilePath);
      await ensureFile(obj.writeFilePath);
      await writeFile(obj.writeFilePath, obj.doc);
    });
}

load()
  .then(() => {
    console.info('success');
  })
  .catch(console.warn);
