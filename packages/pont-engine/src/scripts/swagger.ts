import * as _ from "lodash";
import {
  BaseClass,
  Mod,
  Interface,
  Property,
  StandardDataSource,
  StandardDataType,
} from "../standard";
import {
  toDashCase,
  getMaxSamePath,
  getIdentifierFromUrl,
  getIdentifierFromOperatorId,
  hasChinese,
  transformCamelCase,
  transformModsName
} from "../utils";
import { compileTemplate, parseAst2StandardDataType } from "../compiler";
import { OriginBaseReader } from "./base";

// swaggwer

enum SwaggerType {
  integer = "integer",
  string = "string",
  file = "string",
  array = "array",
  number = "number",
  boolean = "boolean",
  object = "object",
}

// Swagger 的 property 属性
class SwaggerProperty {
  type: SwaggerType;
  enum? = [] as string[];
  items? = null as {
    type?: SwaggerType;
    $ref?: string;
  };
  additionalProperties: SwaggerProperty;
  $ref? = "";
  description? = "";
  name: string;
}

// 参数类型
class SwaggerParameter {
  /** 字段名 */
  name = "";

  in: "query" | "body" | "path";

  /** 描述 */
  description = "";

  /** 是否必填 */
  required: boolean;

  /** 类型 */
  type: SwaggerType;

  enum: string[];

  items? = null as {
    type?: SwaggerType;
    $ref?: string;
  };

  schema: Schema;
}
class Schema {
  enum?: string[]; // 枚举值
  type: SwaggerType;
  additionalProperties?: Schema;
  items: {
    type?: SwaggerType;
    $ref?: string;
  };
  $ref: string;

  // 解析 swagger 的 Schema to 标准datatype
  static parseSwaggerSchema2StandardDataType(
    schema: Schema,
    defNames: string[],
    classTemplateArgs = [] as StandardDataType[],
    compileTemplateKeyword?: string
  ) {
    const { items, $ref, type, additionalProperties } = schema;
    let typeName = schema.type as string;

    // 如果是数组
    if (type === "array") {
      // @todo 这个 item 代表的是什么呢
      let itemsType = _.get(items, "type", "");
      const itemsRef = _.get(items, "$ref", "");

      if (itemsType) {
        if (itemsType === "integer") {
          itemsType = "number";
        }

        if (itemsType === "file") {
          itemsType = "File";
        }

        let contentType = new StandardDataType([], itemsType, false, -1);

        if (itemsType === "array") {
          contentType = new StandardDataType(
            [new StandardDataType()],
            "Array",
            false,
            -1
          );
        }

        return new StandardDataType([contentType], "Array", false, -1);
      }

      if (itemsRef) {
        const ast = compileTemplate(itemsRef, compileTemplateKeyword);
        const contentType = parseAst2StandardDataType(
          ast,
          defNames,
          classTemplateArgs
        );

        return new StandardDataType([contentType], "Array", false, -1);
      }
    }

    if (typeName === "integer") {
      typeName = "number";
    }

    if (typeName === "file") {
      typeName = "File";
    }

    // 枚举
    if (schema.enum) {
      return StandardDataType.constructorWithEnum(
        parseSwaggerEnumType(schema.enum)
      );
    }

    // 如果是ref 就在才编译
    if ($ref) {
      const ast = compileTemplate($ref, compileTemplateKeyword);

      if (!ast) {
        return new StandardDataType();
      }

      return parseAst2StandardDataType(ast, defNames, classTemplateArgs);
    }

    if (type === "object") {
      // object 并且有附加属性
      if (additionalProperties) {
        const typeArgs = [
          new StandardDataType(),
          Schema.parseSwaggerSchema2StandardDataType(
            additionalProperties,
            defNames,
            classTemplateArgs,
            compileTemplateKeyword
          ),
        ];
        return new StandardDataType(typeArgs, "ObjectMap", false);
      }
    }

    return new StandardDataType([], typeName, false);
  }
}

