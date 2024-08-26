import { OrbisDB } from "../index.js";
import { SelectStatement } from "./statements/select.js";
import { BulkInsertStatement, InsertStatement } from "./statements/insert.js";
import * as Operators from "./statements/operators.js";
import { UpdateByIdStatement } from "./statements/update.js";
import * as Ajv from "ajv/dist/2020.js";
import addAjvFormats from "ajv-formats";

const ajv = new Ajv.Ajv2020({
  strict: true,
  allErrors: true,
  allowMatchingProperties: false,
  ownProperties: false,
  unevaluated: false,
});

addAjvFormats.default(ajv);

export {
  SelectStatement,
  InsertStatement,
  BulkInsertStatement,
  UpdateByIdStatement,
  Operators,
};

export class QueryBuilder {
  #orbis: OrbisDB;
  #models: Record<
    string,
    { model: Record<string, any>; validate: Ajv.ValidateFunction }
  >;

  select: (...columns: Array<string | any>) => SelectStatement;
  insert: (model: string) => InsertStatement;
  insertBulk: (model: string) => BulkInsertStatement;
  update: (documentId: string) => UpdateByIdStatement;

  constructor(orbis: OrbisDB) {
    this.#orbis = orbis;
    this.#models = {};

    this.select = (...columns: Array<string | any>) => {
      const statement = new SelectStatement(this.#orbis);
      if (columns) statement.columns(...columns);
      return statement;
    };

    this.insert = (model: string) => new InsertStatement(this.#orbis, model);

    this.insertBulk = (model: string) =>
      new BulkInsertStatement(this.#orbis, model);

    this.update = (documentId: string) =>
      new UpdateByIdStatement(this.#orbis, documentId);
  }

  async fetchModel(model: string) {
    if (this.#models[model]) {
      return this.#models[model];
    }

    const { content } = await this.#orbis.ceramic.client.loadStream(model);
    this.#models[model] = {
      model: content,
      validate: ajv.compile(content.schema),
    };

    return this.#models[model];
  }
}

