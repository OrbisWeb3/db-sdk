import { QueryBuilder } from "knex";
import { validate as validateJsonSchema } from "jsonschema";

export class BulkInsertStatement<T = Record<string, any>> {
  statementType = "CERAMIC_BULK_INSERT";

  #parent: QueryBuilder;
  #model: string;
  #values: Array<T>;
  #fetchModelSchema: (model: string) => Promise<Record<string, any>>;

  constructor(
    parent: QueryBuilder,
    fetchModelSchema: (model: string) => Promise<Record<string, any>>,
    model: string
  ) {
    this.#values = [];

    this.#model = model;
    this.#parent = parent;
    this.#fetchModelSchema = fetchModelSchema;
  }

  async documents(): Promise<Array<T>> {
    return this.#values;
  }

  get model(): string {
    return this.#model;
  }

  async validate(): Promise<
    | { valid: true }
    | {
        valid: false;
        errors: Array<{ document: T; error: string }>;
      }
  > {
    const schema = await this.#fetchModelSchema(this.model);
    const results = this.#values.map((value) =>
      validateJsonSchema(value, schema)
    );

    if (results.some((v) => !v.valid)) {
      return {
        valid: false,
        errors: results
          .filter((v) => !v.valid)
          .map((v) => ({ document: v.instance, error: v.errors.join(", ") })),
      };
    }

    return { valid: true };
  }

  value(v: T): BulkInsertStatement<T> {
    this.#values = [...this.#values, v];
    return this;
  }

  values(v: T | Array<T>): BulkInsertStatement<T> {
    this.#values = [...this.#values, ...(Array.isArray(v) ? v : [v])];
    return this;
  }
}

export class InsertStatement<T = Record<string, any>> {
  statementType = "CERAMIC_INSERT";

  #parent: QueryBuilder;
  #model: string;
  #value?: T;
  #fetchModelSchema: (model: string) => Promise<Record<string, any>>;

  constructor(
    parent: QueryBuilder,
    fetchModelSchema: (model: string) => Promise<Record<string, any>>,
    model: string
  ) {
    this.#model = model;
    this.#parent = parent;
    this.#fetchModelSchema = fetchModelSchema;
  }

  async document(): Promise<T | undefined> {
    return this.#value;
  }

  get model(): string {
    return this.#model;
  }

  async validate(): Promise<
    | { valid: true }
    | {
        valid: false;
        error: string;
      }
  > {
    const schema = await this.#fetchModelSchema(this.model);
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
}