export function parseSwaggerEnumType(enumStrs: string[]) {
  let enums = enumStrs as Array<string | number>;

  enumStrs.forEach((str) => {
    if (!Number.isNaN(Number(str))) {
      enums.push(Number(str));
    }
  });

  return enums
    .filter((str) => {
      return String(str).match(/^[0-9a-zA-Z\_\-\$]+$/);
    })
    .map((numOrStr) => {
      if (typeof numOrStr === "string") {
        return `'${numOrStr}'`;
      }

      return numOrStr;
    });
}

// swagger 接口类
class SwaggerInterface {
  consumes = [] as string[];

  parameters = [] as SwaggerParameter[];

  summary = "";

  description: string;

  initialValue: string;

  tags = [] as string[];

  response: Schema;

  method: string;

  name: string;

  path: string;

  samePath: string;

  operationId: string;

  // static transformSwaggerV3Interface2Standard(
  //   inter: SwaggerInterface,
  //   usingOperationId: boolean,
  //   samePath: string,
  //   defNames: string[] = []
  // ) {
  //   let name = "";
  //   const compileTemplateKeyword = "#/components/schemas/";

  //   if (!usingOperationId || !inter.operationId) {
  //     name = getIdentifierFromUrl(inter.path, inter.method, samePath);
  //   } else {
  //     name = getIdentifierFromOperatorId(inter.operationId);
  //   }

  //   const responseSuccessContent = _.get(inter, "responses.200.content", {});

  //   let responseSchema;
  //   if (responseSuccessContent) {
  //     const responseFormat = Object.keys(responseSuccessContent)[0];

  //     responseSchema = _.get(
  //       responseSuccessContent,
  //       `${responseFormat}.schema`,
  //       {}
  //     );
  //   }

  //   const response = Schema.parseSwaggerSchema2StandardDataType(
  //     responseSchema,
  //     defNames,
  //     [],
  //     compileTemplateKeyword
  //   );

  //   const parameters = (inter.parameters || []).map((param) => {
  //     let paramSchema: Schema;
  //     const {
  //       description,
  //       items,
  //       name,
  //       type,
  //       schema = {} as Schema,
  //       required,
  //     } = param;
  //     // 如果请求参数在body中的话，处理方式与response保持一致，因为他们本身的结构是一样的
  //     if (param.in === "body") {
  //       paramSchema = param.schema;
  //     } else {
  //       paramSchema = {
  //         enum: param.enum,
  //         items,
  //         type,
  //         $ref: _.get(schema, "$ref"),
  //       };
  //     }

  //     return new Property({
  //       in: param.in,
  //       description,
  //       name: name.includes("/") ? name.split("/").join("") : name,
  //       required,
  //       dataType: Schema.parseSwaggerSchema2StandardDataType(
  //         paramSchema,
  //         defNames,
  //         [],
  //         compileTemplateKeyword
  //       ),
  //     });
  //   });

  //   let interDesc = inter.summary;

  //   if (inter.description) {
  //     if (interDesc) {
  //       interDesc += "\n" + inter.description;
  //     } else {
  //       interDesc = inter.description;
  //     }
  //   }

  //   const standardInterface = new Interface({
  //     consumes: inter.consumes,
  //     description: interDesc,
  //     name,
  //     method: inter.method,
  //     path: inter.path,
  //     response,
  //     /** 后端返回的参数可能重复 */
  //     parameters: _.unionBy(parameters, "name"),
  //   });

  //   return standardInterface;
  // }

