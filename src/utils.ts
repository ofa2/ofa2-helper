import { exec } from 'child_process';

async function execAsync(cmd: string, options?: any): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }

      return resolve(`${stdout || stderr}`);
    });
  });
}

export { execAsync };

export default {
  execAsync,
};
