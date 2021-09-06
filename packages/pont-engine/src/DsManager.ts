/**
 * @author jasonHzq
 * @description 持久化接口变更记录。
 *
 * 设计思路
 *
 * 在 ~/.pont 下保存接口变更记录。每个项目（Project）占用一个目录。
 * 保存一份总的 manifest 的 JSON 文件。该文件包括所有项目的信息，始终和接口变更目录保持一致。方便做信息查询。
 *
 * 项目（Project）以用户的项目加 originUrl 两个字段来唯一确定。
 *
 * 生成报表使用 diffs 方法来分析变更信息。
 * @todo 报表渲染待优化
 */

class LocalDsManager {
  static singleInstance = null as LocalDsManager
  static getSingleInstance() {
    if(!LocalDsManager.singleInstance){
      LocalDsManager.singleInstance = new LocalDsManager()
    }
    return LocalDsManager.singleInstance
  }
} 
 const DsManager = LocalDsManager.getSingleInstance();
 export { DsManager };