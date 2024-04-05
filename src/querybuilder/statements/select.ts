import { OrbisDB } from "../../index.js";

import { $in } from "./operators.js";
import { StatementHistory } from "./historyProvider.js";
import { OrderByParams, SqlSelectBuilder } from "./sqlbuild/index.js";

import { catchError } from "../../util/tryit.js";
import { OrbisError } from "../../util/results.js";

// TODO: Improve typing for operators (and enable nested queries)
export class SelectStatement<T = Record<string, any>> extends StatementHistory {
  #orbis: OrbisDB;
  #table?: string;
  #columns: Set<string> = new Set();
  #limit?: number;
  #offset?: number;
  #contexts: Array<string> = [];
  #where?: Record<string, any>;
  #orderBy?: Array<OrderByParams>;

  constructor(orbis: OrbisDB) {
    super();
    this.#orbis = orbis;
  }

  static buildQueryFromJson(jsonQuery: Record<string, any>) {
    const builder = new SqlSelectBuilder(jsonQuery);
    return builder.build();
  }

  #warnUnique(method: string) {
    console.warn(
      `[QueryBuilder:select] Overwriting existing ${method} data. Only the last .${method}() call will be used.`
    );
  }

  from(tableName: string) {
    if (this.#table) {
      this.#warnUnique("from");
    }

    this.#table = tableName;
    return this;
  }

  column(column: string | any) {
    this.#columns.add(column);
    return this;
  }

  columns(...columns: Array<string | any>) {
    const _columns = new Set(columns);
    this.#columns = new Set([...this.#columns, ..._columns]);
    return this;
  }

  deselectColumn(column: string) {
    this.#columns.delete(column);
    return this;
  }

  clearColumns() {
    this.#columns = new Set();
    return this;
  }

  limit(limit: number) {
    if (this.#limit) {
      this.#warnUnique("limit");
    }

    this.#limit = limit;
    return this;
  }

  offset(offset: number) {
    if (this.#offset) {
      this.#warnUnique("offset");
    }

    this.#offset = offset;
    return this;
  }

  context(context: string) {
    if (this.#contexts.length) {
      this.#warnUnique("context");
    }

    this.#contexts = [context];
    return this;
  }

  contexts(...contexts: Array<string>) {
    if (this.#contexts.length) {
      this.#warnUnique("contexts");
    }

    this.#contexts = contexts;
    return this;
  }

  where(whereClause: Record<string, any>) {
    if (this.#where) {
      this.#warnUnique("where");
    }

    this.#where = whereClause;
    return this;
  }

  orderBy(...params: Array<OrderByParams>) {
    if (this.#orderBy) {
      this.#warnUnique("orderBy");
    }

    if (!params.length) {
      this.#orderBy = undefined;
      return this;
    }

    this.#orderBy = params;
    return this;
  }

  #checkForImplicitIn(whereClause: Record<string, any>) {
    for (const [key, value] of Object.entries(whereClause)) {
      if (!Array.isArray(value)) {
        if (typeof value === "object") {
          whereClause[key] = this.#checkForImplicitIn(value);
        }
        continue;
      }

      if (!["$in", "$and", "$or"].includes(key)) {
        whereClause[key] = $in(...value);
        continue;
      }

      whereClause[key] = value.map((condition: any) => {
        if (typeof condition === "object") {
          return this.#checkForImplicitIn(condition);
        }

        return condition;
      });
    }

    return whereClause;
  }

  get jsonQuery() {
    if (!this.#table) {
      throw "[QueryBuilder:select] Cannot build a select statement without a specified table.";
    }

    const whereClause = {
      ...(this.#where || {}),
      ...((this.#contexts.length && { _metadata_context: this.#contexts }) ||
        {}),
    };

    return {
      $table: this.#table,
      $columns: Array.from(this.#columns),
      $where: this.#checkForImplicitIn(
        Object.keys(whereClause).length > 1
          ? {
              $and: Object.entries(whereClause).map((v: any) => ({
                [v[0]]: v[1],
              })),
            }
          : whereClause
      ),
      $orderBy: this.#orderBy,
      $limit: this.#limit,
      $offset: this.#offset,
    };
  }

  build() {
    const builder = new SqlSelectBuilder(this.jsonQuery);
    return builder.build();
  }

  get runs() {
    return super.runs;
  }

  async run(env?: string) {
    const timestamp = Date.now();
    const query = this.jsonQuery;
    const parsedQuery = this.build();

    const [result, error] = await catchError(() =>
      this.#orbis.node.query<T>(query, env)
    );

    if (error) {
      super.storeResult({
        query: {
          json: query,
          parsed: parsedQuery,
          runOverwriteEnv: env,
          activeNodeEnv: this.#orbis.node.env,
        },
        error,
        success: false,
        timestamp,
      });

      throw new OrbisError(error.message, { error, query, env });
    }

    super.storeResult({
      query: {
        json: query,
        parsed: parsedQuery,
        runOverwriteEnv: env,
        activeNodeEnv: this.#orbis.node.env,
      },
      result,
      success: true,
      timestamp,
    });

    return result;
  }
}
