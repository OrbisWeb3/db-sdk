import { OrbisDB } from "../index.js";
import { SelectStatement } from "./statements/select.js";

import { InsertStatement, BulkInsertStatement } from "./statements/insert.js";

export type StatementExecuteResult = Promise<
  | { columns: Array<string>; rows: Array<Record<string, any>> }
  | {
      errors: Array<{ document: Record<string, any>; error: string }>;
      success: Array<{ document: Record<string, any>; id: string }>;
    }
  | ({ document: Record<string, any> } & ({ error: string } | { id: string }))
>;

export class QueryBuilder {
  #orbis: OrbisDB;
  #models: Record<string, Record<string, any>>;

  select: (...fields: Array<string | any>) => SelectStatement;
  insert: (model: string) => InsertStatement;
  insertBulk: (model: string) => BulkInsertStatement;

  constructor(orbis: OrbisDB) {
    this.#orbis = orbis;
    this.#models = {};

    this.insert = (model: string) => new InsertStatement(this.#orbis, model);
    this.insertBulk = (model: string) =>
      new BulkInsertStatement(this.#orbis, model);

    this.select = (...fields: Array<string | any>) => {
      const statement = new SelectStatement(this.#orbis);
      if (fields) statement.fields(...fields);
      return statement;
    };
  }

  async fetchModelSchema(model: string) {
    if (this.#models[model]) {
      return this.#models[model];
    }

    const {
      content: { schema: modelSchema },
    } = await this.#orbis.ceramic.client.loadStream(model);
    this.#models[model] = modelSchema;

    return modelSchema;
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

  // async execute(
  //   query: SelectStatement | InsertStatement | BulkInsertStatement,
  //   node?: string | number
  // ): Promise<StatementExecuteResult> {
  //   if ("statementType" in query) {
  //     if (query.statementType === "CERAMIC_INSERT" && "document" in query) {
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

  //   const { sql, bindings: params } = query.toSQL().toNative();
  //   return this.#orbis.node.query(sql, params as Array<any>);
  // }
}
