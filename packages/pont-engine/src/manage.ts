import { Config, DataSourceConfig } from "./utils";
import * as fs from 'fs-extra';
import * as path from 'path'

// 管理 生成的代码的文件
export class Manager {
  readonly lockFilename = 'api-lock.json';

  allConfigs: DataSourceConfig[];
  currConfig: DataSourceConfig;
  constructor(private projectRoot: string, config: Config, configDir = process.cwd()) {
    // this.projectRoot 项目根路径
    // 所有的配置 
    this.allConfigs = config.getDataSourcesConfig(configDir);
    // 当前配置 默认是第一个
    this.currConfig = this.allConfigs[0];
  }

  async ready() {
    if (this.existsLocal()) {
      // await this.readLocalDataSource();
      // await this.initRemoteDataSource();
    } else { // 不存在的情况
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

  async regenerateFiles() {
    // const files = this.getGeneratedFiles();
    // await this.fileManager.regenerate(files);
  }
}