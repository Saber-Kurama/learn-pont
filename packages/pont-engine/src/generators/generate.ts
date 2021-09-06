/**
 * @description get code using standard dataSource format
 * 使用标准数据源格式获取代码
 * @NOTE getd files structure is as below:
 * - library (contains class library code)
 * - interfaces (contains interfaces code)
 * - api.d.ts (contains interfaces and library definitions)
 * - api.lock (contains local code state)
 */
import * as _ from "lodash";
import * as fs from "fs-extra";
import * as path from "path";
import { format, getFileName, Surrounding } from "../utils";
import { info } from "../debugLog";
import { BaseClass, StandardDataSource } from "../standard";

// 文件结构类
export class FileStructures {
  constructor(
    private generators: CodeGenerator[], // 代码生成器
    private usingMultipleOrigins: boolean, // 是否是使用多源
    private surrounding = Surrounding.typeScript, // js 还是 ts
    private baseDir = "src/service", // 基本目录
    private templateType = "" // 模板
  ) {}

  //  多源
  getMultipleOriginsFileStructures() {
    const files = {};

    this.generators
      .filter((generator) => generator.outDir === this.baseDir)
      .forEach((generator) => {
        const dsName = generator.dataSource.name;
        const dsFiles = this.getOriginFileStructures(generator, true);

        files[dsName] = dsFiles;
      });

    return {
      ...files,
      [getFileName("index", this.surrounding)]:
        this.getDataSourcesTs.bind(this),
      "api.d.ts": this.getDataSourcesDeclarationTs.bind(this),
      "api-lock.json": this.getLockContent.bind(this),
    };
  }
  // 生成 基类
  getBaseClassesInDeclaration(
    originCode: string,
    usingMultipleOrigins: boolean
  ) {
    if (usingMultipleOrigins) {
      return `
      declare namespace defs {
        export ${originCode}
      };
      `;
    }

    return `
      declare ${originCode}
    `;
  }

  // 获取源的文件结构
  getOriginFileStructures(
    generator: CodeGenerator,
    usingMultipleOrigins = false
  ) {
    let mods = {};
    const dataSource = generator.dataSource;

    const indexFileName = getFileName("index", this.surrounding);

    // dataSource.mods.forEach(mod => {
    //   const currMod = {};

    //   mod.interfaces.forEach(inter => {
    //     currMod[getFileName(inter.name, this.surrounding)] = generator.getInterfaceContent.bind(generator, inter);
    //     currMod[indexFileName] = generator.getModIndex.bind(generator, mod);
    //   });
    //   const modName = reviseModName(mod.name);
    //   mods[modName] = currMod;

    //   mods[indexFileName] = generator.getModsIndex.bind(generator);
    // });

    if (!generator.hasContextBund) {
      generator.getBaseClassesInDeclaration =
        this.getBaseClassesInDeclaration.bind(
          this,
          generator.getBaseClassesInDeclaration(),
          usingMultipleOrigins
        );
      // generator.getModsDeclaration = this.getModsDeclaration.bind(
      //   this,
      //   generator.getModsDeclaration(),
      //   usingMultipleOrigins
      // );
      generator.hasContextBund = true;
    }
    console.log('generator', generator.getIndex)
    console.log('generator', generator.getDeclaration)
    const result = {
      // [getFileName("baseClass", this.surrounding)]:
      //   generator.getBaseClassesIndex.bind(generator),
      // mods: mods,
      // [indexFileName]: generator.getIndex.bind(generator),
      "api.d.ts": generator.getDeclaration.bind(generator),
    };

    if (!usingMultipleOrigins) {
      // result["api-lock.json"] = this.getLockContent.bind(this);
    }

    return result;
  }

