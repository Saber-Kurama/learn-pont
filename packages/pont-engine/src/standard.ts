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
    const index = codes.indexOf(this.generateCode());
    // 针对参数的处理
    this.typeArgs.forEach(arg => arg.setTemplateIndex(classTemplateArgs));
    this.templateIndex = index
  }

  getDefName(originName) {
    let name = this.typeName;

    if (this.isDefsType) {
      name = originName ? `defs.${originName}.${this.typeName}` : `defs.${this.typeName}`;
    }

    return name;
  }

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
