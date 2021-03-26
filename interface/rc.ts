interface ServerConfig {
  port: number;
}

interface StaticFilesConfig {
  memo: boolean;
}

interface DevConfig {
  accessLog: boolean;
}

interface PluginConfigNode {
  package: string;
  config?: unknown;
}

interface PluginConfig {
  [pluginName: string]: PluginConfigNode;
}

interface FrameworkConfig {
  protectPluginInfo?: boolean;
}

export interface RuntimeConfig {
  [key: string]: unknown;
  server: ServerConfig;
  static?: StaticFilesConfig;
  dev?: DevConfig;
  plugins?: PluginConfig;
  framework?: FrameworkConfig;
}

export interface RuntimeConfigStatus {
  exists: boolean;
  json: {
    path: string;
    exists: boolean;
  };
  js: {
    path: string;
    exists: boolean;
  };
}

export interface LambdaDevConfig {
  path: string,
  content: {
    devServer?: {
      port?: number,
      maxFileSize?: number,
    },
    lambda?: {
      allowRequire?: Array<string>,
      env: Record<string, unknown>,
    },
    rollup?: {
      output?: string,
    },
    upload?: {
      accessKey: string,
      secretKey: string,
    },
  },
}
