import * as path from 'path';
import * as fs from 'fs-extra';
// import * as prettier from 'prettier'

import { ResolveConfigOptions } from 'prettier';
import { Manager } from './manage';
import { OriginType } from './scripts';

// mocks 相关
export class Mocks {
  enable = false;
  port = 8080;
  basePath = '';
  wrapper = `{
      "code": 0,
      "data": {response},
      "message": ""
    }`;
}

// 环境 (语言不更好吗？)
export enum Surrounding {
  typeScript = 'typeScript',
  javaScript = 'javaScript'
}

export enum SurroundingFileName {
  javaScript = 'js',
  typeScript = 'ts'
}
// 全量的配置
export class DataSourceConfig {
  originUrl?= '';
  originType = OriginType.SwaggerV2; // 类型
  name?: string;
  // 使用操作 ID
  usingOperationId = true;
  // 使用多个源
  usingMultipleOrigins = false;
  // 按名称标记
  taggedByName = true;
  templatePath = 'serviceTemplate';
  templateType = '';
  // 环境
  surrounding = Surrounding.typeScript;
  outDir = 'src/service';
  // 可选项。指定数据源预处理路径（使用相对路径指定）
  transformPath = '';
  // 可选项, 相对项目根目录路径。用于 Swagger 数据源需要登录才能请求成功的场景
  fetchMethodPath = '';
  // todo 是否可以用项目自己的
  prettierConfig: ResolveConfigOptions = {}; // 生成的代码会用 prettier 来美化。此处配置 prettier 的配置项即可 ()
  /** 单位为秒，默认 20 分钟 */
  pollingTime = 60 * 20;
  mocks = new Mocks();

  constructor(config: DataSourceConfig) {
    // 配置文件覆盖默认的配置
    Object.keys(config).forEach(key => {
      if (key === 'mocks') {
        this[key] = {
          ...this[key],
          ...config[key]
        };
      } else {
        this[key] = config[key];
      }
    });
  }
}

// Config 类
export class Config extends DataSourceConfig {
  originType = OriginType.SwaggerV2;
  origins?= [] as Array<{
    originType: OriginType;
    originUrl: string;
    name: string;
    usingOperationId: boolean;
    transformPath?: string;
    fetchMethodPath?: string;
    outDir?: string
  }>;
  transformPath: string;
  fetchMethodPath: string;

  constructor(config: Config){
    super(config);
    this.origins = config.origins || [];
  }
  // 通过配置文件路径创建 config 实例
  static createFromConfigPath(configPath: string) {
    // 读取配置文件内容
    const content = fs.readFileSync(configPath, 'utf8');
    try {
      const configObj = JSON.parse(content);
      return new Config(configObj)
    } catch (error) {
      throw new Error('pont-config.json is not a validate json');
    }
  }

  // 通过配置目录 获取 所有的配置
  getDataSourcesConfig(configDir: string) {
    const { origins, ...rest } = this;
    // 通用配置
    const commonConfig = {
      ...rest,
      // 下面生成 绝对路径
      outDir: path.join(configDir, this.outDir), 
      templatePath: this.templatePath ? path.join(configDir, this.templatePath) : undefined,
      transformPath: this.transformPath ? path.join(configDir, this.transformPath) : undefined,
      fetchMethodPath: this.fetchMethodPath ? path.join(configDir, this.fetchMethodPath) : undefined
    };

    // FIXME: origins中配的路径没有转换成绝对路径，找不到该模块
    // 多源
    if (this.origins && this.origins.length) {
      return this.origins.map(origin => {
        return new DataSourceConfig({
          ...commonConfig,
          ...origin,
          outDir: origin.outDir ? path.join(configDir, origin.outDir) : commonConfig.outDir,
        });
      });
    }

    return [new DataSourceConfig(commonConfig)];
  }
}

// 获取模板中的文件
export function getTemplatesDirFile(fileName, filePath = 'templates/') {
  return fs.readFileSync(__dirname.substring(0, __dirname.lastIndexOf('lib')) + filePath + fileName, 'utf8');
}

export async function lookForFiles(dir: string, fileName: string): Promise<string> {
  // 读取目录
  const files = await fs.readdir(dir);
  // 递归 寻找
  for (let file of files) {
    const currName = path.join(dir, file);

    const info = await fs.lstat(currName);
    if (info.isDirectory()) {
      if (file === '.git' || file === 'node_modules') {
        continue;
      }

      const result = await lookForFiles(currName, fileName);

      if (result) {
        return result;
      }
    } else if (info.isFile() && file === fileName) {
      return currName;
    }
  }
}

const PROJECT_ROOT = process.cwd();
export const CONFIG_FILE = 'pont-config.json';

export async function createManager(configFile = CONFIG_FILE) {
  // 查看配置文件是否存在 
  const configPath = await lookForFiles(PROJECT_ROOT, configFile);

  if (!configPath) {
    return;
  }

  const config = Config.createFromConfigPath(configPath);
  const manager = new Manager(PROJECT_ROOT, config, path.dirname(configPath));

  await manager.ready();

  return manager;
}
/** 检测是否是合法url */
export function judgeIsVaildUrl(url: string) {
  return /^(http|https):.*?$/.test(url);
}
