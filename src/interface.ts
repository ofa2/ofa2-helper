export interface IBaseProjectInfo {
  alias: string;
  path: string;
}

export interface INodeVersionMapping {
  '8': string;
  '4': string;
}

export interface IProjectInfo extends IBaseProjectInfo {
  nodeVersion: keyof INodeVersionMapping;
  lintPath: string;
  jshint: boolean;
  eslint: boolean;
}

export interface IProjectCheckResult extends IProjectInfo {
  str?: string;
  isError?: boolean;
  isWarning?: boolean;
}

export interface LintResult {
  str?: string;
  isWarning?: boolean;
  isError?: boolean;
}
