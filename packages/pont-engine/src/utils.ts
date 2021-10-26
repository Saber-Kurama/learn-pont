import * as path from 'path';
import * as fs from 'fs-extra';
// import * as prettier from 'prettier'

import * as ts from 'typescript';
import { ResolveConfigOptions } from 'prettier';
import { error } from './debugLog';
import { Manager } from './manage';
import { OriginType } from './scripts';
import { getTemplateByTemplateType } from './templates';

// 默认 模板 样板代码
const defaultTemplateCode = `
import * as Pont from 'pont-engine';
import { CodeGenerator, Interface } from "pont-engine";

export class FileStructures extends Pont.FileStructures {
}

export default class MyGenerator extends CodeGenerator {
}
`;

// // 获取 接口 文档 数据 的默认方法
// const defaultFetchMethodCode = `
// import fetch from 'node-fetch';

// export default function (url: string): string {
//   return fetch(url).then(res => res.text())
// }
// `;

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
  // TODO: 是否可以用项目自己的
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
  fetchMethodPath: string; // 用来更改获取 api json 文档的方法

  constructor(config: Config){
    super(config);
    this.origins = config.origins || [];
  }
  // // 执行 配置获取 远端  接口的方法
  // static getFetchMethodFromConfig(config: Config | DataSourceConfig) {
  //   if (config.fetchMethodPath) {
  //     // fetch 方法的路径
  //     const fetchMethodPath = path.isAbsolute(config.fetchMethodPath)
  //       ? config.fetchMethodPath
  //       : path.join(process.cwd(), config.fetchMethodPath);
  //     const moduleResult = getTemplate(fetchMethodPath, '', defaultFetchMethodCode);

  //     if (moduleResult) {
  //       return moduleResult.default;
  //     }
  //   }

  //   return id => id;
  // }

  // 通过配置文件路径创建 config 实例 单例模式
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

  //  获取 所有的配置 (根据配置目录增加一些 路径的配置)
  getDataSourcesConfig(configDir: string) {
    const { origins, ...rest } = this;
    // 通用配置
    const commonConfig = {
      ...rest,
      // 下面生成 绝对路径 修正一些路径的问题 ？ 为什么不在 初始化的时候 修正呢
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

// // 格式化 代码
// export function format(fileContent: string, prettierOpts = {}) {
//   try {
//     return prettier.format(fileContent, {
//       parser: 'typescript',
//       trailingComma: 'all',
//       singleQuote: true,
//       ...prettierOpts
//     });
//   } catch (e) {
//     error(`代码格式化报错！${e.toString()}\n代码为：${fileContent}`);
//     return fileContent;
//   }
// }

// 获取最长路径
export function getMaxSamePath(paths: string[], samePath = '') {
  if (!paths.length) {
    return samePath;
  }

  if (paths.some(path => !path.includes('/'))) {
    return samePath;
  }

  const segs = paths.map(path => {
    const [firstSeg, ...restSegs] = path.split('/');
    return { firstSeg, restSegs };
  });

  if (segs.every((seg, index) => index === 0 || seg.firstSeg === segs[index - 1].firstSeg)) {
    return getMaxSamePath(
      segs.map(seg => seg.restSegs.join('/')),
      samePath + '/' + segs[0].firstSeg
    );
  }

  return samePath;
}

export function toUpperFirstLetter(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// 根据URl 获取 名称
export function getIdentifierFromUrl(url: string, requestType: string, samePath = '') {
  const currUrl = url.slice(samePath.length).match(/([^\.]+)/)[0];

  return (
    requestType +
    currUrl
      .split('/')
      .map(str => {
        if (str.includes('-')) {
          str = str.replace(/(\-\w)+/g, (_match, p1) => {
            if (p1) {
              return p1.slice(1).toUpperCase();
            }
          });
        }

        if (str.match(/^{.+}$/gim)) {
          return 'By' + toUpperFirstLetter(str.slice(1, str.length - 1));
        }
        return toUpperFirstLetter(str);
      })
      .join('')
  );
}

/** some reversed keyword in js but not in java */
const TS_KEYWORDS = ['delete', 'export', 'import', 'new', 'function'];
const REPLACE_WORDS = ['remove', 'exporting', 'importing', 'create', 'functionLoad'];

// 根据操作符生成 名称
export function getIdentifierFromOperatorId(operationId: string) {
  const identifier = operationId.replace(/(.+)(Using.+)/, '$1');

  const index = TS_KEYWORDS.indexOf(identifier);

  if (index === -1) {
    return identifier;
  }

  return REPLACE_WORDS[index];
}

// 获取 模板
export function getTemplate(templatePath, templateType, defaultValue = defaultTemplateCode) {
  // 模板文件是否存在
  if (!fs.existsSync(templatePath + '.ts')) {
    // 不存在 就写文件（用默认值）想要覆盖就应该有自己的文件
    fs.writeFileSync(templatePath + '.ts', getTemplateByTemplateType(templateType) || defaultValue);
  }
  // 读取文件
  const tsResult = fs.readFileSync(templatePath + '.ts', 'utf8');
  // ts 编译
  const jsResult = ts.transpileModule(tsResult, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS
    }
  });

  const noCacheFix = (Math.random() + '').slice(2, 5);
  const jsName = templatePath + noCacheFix + '.js';
  let moduleResult;

  try {
    // 编译到js
    fs.writeFileSync(jsName, jsResult.outputText, 'utf8');

    // 用 node require 引用编译后的 js 代码
    moduleResult = require(jsName);

    // 删除该文件
    fs.removeSync(jsName);
  } catch (e) {
    // 删除失败，则再删除
    if (fs.existsSync(jsName)) {
      fs.removeSync(jsName);
    }

    // 没有引用，报错
    if (!moduleResult) {
      throw new Error(e);
    }
  }
  console.log('moduleResult', moduleResult)
  return moduleResult;
}

// 获取模板中的文件
export function getTemplatesDirFile(fileName, filePath = 'templates/') {
  return fs.readFileSync(__dirname.substring(0, __dirname.lastIndexOf('lib')) + filePath + fileName, 'utf8');
}

// 在目录中查找文件 返回文件路径 
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

// 破折号 
export function toDashCase(name: string) {
  const dashName = name
    .split(' ')
    .join('')
    .replace(/[A-Z]/g, p => '-' + p.toLowerCase());

  if (dashName.startsWith('-')) {
    return dashName.slice(1);
  }

  return dashName;
}

const PROJECT_ROOT = process.cwd();
export const CONFIG_FILE = 'pont-config.json';

// 创建管理
export async function createManager(configFile = CONFIG_FILE) {
  // 查看配置文件是否存在 
  const configPath = await lookForFiles(PROJECT_ROOT, configFile);

  if (!configPath) {
    return;
  }
  // 根据配置文件 创建 配置 config
  const config = Config.createFromConfigPath(configPath);
  // 创建一个 manager 管理对象
  const manager = new Manager(PROJECT_ROOT, config, path.dirname(configPath));
  await manager.ready();

  return manager;
}

/** 获取文件名名称 */
export function getFileName(fileName: string, surrounding: string) {
  const isInvalidSurrounding = Surrounding[surrounding];

  if (isInvalidSurrounding) {
    return `${fileName}.${SurroundingFileName[isInvalidSurrounding]}`;
  }

  return `${fileName}.ts`;
}

/** 检测是否是合法url */
export function judgeIsVaildUrl(url: string) {
  return /^(http|https):.*?$/.test(url);
}
