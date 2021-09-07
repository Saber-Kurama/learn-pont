import { SwaggerV2Reader } from "./swagger";
import { DataSourceConfig } from "../utils";

export enum OriginType {
  SwaggerV3 = 'SwaggerV3',
  SwaggerV2 = 'SwaggerV2',
  SwaggerV1 = 'SwaggerV1'
}

// 读取 远端源
export async function readRemoteDataSource(config: DataSourceConfig, report: any) {
  // 通过不同的swagger的版本 做不同的处
  switch (config.originType) {
    case OriginType.SwaggerV3: {
      // return new SwaggerV3Reader(config, report).fetchRemoteData();
    }
    case OriginType.SwaggerV2: {
      return new SwaggerV2Reader(config, report).fetchRemoteData();
    }
    default:
      return new SwaggerV2Reader(config, report).fetchRemoteData();
  }
}