  // 获取文件
  getFileStructures() {
    const result =
      this.usingMultipleOrigins || this.generators.length > 1
        ? // 多源
          this.getMultipleOriginsFileStructures()
        : // 单个
          this.getOriginFileStructures(this.generators[0]);
    // js环境时，默认为新用户，生成pontCore文件
    if (this.surrounding === Surrounding.javaScript) {
      // if (!fs.existsSync(this.baseDir + '/pontCore.js')) {
      //   result['pontCore.js'] = getTemplatesDirFile('pontCore.js', 'pontCore/');
      //   result['pontCore.d.ts'] = getTemplatesDirFile('pontCore.d.ts', 'pontCore/');
      // }
      // if (this.templateType && this.checkHasTemplateFetch()) {
      //   result[`${this.templateType}.js`] = getTemplatesDirFile(`${this.templateType}.js`, 'pontCore/');
      //   result[`${this.templateType}.d.ts`] = getTemplatesDirFile(`${this.templateType}.d.ts`, 'pontCore/');
      // }
    }
    console.log("result", result);
    return result;
  }

  // 获取 lock 的文件内容
  getLockContent() {
    if (this.generators) {
      // generators 长度大于1且outDir不相同时，需要拆分生成代码
      const hasMultipleOutDir = this.generators.some((generate) => {
        return generate.outDir !== this.baseDir;
      });

      let dataSources;

      // 只生成当前路径的api.lock
      if (this.generators.length > 1 && hasMultipleOutDir) {
        dataSources = this.generators
          .filter((item) => item.outDir === this.baseDir)
          .map((ge) => ge.dataSource);
      } else {
        dataSources = this.generators.map((ge) => ge.dataSource);
      }

      return JSON.stringify(dataSources, null, 2);
    }
  }
}

// 代码生成器的基础类
export class CodeGenerator {
  // 是否是使用多个源
  usingMultipleOrigins = false;

  dataSource: StandardDataSource;
  // 是否有上下文绑定
  hasContextBund = false;

  constructor(
    public surrounding = Surrounding.typeScript,
    public outDir = ""
  ) {}

  setDataSource(dataSource: StandardDataSource) {
    this.dataSource = dataSource;
    // 将basic-resource这种命名转化成合法命名
    this.dataSource.name = _.camelCase(this.dataSource.name);
  }

  /** 获取某个基类的类型定义代码 */
  getBaseClassInDeclaration(base: BaseClass) {
    if (base.templateArgs && base.templateArgs.length) {
      return `class ${base.name}<${base.templateArgs
        .map((_, index) => `T${index} = any`)
        .join(", ")}> {
          ${base.properties
            .map((prop) => prop.toPropertyCode(Surrounding.typeScript, true))
            .join("\n")}
        }
        `;
    }
    return `class ${base.name} {
        ${base.properties
          .map((prop) => prop.toPropertyCode(Surrounding.typeScript, true))
          .join("\n")}
      }
      `;
  }

  /** 获取所有基类的类型定义代码，一个 namespace
   * surrounding, 优先级高于this.surrounding,用于生成api.d.ts时强制保留类型
   */
  getBaseClassesInDeclaration() {
    const content = `namespace ${this.dataSource.name || "defs"} {
        ${this.dataSource.baseClasses
          .map(
            (base) => `
          export ${this.getBaseClassInDeclaration(base)}
        `
          )
          .join("\n")}
      }
      `;

    return content;
  }

  /** 获取公共的类型定义代码 */
  getCommonDeclaration() {
    return "";
  }

  /** 获取总的类型定义代码 */
  getDeclaration() {
    console.log('<><><>')
    return `
      type ObjectMap<Key extends string | number | symbol = any, Value = any> = {
        [key in Key]: Value;
      }

      
    `;
  }

  /** 获取接口类和基类的总的 index 入口文件代码 */
  getIndex() {
    let conclusion = `
        import * as defs from './baseClass';
        import './mods/';
  
        ${
          this.surrounding === Surrounding.typeScript
            ? "(window as any)"
            : "window"
        }.defs = defs;
      `;

    // dataSource name means multiple dataSource
    if (this.dataSource.name) {
      conclusion = `
          import { ${this.dataSource.name} as defs } from './baseClass';
          export { ${this.dataSource.name} } from './mods/';
          export { defs };
        `;
    }

    return conclusion;
  }

