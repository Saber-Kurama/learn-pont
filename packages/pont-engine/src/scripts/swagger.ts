import * as _ from "lodash";
import { BaseClass, Property, StandardDataSource, StandardDataType } from "../standard";
import { compileTemplate, parseAst2StandardDataType } from "../compiler";
import { OriginBaseReader } from "./base";

// swaggwer

enum SwaggerType {
  integer = 'integer',
  string = 'string',
  file = 'string',
  array = 'array',
  number = 'number',
  boolean = 'boolean',
  object = 'object'
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
    if (type === 'array') {
      // @todo 这个 item 代表的是什么呢
      let itemsType = _.get(items, 'type', '');
      const itemsRef = _.get(items, '$ref', '');

      if (itemsType) {
        if (itemsType === 'integer') {
          itemsType = 'number';
        }

        if (itemsType === 'file') {
          itemsType = 'File';
        }

        let contentType = new StandardDataType([], itemsType, false, -1);

        if (itemsType === 'array') {
          contentType = new StandardDataType([new StandardDataType()], 'Array', false, -1);
        }

        return new StandardDataType([contentType], 'Array', false, -1);
      }

      if (itemsRef) {
        const ast = compileTemplate(itemsRef, compileTemplateKeyword);
        const contentType = parseAst2StandardDataType(ast, defNames, classTemplateArgs);

        return new StandardDataType([contentType], 'Array', false, -1);
      }
    }

    if (typeName === 'integer') {
      typeName = 'number';
    }

    if (typeName === 'file') {
      typeName = 'File';
    }

    // 枚举
    if (schema.enum) {
      // return StandardDataType.constructorWithEnum(parseSwaggerEnumType(schema.enum));
    }

    // 如果是ref 就在才编译
    if ($ref) {
      const ast = compileTemplate($ref, compileTemplateKeyword);

      if (!ast) {
        return new StandardDataType();
      }

      return parseAst2StandardDataType(ast, defNames, classTemplateArgs);
    }

    if (type === 'object') {
      // object 并且有附加属性
      if (additionalProperties) {
        const typeArgs = [
          new StandardDataType(),
          Schema.parseSwaggerSchema2StandardDataType(
            additionalProperties,
            defNames,
            classTemplateArgs,
            compileTemplateKeyword
          )
        ];
        return new StandardDataType(typeArgs, 'ObjectMap', false);
      }
    }

    return new StandardDataType([], typeName, false);
  }
}
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

  static transformSwaggerV3Interface2Standard(
    inter: SwaggerInterface,
    usingOperationId: boolean,
    samePath: string,
    defNames: string[] = []
  ) {
    let name = "";
    const compileTemplateKeyword = "#/components/schemas/";

    if (!usingOperationId || !inter.operationId) {
      name = getIdentifierFromUrl(inter.path, inter.method, samePath);
    } else {
      name = getIdentifierFromOperatorId(inter.operationId);
    }

    const responseSuccessContent = _.get(inter, "responses.200.content", {});

    let responseSchema;
    if (responseSuccessContent) {
      const responseFormat = Object.keys(responseSuccessContent)[0];

      responseSchema = _.get(
        responseSuccessContent,
        `${responseFormat}.schema`,
        {}
      );
    }

    const response = Schema.parseSwaggerSchema2StandardDataType(
      responseSchema,
      defNames,
      [],
      compileTemplateKeyword
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
          defNames,
          [],
          compileTemplateKeyword
        ),
      });
    });

    let interDesc = inter.summary;

    if (inter.description) {
      if (interDesc) {
        interDesc += "\n" + inter.description;
      } else {
        interDesc = inter.description;
      }
    }

    const standardInterface = new Interface({
      consumes: inter.consumes,
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

  static transformSwaggerInterface2Standard(
    inter: SwaggerInterface,
    usingOperationId: boolean,
    samePath: string,
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
        interDesc += "\n" + inter.description;
      } else {
        interDesc = inter.description;
      }
    }

    const standardInterface = new Interface({
      consumes: inter.consumes,
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

// TODO: $ref, options, head
interface SwaggerPathItemObject {
  get?: SwaggerInterface;
  post?: SwaggerInterface;
  put?: SwaggerInterface;
  patch?: SwaggerInterface;
  delete?: SwaggerInterface;
  parameters?: SwaggerParameter[] | SwaggerReferenceObject[]; // 参数？
}

export class SwaggerDataSource {
  paths: { [key in string]: SwaggerPathItemObject };
  tags: { name: string; description: string }[];
  definitions: {
    [key in string]: {
      description: string;
      required?: string[];
      properties: { [key in string]: SwaggerProperty };
    };
  };
}

export function transformSwaggerData2Standard(
  swagger: SwaggerDataSource,
  usingOperationId = true,
  originName = ""
) {
  // 定义
  const draftClasses = _.map(swagger.definitions, (def, defName) => {
    // console.log('def', def)
    console.log("defName", defName);
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
  // names
  const defNames = draftClasses.map((clazz) => clazz.name);

  const baseClasses = draftClasses.map((clazz) => {
    const dataType = parseAst2StandardDataType(clazz.defNameAst, defNames, []);
    console.log('dataType', dataType)
    console.log('clazz', clazz)
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
        templateArgs
      );
      console.log('dataType', dataType)
      return new Property({
        dataType,
        name: propName,
        description,
        required,
      });
    });

    console.log('props', props)

    return new BaseClass({
      description,
      name: clazz.name,
      properties: props,
      templateArgs,
    });
  });
console.log('baseClasses', baseClasses)
  // 排序 重复的name的排序
  baseClasses.sort((pre, next) => {
    if (
      pre.name === next.name &&
      pre.templateArgs.length === next.templateArgs.length
    ) {
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
    // mods: parseSwaggerMods(swagger, defNames, usingOperationId),
    name: originName,
  });
}

export class SwaggerV2Reader extends OriginBaseReader {
  transform2Standard(data, usingOperationId: boolean, originName: string) {
    return transformSwaggerData2Standard(data, usingOperationId, originName);
  }
}
