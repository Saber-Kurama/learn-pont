import { Config, DataSourceConfig } from "./utils";

// 管理 生成的代码的文件
export class Manager {
  readonly lockFilename = 'api-lock.json';

  allConfigs: DataSourceConfig[];
  currConfig: DataSourceConfig;
  constructor(private projectRoot: string, config: Config, configDir = process.cwd()) {
    this.allConfigs = config.getDataSourcesConfig(configDir);
    this.currConfig = this.allConfigs[0];
  }

  async ready() {
    // if (this.existsLocal()) {
    //   await this.readLocalDataSource();
    //   await this.initRemoteDataSource();
    // } else {
    //   const promises = this.allConfigs.map(config => {
    //     return this.readRemoteDataSource(config);
    //   });
    //   this.allLocalDataSources = await Promise.all(promises);
    //   this.currLocalDataSource = this.allLocalDataSources[0];
    //   this.remoteDataSource = this.currLocalDataSource;

    //   await this.regenerateFiles();
    // }
  }

  async regenerateFiles() {
    // const files = this.getGeneratedFiles();
    // await this.fileManager.regenerate(files);
  }
}