  /** 获取所有基类文件代码 */
  getBaseClassesIndex() {
    const clsCodes = this.dataSource.baseClasses.map(
      (base) => `
          class ${base.name} {
            ${base.properties
              .map((prop) => {
                return prop.toPropertyCodeWithInitValue(base.name);
              })
              .filter((id) => id)
              .join("\n")}
          }
        `
    );

    if (this.dataSource.name) {
      return `
          ${clsCodes.join("\n")}
          export const ${this.dataSource.name} = {
            ${this.dataSource.baseClasses.map((bs) => bs.name).join(",\n")}
          }
        `;
    }

    return clsCodes.map((cls) => `export ${cls}`).join("\n");
  }

  /**
   * 获取中间态数据结构
   * @param dataSource
   */
  getDataSourceCallback(dataSource?: StandardDataSource): void {
    // 空实现, 用于对外暴露文件数据结构
    if (dataSource) {
      return;
    }
  }
}

export class FilesManager {
  // todo: report 可以更改为单例，防止每个地方都注入。
  report = info;
  // 代码格式化
  prettierConfig: {};

  constructor(public fileStructures: FileStructures, private baseDir: string) {}

  /** 初始化清空路径 */
  private initPath(path: string) {
    if (!fs.existsSync(path)) {
      fs.mkdirpSync(path);
    }
  }

  async regenerate(files: {}, oldFiles?: {}) {
    // if (report) {
    //   this.report = report;
    // }

    this.initPath(this.baseDir);
    this.created = true;

    if (oldFiles && Object.keys(oldFiles || {}).length) {
      // const updateTask = this.diffFiles(files, oldFiles);
      // if (updateTask.deletes && updateTask.deletes.length) {
      //   this.report(`删除${updateTask.deletes.length}个文件及文件夹`);
      //   await Promise.all(
      //     updateTask.deletes.map((filePath) => {
      //       fs.unlink(filePath);
      //     })
      //   );
      // }
      // if (updateTask.updateCnt) {
      //   this.report(`更新${updateTask.updateCnt}个文件`);
      //   console.time(`更新${updateTask.updateCnt}个文件`);
      //   await this.updateFiles(updateTask.files);
      //   console.timeEnd(`更新${updateTask.updateCnt}个文件`);
      // }
    } else {
      await this.generateFiles(files);
    }
  }

  /** 区分lock文件是创建的还是人为更改的 */
  created = false;

  public formatFile(code: string, name = "") {
    if (name && name.endsWith(".json")) {
      return code;
    }

    return format(code, this.prettierConfig);
  }

  /** 根据 Codegenerator 配置生成目录和文件 */
  async generateFiles(files: {}, dir = this.baseDir) {
    const currFiles = await fs.readdir(dir);

    const promises = _.map(files, async (value: string | {}, name) => {
      const currPath = `${dir}/${name}`;

      if (typeof value === "string") {
        if (currFiles.includes(name)) {
          const state = await fs.lstat(currPath);

          if (state.isDirectory()) {
            await fs.unlink(currPath);
            return fs.writeFile(currPath, this.formatFile(value, name));
          } else {
            const newValue = this.formatFile(value);
            const currValue = await fs.readFile(currPath, "utf8");

            if (newValue !== currValue) {
              return fs.writeFile(currPath, this.formatFile(value, name));
            }

            return;
          }
        } else {
          return fs.writeFile(currPath, this.formatFile(value, name));
        }
      }

      // 新路径为文件夹
      if (currFiles.includes(name)) {
        const state = await fs.lstat(currPath);

        if (state.isDirectory()) {
          return this.generateFiles(files[name], currPath);
        } else {
          await fs.unlink(currPath);
          await fs.mkdir(currPath);

          return this.generateFiles(files[name], currPath);
        }
      } else {
        await fs.mkdir(currPath);

        return this.generateFiles(files[name], currPath);
      }
    });

    await Promise.all(promises);
  }
}
