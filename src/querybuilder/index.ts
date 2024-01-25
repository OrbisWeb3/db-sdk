import { DIDAny, OrbisDB } from "../index.js";
import {
  SelectQueryBuilder,
  SelectStatement,
  selectQueryBuilder,
} from "./statements/select.js";

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

  select: SelectQueryBuilder;
  insert: (model: string) => InsertStatement;
  insertBulk: (model: string) => BulkInsertStatement;
  // updateByModel: (model: string, controller?: DIDAny) => UpdateByModelStatement;

  constructor(orbis: OrbisDB) {
    this.#orbis = orbis;
    this.#models = {};

    this.select = selectQueryBuilder.select.bind(selectQueryBuilder);

    this.insert = (model: string) =>
      new InsertStatement(this, this.#fetchModelSchema.bind(this), model);

    this.insertBulk = (model: string) =>
      new BulkInsertStatement(this, this.#fetchModelSchema.bind(this), model);
  }

  async #fetchModelSchema(model: string) {
    if (this.#models[model]) {
      return this.#models[model];
    }

    const {
      content: { schema: modelSchema },
    } = await this.#orbis.ceramic.client.loadStream(model);
    this.#models[model] = modelSchema;

    return modelSchema;
  }

  async #insert(
    table: string,
    content: Record<string, any>
  ): Promise<
    { document: Record<string, any> } & ({ error: string } | { id: string })
  > {
    try {
      // Retrieve clean table name based on the model id passed or return model ID
      let modelId = this.#orbis.node.getTableModelId(table) as string;
      if(!modelId || modelId == undefined) {
        modelId = table;
      }

      // Creating stream on Ceramic using the model retrieved from the mapping
      const { id } = await this.#orbis.ceramic.createDocument({
        model: modelId,
        content,
      });

      return { document: content, id };
    } catch (error: any) {
      return { document: content, error };
    }
  }

  async execute(
    query: SelectStatement | InsertStatement | BulkInsertStatement,
    node?: string | number
  ): Promise<StatementExecuteResult> {

    // Update table name on select to convert it to the actual model id
    if(this.isSelectStatement(query)) {
      let modelId;
      const tableName = (query as any)._single.table; // Get the table name from the query
      console.log("tableName:", tableName);
      // Check if developer used directly a model id or a readable table name
      if(tableName.startsWith("kjzl6")) {
        modelId = tableName;
      } else {
        // Get the model ID mapped to this table name in instance settings
        modelId = this.#orbis.node.getTableModelId(tableName);
        console.log("modelId retrieved from getTableModelId is:", modelId);

        // Force retry to load node's metadata to retrieve latest mapping and try again
        if(!modelId) {
          console.log("Couldn't retrieve modelId for this table name, retrying...");
          await this.#orbis.node.metadata();
          console.log("Forced reload the node's metadata.");
          modelId = this.#orbis.node.getTableModelId(tableName);
          console.log("After retry, modelId is:", modelId);;
        }
      }
       // Set the table to model ID
       (query as any)._single.table = modelId;
    }

    if ("statementType" in query) {
      if (query.statementType === "CERAMIC_INSERT" && "document" in query) {
        const document = await query.document();
        if (!document) {
          throw "Insert statement contains no values.";
        }

        const result = await this.#insert(query.model, document);
        return result;
      }

      if (
        query.statementType === "CERAMIC_BULK_INSERT" &&
        "documents" in query
      ) {
        const documents = await query.documents();

        const results = await Promise.allSettled(
          documents.map(async (content) => this.#insert(query.model, content))
        );

        const errors: Array<{ document: Record<string, any>; error: string }> =
          [];
        const success: Array<{ document: Record<string, any>; id: string }> =
          [];

        for (const result of results) {
          if (result.status !== "fulfilled") {
            errors.push({ document: {}, error: result.reason });
            continue;
          }

          const { value } = result;

          if ("error" in value) {
            errors.push(value);
            continue;
          }

          success.push(value);
        }

        return {
          errors,
          success,
        };
      }

      throw "Unsupported statement type " + query.statementType;
    }

    const { sql, bindings: params } = query.toSQL().toNative();

    return this.#orbis.node.query(sql, params as Array<any>);
  }

  // Will check if query is a select statement
  isSelectStatement(query: any): query is SelectStatement {
    return query._method === "select";
  }
}
