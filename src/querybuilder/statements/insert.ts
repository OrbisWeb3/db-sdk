import { validate as validateJsonSchema } from "jsonschema";
import { StatementHistory } from "./historyProvider.js";
import { OrbisDB } from "../../index.js";

// export class BulkInsertStatement<
//   T = Record<string, any>,
// > extends StatementHistory {
//   #orbis: OrbisDB;
//   #model: string;
//   #context?: string;
//   #values: Array<T> = [];

//   constructor(orbis: OrbisDB, model: string) {
//     super();

//     this.#orbis = orbis;
//     this.#model = model;
//   }

//   async documents(): Promise<Array<T>> {
//     return this.#values;
//   }

//   get model(): string {
//     return this.#model;
//   }

//   async validate(): Promise<
//     | { valid: true }
//     | {
//         valid: false;
//         errors: Array<{ document: T; error: string }>;
//       }
//   > {
//     const schema = await this.#orbis.query.fetchModelSchema(this.model);
//     const results = this.#values.map((value) =>
//       validateJsonSchema(value, schema)
//     );

//     if (results.some((v) => !v.valid)) {
//       return {
//         valid: false,
//         errors: results
//           .filter((v) => !v.valid)
//           .map((v) => ({ document: v.instance, error: v.errors.join(", ") })),
//       };
//     }

//     return { valid: true };
//   }

//   value(v: T): BulkInsertStatement<T> {
//     this.#values = [...this.#values, v];
//     return this;
//   }

//   values(v: T | Array<T>): BulkInsertStatement<T> {
//     this.#values = [...this.#values, ...(Array.isArray(v) ? v : [v])];
//     return this;
//   }

//   context(context: string) {
//     this.#context = context;
//     return this;
//   }
// }

export class InsertStatement<T = Record<string, any>> extends StatementHistory {
  #orbis: OrbisDB;
  #tableName?: string;
  #model?: string;
  #context?: string;
  #value?: T;

  constructor(orbis: OrbisDB, tableOrModelId: string) {
    super();

    this.#orbis = orbis;

    if (this.#orbis.ceramic.isStreamIdString(tableOrModelId)) {
      this.#model = tableOrModelId;
    } else {
      this.#tableName = tableOrModelId;
    }
  }

  async document(): Promise<T | undefined> {
    return this.#value;
  }

  async getTableName() {
    if (this.#tableName) {
      return this.#tableName;
    }

    const { tableName } = await this.#orbis.node.getTableName(
      this.#model as string
    );
    if (!tableName) {
      this.#tableName = this.#model;
      return this.#tableName;
    }

    this.#tableName = tableName;
    return this.#tableName;
  }

  async getModelId() {
    if (this.#model) {
      return this.#model;
    }

    const { modelId } = await this.#orbis.node.getTableModelId(
      this.#tableName as string
    );
    if (!modelId || !this.#orbis.ceramic.isStreamIdString(modelId)) {
      throw "[QueryBuilder:insert] Unable to convert tableName to modelId. Use raw modelId instead.";
    }

    this.#model = modelId;
    return this.#model;
  }

  async validate(): Promise<
    | { valid: true }
    | {
        valid: false;
        error: string;
      }
  > {
    const model = await this.getModelId();
    const schema = await this.#orbis.query.fetchModelSchema(model);
    const result = validateJsonSchema(this.#value, schema);

    if (!result.valid) {
      return {
        valid: false,
        error: result.errors.join(", "),
      };
    }

    return {
      valid: true,
    };
  }

  value(v: T): InsertStatement<T> {
    this.#value = v;
    return this;
  }

  context(context: string) {
    this.#context = context;
    return this;
  }

  async run() {
    if (!this.#value) {
      throw "[QueryBuilder:insert] Cannot create empty document, missing .value()";
    }

    const timestamp = Date.now();
    const model = await this.getModelId();

    const query = {
      content: this.#value,
      context: this.#context,
      model,
    };

    try {
      const document = await this.#orbis.ceramic.createDocument(query);

      super.storeResult({
        timestamp,
        success: true,
        result: document,
        query,
      });

      return document;
    } catch (error) {
      super.storeResult({
        timestamp,
        success: false,
        error,
        query,
      });

      return {
        query,
        error,
      };
    }
  }
}

// async #insert(
//   table: string,
//   content: Record<string, any>
// ): Promise<
//   { document: Record<string, any> } & ({ error: string } | { id: string })
// > {
//   try {
//     // Retrieve clean table name based on the model id passed or return model ID
//     let modelId = this.#orbis.node.getTableModelId(table) as string;
//     if (!modelId || modelId == undefined) {
//       modelId = table;
//     }

//     // Creating stream on Ceramic using the model retrieved from the mapping
//     const { id } = await this.#orbis.ceramic.createDocument({
//       model: modelId,
//       content,
//     });

//     return { document: content, id };
//   } catch (error: any) {
//     return { document: content, error };
//   }
// }

// if (query.statementType === "CERAMIC_INSERT" && "document" in query) {
//       const document = await query.document();
//       if (!document) {
//         throw "Insert statement contains no values.";
//       }

//       const result = await this.#insert(query.model, document);
//       return result;
//     }

//     if (
//       query.statementType === "CERAMIC_BULK_INSERT" &&
//       "documents" in query
//     ) {
//       const documents = await query.documents();

//       const results = await Promise.allSettled(
//         documents.map(async (content) => this.#insert(query.model, content))
//       );

//       const errors: Array<{ document: Record<string, any>; error: string }> =
//         [];
//       const success: Array<{ document: Record<string, any>; id: string }> =
//         [];

//       for (const result of results) {
//         if (result.status !== "fulfilled") {
//           errors.push({ document: {}, error: result.reason });
//           continue;
//         }

//         const { value } = result;

//         if ("error" in value) {
//           errors.push(value);
//           continue;
//         }

//         success.push(value);
//       }

//       return {
//         errors,
//         success,
//       };
//     }

//     throw "Unsupported statement type " + query.statementType;
//   }