  static transformSwaggerInterface2Standard(
    inter: SwaggerInterface, // 接口
    usingOperationId: boolean, // 是否使用操作符
    samePath: string, // 最长相同路径
    defNames: string[] = [],
    compileTempateKeyword?: string
  ) {
    let name = "";

    if (!usingOperationId || !inter.operationId) {
      name = getIdentifierFromUrl(inter.path, inter.method, samePath);
    } else {
      name = getIdentifierFromOperatorId(inter.operationId);
    }

    const responseSchema = _.get(inter, "responses.200.schema", {}) as Schema;
    const response = Schema.parseSwaggerSchema2StandardDataType(
      responseSchema,
      defNames,
      [],
      compileTempateKeyword
    );

    const parameters = (inter.parameters || []).map((param) => {
      let paramSchema: Schema;
      const {
        description,
        items,
        name,
        type,
        schema = {} as Schema,
        required,
      } = param;
      // 如果请求参数在body中的话，处理方式与response保持一致，因为他们本身的结构是一样的
      if (param.in === "body") {
        paramSchema = param.schema;
      } else {
        paramSchema = {
          enum: param.enum,
          items,
          type,
          $ref: _.get(schema, "$ref"),
        };
      }

      return new Property({
        in: param.in,
        description,
        name: name.includes("/") ? name.split("/").join("") : name,
        required,
        dataType: Schema.parseSwaggerSchema2StandardDataType(
          paramSchema,
          defNames
        ),
      });
    });

    let interDesc = inter.summary;

    if (inter.description) {
      if (interDesc) {
        // 摘要加描述信息
        interDesc += "\n" + inter.description;
      } else {
        interDesc = inter.description;
      }
    }

    const standardInterface = new Interface({
      consumes: inter.consumes, // 消费 --- 格式（json ，文件上传）
      description: interDesc,
      name,
      method: inter.method,
      path: inter.path,
      response,
      /** 后端返回的参数可能重复 */
      parameters: _.unionBy(parameters, "name"),
    });

    return standardInterface;
  }
}

interface SwaggerReferenceObject {
  $ref: string;
}

// TODO: $ref, options, head

// paths 的数据结构
interface SwaggerPathItemObject {
  get?: SwaggerInterface;
  post?: SwaggerInterface;
  put?: SwaggerInterface;
  patch?: SwaggerInterface;
  delete?: SwaggerInterface;
  parameters?: SwaggerParameter[] | SwaggerReferenceObject[]; // 参数？
}

export class SwaggerDataSource {
  // 接口 paths
  paths: { [key in string]: SwaggerPathItemObject };
  // 标签分类 tags
  tags: { name: string; description: string }[];
  // 定义 类 数据结构 请求的 参数 请求的返回
  definitions: {
    [key in string]: {
      description: string;
      required?: string[];
      properties: { [key in string]: SwaggerProperty };
    };
  };
}

export function parseSwaggerMods(
  swagger: SwaggerDataSource,
  defNames: string[],
  usingOperationId: boolean,
  compileTempateKeyword?: string // 编译模板关键字
) {
  const allSwaggerInterfaces = [] as SwaggerInterface[];
  _.forEach(swagger.paths, (methodInters, path) => {
    const pathItemObject = _.cloneDeep(methodInters);
    // 参数调整
    if (Array.isArray(pathItemObject.parameters)) {
      ["get", "post", "patch", "delete", "put"].forEach((method) => {
        if (pathItemObject[method]) {
          pathItemObject[method].parameters = (
            pathItemObject[method].parameters || []
          ).concat(pathItemObject.parameters);
        }
      });

      delete pathItemObject.parameters;
    }

    // 内循环 method
    _.forEach(
      pathItemObject as Omit<SwaggerPathItemObject, "parameters">,
      (inter, method) => {
        inter.path = path;
        inter.method = method;

        if (!inter.tags) {
          inter.tags = ["defaultModule"];
        }

        allSwaggerInterfaces.push(inter);
      }
    );
  });

  if (!swagger.tags) {
    swagger.tags = [];
  }

  // 添加一个默认的 tag
  swagger.tags.push({
    name: "defaultModule",
    description: "defaultModule",
  });

  // swagger 2.0 中 tags属性是可选的
  const mods = swagger.tags.map((tag) => {
    console.log("tag", tag);
    // 包含当前 tag 中的modInterfaces
    const modInterfaces = allSwaggerInterfaces.filter((inter) => {
      // swagger 3.0+ 中可能不存在 description 字段
      if (tag.description === undefined || tag.description === null) {
        tag.description = "";
      }

      return (
        inter.tags.includes(tag.name) ||
        inter.tags.includes(tag.name.toLowerCase()) ||
        inter.tags.includes(tag.description.toLowerCase()) ||
        inter.tags.includes(toDashCase(tag.description))
      );
    });

    // 最长相同路径
    const samePath = getMaxSamePath(
      modInterfaces.map((inter) => inter.path.slice(1))
    );
    console.log("samePath", samePath);
    const standardInterfaces = modInterfaces.map((inter) => {
      return SwaggerInterface.transformSwaggerInterface2Standard(
        inter,
        usingOperationId,
        samePath,
        defNames,
        compileTempateKeyword
      );
    });

    // 判断是否有重复的 name
    if (usingOperationId) {
      const names = [] as string[];

      standardInterfaces.forEach((inter) => {
        if (!names.includes(inter.name)) {
          names.push(inter.name);
        } else {
          // 如果有 重复的名称 通过 url 地址生成
          inter.name = getIdentifierFromUrl(inter.path, inter.method, samePath);
        }
      });
    }

    // 兼容某些项目把swagger tag的name和description弄反的情况
    if (hasChinese(tag.name)) {
      // 当检测到name包含中文的时候，采用description
      return new Mod({
        description: tag.name,
        interfaces: _.uniqBy(standardInterfaces, "name"),
        name: transformCamelCase(tag.description),
      });
    } else {
      return new Mod({
        description: tag.description,
        interfaces: _.uniqBy(standardInterfaces, "name"),
        name: transformCamelCase(tag.name),
      });
    }
  })
  .filter(mod => {
    return mod.interfaces.length;
  });

  transformModsName(mods);

  return mods;
}

