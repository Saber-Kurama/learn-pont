import * as _ from "lodash";
import { StandardDataSource } from "./standard";
import { Config, DataSourceConfig, getTemplate } from "./utils";
import * as fs from "fs-extra";
import * as path from "path";
import { info as debugInfo, error } from "./debugLog";
import { readRemoteDataSource } from "./scripts";
import { DsManager } from "./DsManager";

import {
  CodeGenerator,
  FilesManager,
  FileStructures,
} from "./generators/generate";

// 管理 生成的代码的文件
export class Manager {
  readonly lockFilename = "api-lock.json";

  allLocalDataSources: StandardDataSource[] = []; // 所有本地数据源
  allConfigs: DataSourceConfig[];
  remoteDataSource: StandardDataSource;
  currConfig: DataSourceConfig;
  currLocalDataSource: StandardDataSource;

  fileManager: FilesManager; // 文件管理

  report = debugInfo;

  constructor(
    private projectRoot: string,
    config: Config,
    configDir = process.cwd()
  ) {
    // this.projectRoot 项目根路径
    // 所有的配置
    this.allConfigs = config.getDataSourcesConfig(configDir);
    // 当前配置 默认是第一个
    this.currConfig = this.allConfigs[0];
  }

  async ready() {
    console.log("????");
    if (this.existsLocal()) {
      // await this.readLocalDataSource();
      // await this.initRemoteDataSource();
    } else {
      // 不存在的情况
      console.log("????aaaa");
      const promises = this.allConfigs.map((config) => {
        return this.readRemoteDataSource(config);
      });
      this.allLocalDataSources = await Promise.all(promises);
      this.currLocalDataSource = this.allLocalDataSources[0];
      this.remoteDataSource = this.currLocalDataSource;

      // await this.regenerateFiles();
    }
  }

  // 是否存在 api.lock 或者 api-lock.json
  existsLocal() {
    return (
      fs.existsSync(path.join(this.currConfig.outDir, this.lockFilename)) ||
      fs.existsSync(path.join(this.currConfig.outDir, "api.lock"))
    );
  }

  // 远端源
  async readRemoteDataSource(config = this.currConfig) {
    // 项目根 就是项目的名
    const projName = this.projectRoot;
    const currProj = {
      originUrl: this.currConfig.originUrl,
      projectName: projName,
    } as any;

    // 只查询当前数据源，用户只关心当前数据源。
    // let oldRemoteSource = DsManager.getLatestDsInProject(currProj);

    // if (!oldRemoteSource) {
    //   if (this.remoteDataSource) {
    //     DsManager.saveDataSource(currProj, this.remoteDataSource);
    //     oldRemoteSource = this.remoteDataSource;
    //   } else {
    //     const remoteDataSource = await readRemoteDataSource(config, this.report);
    //     this.remoteDataSource = remoteDataSource;
    //     DsManager.saveDataSource(currProj, this.remoteDataSource);
    //     return remoteDataSource;
    //   }
    // }

    const remoteDataSource = await readRemoteDataSource(config, this.report);
    this.remoteDataSource = remoteDataSource;

    // const { modDiffs, boDiffs } = diffDses(oldRemoteSource, this.remoteDataSource);

    // if (modDiffs.length || boDiffs.length) {
    //   DsManager.saveDataSource(currProj, this.remoteDataSource);
    // }

    return remoteDataSource;
  }

  // 派遣 递归 执行文件方法
  dispatch(files: {}) {
    console.log('files--di', files)
    return _.mapValues(files, (value: Function | {}) => {
      console.log('value', value.toString())
      console.log('value', typeof value)
      if (typeof value === "function") {
        console.log('???')
        
        return value();
      }

      if (typeof value === "object") {
        return this.dispatch(value);
      }

      return value;
    });
  }

  // 获取生成的文件
  getGeneratedFiles() {
    // 设置文件生成器
    this.setFilesManager();

    const files = this.fileManager.fileStructures.getFileStructures();
    console.log("files--", files);
    try {
      return this.dispatch(files);
    } catch (err) {
      error(err)
      return {};
    }
  }

  async regenerateFiles() {
    console.log("><>????");
    const files = this.getGeneratedFiles();
    console.log("files", files);
    await this.fileManager.regenerate(files);
  }

  setFilesManager() {
    this.report("文件生成器创建中...");
    const { default: Generator, FileStructures: MyFileStructures } =
      getTemplate(this.currConfig.templatePath, this.currConfig.templateType);

    // 所有的本地数据源 创建 generators
    const generators = this.allLocalDataSources.map((dataSource) => {
      const config = this.getConfigByDataSourceName(dataSource.name);
      const generator: CodeGenerator = new CodeGenerator(
        this.currConfig.surrounding,
        config?.outDir
      );
      generator.setDataSource(dataSource);
      generator.usingMultipleOrigins = this.currConfig.usingMultipleOrigins;

      if (_.isFunction(generator.getDataSourceCallback)) {
        generator.getDataSourceCallback(dataSource);
      }
      return generator;
    });

    // 文件结构
    let FileStructuresClazz = FileStructures as any;

    if (MyFileStructures) {
      FileStructuresClazz = MyFileStructures;
    }
    this.fileManager = new FilesManager(
      new FileStructuresClazz(
        generators,
        this.currConfig.usingMultipleOrigins,
        this.currConfig.surrounding,
        this.currConfig.outDir,
        this.currConfig.templateType
      ),
      this.currConfig.outDir
    );

    this.fileManager.prettierConfig = this.currConfig.prettierConfig;

    this.report("文件生成器创建成功！");
    this.fileManager.report = this.report;
  }

  /** 获取当前dataSource对应的config */
  getConfigByDataSourceName(name: string) {
    if (name) {
      return (
        this.allConfigs.find((config) => config.name === name) ||
        this.currConfig
      );
    }

    // 没有name时，表示是单数据源
    return this.currConfig;
  }
}
