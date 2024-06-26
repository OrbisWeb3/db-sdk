import { escapeId } from "./escape.js";

/**
 * SQL SELECT TEMPLATE
 * 
 * 
 SELECT
  { <$columns> }
  { FROM [$from] }  
  { [$join] }
  { WHERE [$where] }
  { GROUP BY [$groupBy] }
  { HAVING [$having] }
  { ORDER BY [$orderBy] }
  { LIMIT [$limit] }
  { OFFSET [$offset] }
 * 
 * 
 */

export type OrderByParams = [string, "asc" | "desc"];

class Parameters {
  #values: Array<any> = [];

  get values() {
    return this.#values;
  }

  add(value: any) {
    this.#values.push(value);
    return `$${this.#values.length}`;
  }
}

export class SqlSelectBuilder {
  #params: Parameters = new Parameters();

  #raw?: { query: string; params: Array<any> };
  #table?: string;
  #columns?: Array<string | any>;
  #where?: any;
  #orderBy?: Array<OrderByParams>;
  #limit?: number;
  #offset?: number;

  #query: Array<string> = ["SELECT"];

  constructor(query: Record<string, any>) {
    if (query.$raw) {
      this.#raw = query.$raw;
    } else if (!query.$table) {
      throw "[QueryBuilder:select] Missing table (.from) definition.";
    }

    this.#table = query.$table;
    this.#columns = query.$columns;
    this.#where = query.$where;
    this.#orderBy = query.$orderBy;
    this.#limit = query.$limit;
    this.#offset = query.$offset;
  }

  build() {
    if (this.#raw) {
      return {
        query: this.#raw.query,
        params: this.#raw.params,
      };
    }

    // <columns>
    this.#query.push(this.#buildColumns());

    // FROM
    this.#query.push("FROM");

    // <table>
    this.#query.push(escapeId(this.#table as string));

    // WHERE <>
    this.#query.push(this.#buildWhere());

    // ORDER BY?
    this.#query.push(this.#buildOrderBy());

    // LIMIT?
    this.#query.push(this.#buildLimit());

    // OFFSET?
    this.#query.push(this.#buildOffset());

    return {
      query: this.#query.filter((v) => v).join(" "),
      params: this.#params.values,
    };
  }