// swagger2 数据转换成 标准数据
export function transformSwaggerData2Standard(
  swagger: SwaggerDataSource,
  usingOperationId = true,
  originName = ""
) {
  // 找到所有的定义的类
  const draftClasses = _.map(swagger.definitions, (def, defName) => {
    // console.log('def', def)
    console.log("defName", defName);
    // 针对 def的name的进行编译 生成 defNameAst(可能会有参数)
    const defNameAst = compileTemplate(defName);

    if (!defNameAst) {
      throw new Error("compiler error in defname: " + defName);
    }

    return {
      name: defNameAst.name,
      defNameAst,
      def,
    };
  });
  console.log("draftClasses", draftClasses);
  // 所有类的名字
  const defNames = draftClasses.map((clazz) => clazz.name);

  // 生成 基本 类
  const baseClasses = draftClasses.map((clazz) => {
    // 转换成标准数据
    const dataType = parseAst2StandardDataType(clazz.defNameAst, defNames, []);
    console.log("dataType", dataType);
    console.log("clazz", clazz);
    // 类型参数
    const templateArgs = dataType.typeArgs;
    const { description, properties } = clazz.def;
    const requiredProps = clazz.def.required || [];

    const props = _.map(properties, (prop, propName) => {
      const { $ref, description, type, items, additionalProperties } = prop;
      const required = requiredProps.includes(propName);

      const dataType = Schema.parseSwaggerSchema2StandardDataType(
        {
          $ref,
          enum: prop.enum,
          items,
          type,
          additionalProperties,
        } as Schema,
        defNames,
        templateArgs // 类型参数 是否 属性参数 中有一样的
      );
      // console.log('dataType', dataType)
      return new Property({
        dataType,
        name: propName,
        description,
        required,
      });
    });

    // console.log('props', props)

    return new BaseClass({
      description,
      name: clazz.name,
      properties: props,
      templateArgs,
    });
  });
  console.log("baseClasses", baseClasses);
  // 排序 重复的name的排序 (重载？)
  baseClasses.sort((pre, next) => {
    // 名字相同， 参数相同
    if (
      pre.name === next.name &&
      pre.templateArgs.length === next.templateArgs.length
    ) {
      // 过滤掉 isDefsType 看 长度
      return pre.templateArgs.filter(({ isDefsType }) => isDefsType).length >
        next.templateArgs.filter(({ isDefsType }) => isDefsType).length
        ? -1
        : 1;
    }

    if (pre.name === next.name) {
      return pre.templateArgs.length > next.templateArgs.length ? -1 : 1;
    }

    return next.name > pre.name ? 1 : -1;
  });
  return new StandardDataSource({
    baseClasses: _.uniqBy(baseClasses, (base) => base.name),
    mods: parseSwaggerMods(swagger, defNames, usingOperationId),
    name: originName,
  });
}

// 继承  OriginBaseReader 重写 transform2Standard  方法
export class SwaggerV2Reader extends OriginBaseReader {
  transform2Standard(data, usingOperationId: boolean, originName: string) {
    return transformSwaggerData2Standard(data, usingOperationId, originName);
  }
}
