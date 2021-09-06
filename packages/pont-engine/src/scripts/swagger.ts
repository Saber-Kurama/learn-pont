import * as _ from "lodash";
import { OriginBaseReader } from "./base";

// swaggwer
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
  const draftClasses = _.map(swagger.definitions, (def, defName) => {
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
  const defNames = draftClasses.map((clazz) => clazz.name);

  const baseClasses = draftClasses.map((clazz) => {
    const dataType = parseAst2StandardDataType(clazz.defNameAst, defNames, []);
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

      return new Property({
        dataType,
        name: propName,
        description,
        required,
      });
    });

    return new BaseClass({
      description,
      name: clazz.name,
      properties: props,
      templateArgs,
    });
  });

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
    mods: parseSwaggerMods(swagger, defNames, usingOperationId),
    name: originName,
  });
}

export class SwaggerV2Reader extends OriginBaseReader {
  transform2Standard(data, usingOperationId: boolean, originName: string) {
    return transformSwaggerData2Standard(data, usingOperationId, originName);
  }
}