  #parseColumnObject(column: {
    [fieldId: string]: {
      [operation: string]: { $expr: string; $distinct: boolean } | string;
    };
  }) {
    const fieldId = Object.keys(column)[0];
    const operation = Object.keys(column[fieldId])[0];
    const parsedOperation = operation.substring(1).toUpperCase();

    if (!["SUM", "COUNT", "AS"].includes(parsedOperation)) {
      throw (
        "[QueryBuilder:select] Invalid aggregate function " + parsedOperation
      );
    }

    const operationParams = column[fieldId][operation];

    if (parsedOperation === "AS") {
      if (typeof operationParams !== "string") {
        throw '[QueryBuilder:select] Invalid "as" params ' + operationParams;
      }

      return `${escapeId(fieldId)} as ${escapeId(operationParams)}`;
    }

    const opField = (operationParams as any)["$expr"];
    const distinct = (operationParams as any)["$distinct"];
    return `${parsedOperation}(${(distinct && "DISTINCT ") || ""}${escapeId(opField)}) as ${escapeId(fieldId)}`;
  }

  #toParamSqlArray(array: Array<string | number | bigint>) {
    const stringified = array.map((v) => this.#params.add(v)).join(", ");
    return `(${stringified})`;
  }

  #buildColumns() {
    if (!this.#columns || !this.#columns.length) {
      return "*";
    }

    const parsedColumns = this.#columns.map((v: any) =>
      typeof v === "string" ? escapeId(v) : this.#parseColumnObject(v)
    );

    return parsedColumns.join(", ");
  }

  #formatOperator(rawField: string, operator: string, compareValue: any) {
    const field = escapeId(rawField);

    switch (operator) {
      case "$and": {
        const conditions = compareValue.map((condition: any) =>
          this.#parseOperator(condition)
        );
        return `(${conditions.join(" AND ")})`;
      }
      case "$or": {
        const conditions = compareValue.map((condition: any) =>
          this.#parseOperator(condition)
        );
        return `(${conditions.join(" OR ")})`;
      }
      case "$eq":
        return `${field} = ${this.#params.add(compareValue)}`;
      case "$neq":
        return `${field} <> ${this.#params.add(compareValue)}`;
      case "$in":
        return `${field} IN ${this.#toParamSqlArray(compareValue)}`;
      case "$nin":
        return `${field} NOT IN ${this.#toParamSqlArray(compareValue)}`;
      case "$gt":
        return `${field} > $this.#params.add(compareValue)}`;
      case "$gte":
        return `${field} >= ${this.#params.add(compareValue)}`;
      case "$lt":
        return `${field} < ${this.#params.add(compareValue)}`;
      case "$lte":
        return `${field} <= ${this.#params.add(compareValue)}`;
      case "$between":
        return `${field} BETWEEN ${this.#params.add(compareValue.$min)} AND ${this.#params.add(compareValue.$max)}`;
      case "$like":
        return `${field} LIKE ${this.#params.add(compareValue)}`;
      case "$ilike":
        return `${field} ILIKE ${this.#params.add(compareValue)}`;
      case "$contains": {
        if (!compareValue.startsWith("%")) {
          compareValue = "%" + compareValue;
        }

        if (compareValue.slice(-1) !== "%") {
          compareValue += "%";
        }

        return `${field} LIKE ${this.#params.add(compareValue)}`;
      }
      case "$icontains": {
        if (!compareValue.startsWith("%")) {
          compareValue = "%" + compareValue;
        }

        if (compareValue.slice(-1) !== "%") {
          compareValue += "%";
        }

        return `${field} ILIKE ${this.#params.add(compareValue)}`;
      }
      case "$startsWith": {
        if (!compareValue.startsWith("%")) {
          compareValue = "%" + compareValue;
        }

        return `${field} LIKE ${this.#params.add(compareValue)}`;
      }
      case "$istartsWith": {
        if (!compareValue.startsWith("%")) {
          compareValue = "%" + compareValue;
        }

        return `${field} ILIKE ${this.#params.add(compareValue)}`;
      }
      case "$endsWith": {
        if (compareValue.slice(-1) !== "%") {
          compareValue += "%";
        }

        return `${field} LIKE ${this.#params.add(compareValue)}`;
      }
      case "$iendsWith": {
        if (compareValue.slice(-1) !== "%") {
          compareValue += "%";
        }

        return `${field} ILIKE ${this.#params.add(compareValue)}`;
      }
    }
  }

  #parseOperator(condition: {
    [field: string]: string | { [operator: string]: any };
  }): any {
    if (Object.keys(condition).length > 1) {
      return this.#parseOperator({
        $and: Object.entries(condition).map(([key, value]) => ({
          [key]: value,
        })),
      });
    }

    const field = Object.keys(condition)[0];
    const value = condition[field];

    if (!field.startsWith("$")) {
      if (
        ["string", "number", "bigint", "boolean"].includes(typeof value) ||
        value instanceof Date
      ) {
        return this.#formatOperator(field, "$eq", value);
      }

      return this.#formatOperator(
        field,
        Object.keys(value)[0],
        Object.values(value)[0]
      );
    }

    return this.#formatOperator("", field, value);
  }

  #buildWhere() {
    const clauses = [];

    if (!this.#where || !Object.entries(this.#where).length) {
      return "";
    }

    for (const [key, value] of Object.entries(this.#where)) {
      clauses.push(this.#parseOperator({ [key]: value as any }));
    }

    return `WHERE ` + clauses.join(" AND ");
  }

  #buildOrderBy() {
    if (!this.#orderBy || !this.#orderBy.length) {
      return "";
    }

    const orders = this.#orderBy.map(
      ([field, direction]) =>
        `${escapeId(field)} ${direction.toLowerCase() === "asc" ? "ASC" : "DESC"}`
    );

    return `ORDER BY ${orders.join(", ")}`;
  }

  #buildLimit() {
    if (typeof this.#limit !== "number") {
      return "";
    }

    return `LIMIT ${this.#params.add(this.#limit)}`;
  }

  #buildOffset() {
    if (typeof this.#offset !== "number") {
      return "";
    }

    return `OFFSET ${this.#params.add(this.#offset)}`;
  }
}
