import * as _ from "lodash";
import { Surrounding } from "./utils";

// primitive type 原始类型
export enum PrimitiveType {
  number = "number",
  string = "string",
  boolean = "boolean",
}

// 定义一个上下文
class Contextable {
  getDsName() {
    const context = this.getContext();

    if (context && context.dataSource) {
      return context.dataSource.name;
    }

    return "";
  }

  private context: any;

  getContext() {
    return this.context;
  }

  setContext(context) {
    this.context = context;
  }

  constructor(arg = {}) {
    _.forEach(arg, (value, key) => {
      if (value !== undefined) {
        this[key] = value;
      }
    });
  }

  toJSON() {
    return _.mapValues(this, (value, key) => {
      if (key === "context") {
        return undefined;
      }

      return value;
    });
  }
}


// 标准数据类型
/**
 * 数据类型
 * {
 *  typeArgs: StandardDataType, // 参数的类型
 *  typeName: ，// 数据类型 
 *  isDefsType // 是否是defs
 *  templateIndex: -1; 指向第几个模板  指向类的第几个模板，-1 表示没有 
 *  compileTemplateKeyword, 编译模板的 关键字 ？？
 *  generateCode: function, // 生成代码的函数 
 * }
 */
export class StandardDataType extends Contextable{
  enum: Array<string | number> = [];

  typeProperties: Property[] = [];

  constructor(
    public typeArgs = [] as StandardDataType[],
    /** 例如 number,A(defs.A),Array,Object, '1' | '2' | 'a' 等 */
    public typeName = '',
    public isDefsType = false,
    /** 指向类的第几个模板，-1 表示没有 */
    public templateIndex = -1,
    public compileTemplateKeyword = '#/definitions/'
  ) {
    super();
  }

  // 设置模板索引
  setTemplateIndex(classTemplateArgs: StandardDataType[]) {
    // 根据 模板生成代码
    const codes = classTemplateArgs.map(arg => arg.generateCode());
    // 查看当前代码 在 codes 中的位置
    const index = codes.indexOf(this.generateCode());
    // 针对参数的处理
    this.typeArgs.forEach(arg => arg.setTemplateIndex(classTemplateArgs));
    this.templateIndex = index
  }

  // 获取 def 的名称
  getDefName(originName) {
    let name = this.typeName;

    if (this.isDefsType) {
      name = originName ? `defs.${originName}.${this.typeName}` : `defs.${this.typeName}`;
    }

    return name;
  }

  // 获取 枚举类型
  getEnumType() {
    return this.enum.join(' | ') || 'string';
  }

  /** 生成 Typescript 类型定义的代码 */
  generateCode(originName='') {
    // 如果已经有了模板的话 就直接使用 模板的
    if (this.templateIndex !== -1) {
      return `T${this.templateIndex}`;
    }
    // 如果是枚举的话
    if (this.enum.length) {
      return this.getEnumType();
    }

    // 获取 类型的name
    const name = this.getDefName(originName);

    // 针对参数类型
    if (this.typeArgs.length) {
      return `${name}<${this.typeArgs.map(arg => arg.generateCode(originName)).join(', ')}>`;
    }

    // 针对属性的处理
    if (this.typeProperties.length) {
      const interfaceCode = `{${this.typeProperties.map(property => property.toPropertyCode())}
      }`;

      if (name) {
        return `${name}<${interfaceCode}>`;
      }

      return interfaceCode;
    }

    return name || 'any';
  }
  
  // 获取初始值
  getInitialValue(usingDef = true) {
    if (this.typeName === 'Array') {
      return '[]';
    }

    if (this.isDefsType) {
      const originName = this.getDsName();

      if (!usingDef) {
        return `new ${this.typeName}()`;
      }

      return `new ${this.getDefName(originName)}()`;
    }

    if (this.templateIndex > -1) {
      return 'undefined';
    }

    if (this.typeName === 'string') {
      return "''";
    }

    if (this.typeName === 'boolean') {
      return 'false';
    }

    if (this.enum && this.enum.length) {
      const str = this.enum[0];

      if (typeof str === 'string') {
        return `${str}`;
      }

      return str + '';
    }

    return 'undefined';
  }
}

// 属性 声明的生成
// property both in params and response
export class Property extends Contextable {
  dataType: StandardDataType;
  description?: string;
  name: string;
  required: boolean;

  constructor(prop: Partial<Property>) {
    super(prop);

    // FIXME: name 可能不合法，这里暂时只判断是否包含 . 。
    if (this.name.includes('.')) {
      this.name = this.name.slice(this.name.lastIndexOf('.') + 1);
    }
  }

  // 属性代码
  toPropertyCode(surrounding = Surrounding.typeScript, hasRequired = false, optional = false) {
    let optionalSignal = hasRequired && optional ? '?' : '';

    if (hasRequired && !this.required) {
      optionalSignal = '?';
    }

    let name = this.name;
    if (!name.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      name = `'${name}'`;
    }

    const fieldTypeDeclaration =
      surrounding === Surrounding.javaScript
        ? ''
        : `${optionalSignal}: ${this.dataType.generateCode(this.getDsName())}`;

    return `
      /** ${this.description || this.name} */
      ${name}${fieldTypeDeclaration};`;
  }

  // 具有初始值的 属性代码
  toPropertyCodeWithInitValue(baseName = '') {
    let typeWithValue = `= ${this.dataType.getInitialValue(false)}`;

    if (!this.dataType.getInitialValue(false)) {
      typeWithValue = `: ${this.dataType.generateCode(this.getDsName())}`;
    }

    if (this.dataType.typeName === baseName) {
      typeWithValue = `= {}`;
    }

    let name = this.name;
    if (!name.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      name = `'${name}'`;
    }

    return `
      /** ${this.description || this.name} */
      ${name} ${typeWithValue}
      `;
  }
}

// 实例
export class Interface extends Contextable {

}

// Mod
export class Mod extends Contextable {
  description: string;
  interfaces: Interface[];
  name: string;

  setContext(context: any) {
    super.setContext(context);
    this.interfaces.forEach(inter => inter.setContext(context));
  }

  constructor(mod: Partial<Mod>) {
    super(mod);

    this.interfaces = _.orderBy(this.interfaces, 'path');
  }
}

// 基本类
export class BaseClass extends Contextable {
  name: string;
  description: string;
  properties: Property[];
  templateArgs: StandardDataType[];

  setContext(context: any) {
    super.setContext(context);
    this.properties.forEach(prop => prop.setContext(context));
  }

  constructor(base: Partial<BaseClass>) {
    super(base);

    this.properties = _.orderBy(this.properties, 'name')
  }
}



export class StandardDataSource {
  public name: string;
  public baseClasses: BaseClass[];
  public mods: Mod[];

  constructor(standard: {mods?: Mod[]; name: string; baseClasses: BaseClass[]}) {
    this.mods = standard.mods;
    if (standard.name) {
      this.name = standard.name;
    }
    this.baseClasses = standard.baseClasses;
  }
}
