import { StandardDataSource } from "./standard";
import { Config, DataSourceConfig } from "./utils";
import * as fs from 'fs-extra';
import * as path from 'path';
import { info as debugInfo } from './debugLog';
import { readRemoteDataSource } from './scripts';
import { DsManager } from './DsManager';


// 管理 生成的代码的文件
export class Manager {
  readonly lockFilename = 'api-lock.json';

  allConfigs: DataSourceConfig[];
  remoteDataSource: StandardDataSource;
  currConfig: DataSourceConfig;

  report = debugInfo;

  constructor(private projectRoot: string, config: Config, configDir = process.cwd()) {
    // this.projectRoot 项目根路径
    // 所有的配置 
    this.allConfigs = config.getDataSourcesConfig(configDir);
    // 当前配置 默认是第一个
    this.currConfig = this.allConfigs[0];
  }

  async ready() {
    console.log('????')
    if (this.existsLocal()) {
      // await this.readLocalDataSource();
      // await this.initRemoteDataSource();
    } else { // 不存在的情况
      console.log('????aaaa')
      const promises = this.allConfigs.map(config => {
        return this.readRemoteDataSource(config);
      });
      // this.allLocalDataSources = await Promise.all(promises);
      // this.currLocalDataSource = this.allLocalDataSources[0];
      // this.remoteDataSource = this.currLocalDataSource;

      // await this.regenerateFiles();
    }
  }
  
  // 是否存在 api.lock 或者 api-lock.json
  existsLocal() {
    return (
      fs.existsSync(path.join(this.currConfig.outDir, this.lockFilename)) ||
      fs.existsSync(path.join(this.currConfig.outDir, 'api.lock'))
    );
  }

  // 远端源
  async readRemoteDataSource(config = this.currConfig) {
    // 项目根 就是项目的名
    const projName = this.projectRoot;
    const currProj = {
      originUrl: this.currConfig.originUrl,
      projectName: projName
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

  async regenerateFiles() {
    console.log('><>????')
    // const files = this.getGeneratedFiles();
    // await this.fileManager.regenerate(files);
  }
}