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
  #raw?: {
    query: string;
    params: Array<any>;
  };

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

  #checkRawQuery() {
    if (this.#raw) {
      throw `[QueryBuilder:select] Raw SQL query has been declared using .raw(), all query building functions have been disabled.`;
    }
  }

  raw(query: string, params: Array<any> = []) {
    if (this.#raw) {
      this.#warnUnique("raw");
    }

    this.#raw = {
      query,
      params,
    };

    return this;
  }

  from(tableName: string) {
    this.#checkRawQuery();

    if (this.#table) {
      this.#warnUnique("from");
    }

    this.#table = tableName;
    return this;
  }

  column(column: string | any) {
    this.#checkRawQuery();

    this.#columns.add(column);
    return this;
  }

  columns(...columns: Array<string | any>) {
    this.#checkRawQuery();

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
    this.#checkRawQuery();

    if (this.#limit) {
      this.#warnUnique("limit");
    }

    this.#limit = limit;
    return this;
  }

  offset(offset: number) {
    this.#checkRawQuery();

    if (this.#offset) {
      this.#warnUnique("offset");
    }

    this.#offset = offset;
    return this;
  }

  context(context: string) {
    this.#checkRawQuery();

    if (this.#contexts.length) {
      this.#warnUnique("context");
    }

    this.#contexts = [context];
    return this;
  }

  contexts(...contexts: Array<string>) {
    this.#checkRawQuery();

    if (this.#contexts.length) {
      this.#warnUnique("contexts");
    }

    this.#contexts = contexts;
    return this;
  }

  where(whereClause: Record<string, any>) {
    this.#checkRawQuery();

    if (this.#where) {
      this.#warnUnique("where");
    }

    this.#where = whereClause;
    return this;
  }

  orderBy(...params: Array<OrderByParams>) {
    this.#checkRawQuery();

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
    if (this.#raw) {
      return {
        $raw: {
          query: this.#raw.query,
          params: this.#raw.params,
        },
      };
    }

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
