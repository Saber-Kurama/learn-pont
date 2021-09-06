import { StandardDataSource } from "../standard";
import { DataSourceConfig, Config } from "../utils";
import fetch from 'node-fetch';
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
export class OriginBaseReader {
  constructor(protected config: DataSourceConfig, protected report: any) {}

  /** 翻译中文类名等 */
  async translateChinese() {}

  /** 数据转换，可覆盖 */ // 转换成标准格式
  transform2Standard(data, _usingOperationId: boolean, _originName: string) {
    return data;
  }

  /** 数据获取 */
  fetchMethod(url: string): Promise<string> {
    // 如果有指定的 fetch 方法的话
    if (this.config.fetchMethodPath) {
      const fetchMethod = Config.getFetchMethodFromConfig(this.config);
      return fetchMethod(url);
    }
    return fetch(url).then((res) => res.text());
  }

  /** 获取远程数据源 */
  async fetchData() {
    // 获取数据源
    this.report("获取远程数据中...");
    let swaggerJsonStr: string = await this.fetchMethod(this.config.originUrl);
    console.log('swaggerJsonStr', swaggerJsonStr)
    const data = await JSON.parse(swaggerJsonStr);
    this.report("远程数据获取成功！");

    return data;
  }

  /** 获取接口数据，解析并返回 */
  async fetchRemoteData(): Promise<StandardDataSource> {
    try {
      const data = await this.fetchData();

      // 将数据源转换为标准数据源格式
      let remoteDataSource = this.transform2Standard(
        data,
        this.config.usingOperationId, // 是否使用操作id
        this.config.name
      );
      this.report("远程数据解析完毕!");

      // 如果用户配置了数据的自定义转换方法、如接口过滤等

      // 对解析后的标准数据源进行校验
      console.log('remoteDataSource', remoteDataSource)
      return remoteDataSource;
    } catch (e) {
      throw new Error("读取远程接口数据失败！" + e.toString());
    }
  }

  /** 检查数据源 */
  protected checkDataSource() {}
}
