export interface ConfigFileInfo {
  id?: number;
  name?: string;
  path?: string;
}

export interface CFSDeployInfo {
  host?: string;
  port?: number;
  https?: boolean;
  base?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface CFSDeployConfig {
  files?: Array<ConfigFileInfo>;
  deploy?: CFSDeployInfo;
}
