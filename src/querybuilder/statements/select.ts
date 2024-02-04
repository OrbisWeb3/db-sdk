import { OrbisDB } from "../../index.js";

import { $in } from "./operators.js";
import { StatementHistory } from "./historyProvider.js";

import { catchError } from "../../util/tryit.js";

export type OrderByParams =
  | [string, "asc" | "desc"]
  | Array<[string, "asc" | "desc"]>;

export class SelectStatement<T = Record<string, any>> extends StatementHistory {
  #orbis: OrbisDB;
  #table?: string;
  #fields: Set<string> = new Set();
  #limit?: number;
  #offset?: number;
  #context?: string;
  #where?: Record<string, any>;
  #orderBy?: OrderByParams;

  constructor(orbis: OrbisDB) {
    super();
    this.#orbis = orbis;
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

  field(field: string | any) {
    this.#fields.add(field);
    return this;
  }

  fields(...fields: Array<string | any>) {
    const _fields = new Set(fields);
    this.#fields = new Set([...this.#fields, ..._fields]);
    return this;
  }

  deselectField(field: string) {
    this.#fields.delete(field);
    return this;
  }

  clearFields() {
    this.#fields = new Set();
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
    this.#context = context;
    return this;
  }

  where(whereClause: Record<string, any>) {
    if (this.#where) {
      this.#warnUnique("where");
    }

    this.#where = whereClause;
    return this;
  }

  orderBy(params: OrderByParams) {
    if (this.#orderBy) {
      this.#warnUnique("orderBy");
    }

    if (!params.length) {
      this.#orderBy = undefined;
      return this;
    }

    if (typeof params[0] === "string") {
      this.#orderBy = [params as [string, "asc" | "desc"]];
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

  build() {
    const whereClause = {
      ...(this.#where || {}),
      ...((this.#context && { _metadata_context: this.#context }) || {}),
    };

    // TODO: multiple same-level $not, $or
    return jsonSqlBuilder.$select({
      $from: this.#table,
      ...(this.#fields.size
        ? {
            $columns: Object.fromEntries(
              Array.from(this.#fields).map((v: string | any) => {
                if (typeof v === "string") {
                  return [v, true];
                }
                return Object.entries(v)[0];
              })
            ),
          }
        : {}),
      $where: this.#checkForImplicitIn(
        Object.keys(whereClause).length > 1
          ? {
              $and: Object.entries(whereClause).map((v: any) => ({
                [v[0]]: v[1],
              })),
            }
          : whereClause
      ),
      ...((this.#orderBy && {
        $orderBy: Object.fromEntries(
          (this.#orderBy as any).map((v: any) => [v[0], v[1] === "asc"])
        ),
      }) ||
        {}),
      ...((this.#limit && {
        $limit: this.#limit,
      }) ||
        {}),
      ...((this.#offset && {
        $offset: this.#offset,
      }) ||
        {}),
    });
  }

  get runs() {
    return super.runs;
  }

  async run() {
    const timestamp = Date.now();
    const { sql: query, values: params } = this.build();

    const [result, error] = await catchError(() =>
      this.#orbis.node.query<T>(query, params)
    );

    if (error) {
      super.storeResult({
        query,
        params,
        error,
        success: false,
        timestamp,
      });

      return { query, params, error };
    }

    super.storeResult({
      query,
      params,
      result,
      success: true,
      timestamp,
    });

    return result;
  }
}
