import { validate as validateJsonSchema } from "jsonschema";
import { StatementHistory } from "./historyProvider.js";
import { OrbisDB, OrbisDocument } from "../../index.js";
import { catchError } from "../../util/tryit.js";
import { OrbisError } from "../../util/results.js";

export class BulkInsertStatement<
  T = Record<string, any>,
> extends StatementHistory {
  #orbis: OrbisDB;
  #tableName?: string;
  #model?: string;
  #context?: string;
  #values: Array<T> = [];

  constructor(orbis: OrbisDB, tableOrModelId: string) {
    super();

    this.#orbis = orbis;

    if (this.#orbis.ceramic.isStreamIdString(tableOrModelId)) {
      this.#model = tableOrModelId;
    } else {
      this.#tableName = tableOrModelId;
    }
  }

  get documents(): Array<T> {
    return this.#values;
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
    | {
        valid: true;
      }
    | {
        valid: false;
        errors: Array<{
          document: T;
          error: string;
        }>;
      }
  > {
    const model = await this.getModelId();
    const { schema } = await this.#orbis.query.fetchModel(model);

    const results = this.documents.map((document: T) => {
      const result = validateJsonSchema(document, schema);
      if (!result.valid) {
        return {
          valid: false as const,
          error: result.errors.join(", "),
          document,
        };
      }

      return {
        valid: true as const,
        document,
      };
    });

    if (results.some((result) => !result.valid)) {
      return {
        valid: false,
        errors: results.filter((result) => !result.valid) as Array<{
          document: T;
          error: string;
        }>,
      };
    }

    return {
      valid: true,
    };
  }

  value(v: T) {
    this.#values.push(v);
    return this;
  }

  values(values: Array<T>) {
    this.#values = [...this.#values, ...values];
    return this;
  }

  context(context: string) {
    this.#context = context;
    return this;
  }

  async run() {
    if (!this.documents.length) {
      throw "[QueryBuilder:insert] Cannot create empty document, missing .value() or .values()";
    }

    const timestamp = Date.now();
    const model = await this.getModelId();
    const modelContent = await this.#orbis.query.fetchModel(model);
    const accountRelation = (
      modelContent.accountRelation?.type || "list"
    ).toLowerCase();

    const query = {
      documents: this.documents,
      context: this.#context,
      model,
      accountRelation: modelContent.accountRelation,
    };

    const results = (
      await Promise.allSettled(
        this.documents.map(async (document) => {
          const [orbisDocument, error] = await catchError(() => {
            if (accountRelation === "single") {
              return this.#orbis.ceramic.createDocumentSingle({
                content: document as Record<string, any>,
                context: this.#context,
                model,
              });
            }

            // TODO: implementation, this is unverified
            if (accountRelation === "set") {
              const unique = modelContent.fields;
              return this.#orbis.ceramic.createDocumentSet(
                {
                  content: document as Record<string, any>,
                  context: this.#context,
                  model,
                },
                unique.map(
                  (key: string) => (document as Record<string, any>)[key]
                )
              );
            }

            return this.#orbis.ceramic.createDocument({
              content: document as Record<string, any>,
              context: this.#context,
              model,
            });
          });

          if (error) {
            return {
              error,
              document,
            };
          }

          return orbisDocument;
        })
      )
    ).map((result) => (result as PromiseFulfilledResult<any>).value);

    const success: Array<OrbisDocument> = results.filter(
      (result) => typeof result.error === "undefined"
    );

    const errors: Array<{ document: T; error: any }> = results.filter(
      (result) => typeof result.error !== "undefined"
    );

    if (!errors.length) {
      super.storeResult({
        timestamp,
        success: true,
        result: "All documents created successfully. Check .details for more.",
        query,
        details: {
          success,
          errors,
        },
      });
    } else {
      super.storeResult({
        timestamp,
        success: false,
        error:
          "One or more documents failed to be created. Check .details for more.",
        query,
        details: {
          success,
          errors,
        },
      });
    }

    return {
      success,
      errors,
    };
  }
}

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

  get document(): T | undefined {
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
    const { schema } = await this.#orbis.query.fetchModel(model);
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
    const modelContent = await this.#orbis.query.fetchModel(model);
    const accountRelation = (
      modelContent.accountRelation?.type || "list"
    ).toLowerCase();

    const query = {
      content: this.#value,
      context: this.#context,
      model,
      // pass additional info, such as fields ("set")
      accountRelation: modelContent.accountRelation,
    };

    const [document, error] = await catchError(() => {
      if (accountRelation === "single") {
        return this.#orbis.ceramic.createDocumentSingle(query);
      }

      // TODO: implementation, this is unverified
      if (accountRelation === "set") {
        const unique = modelContent.fields;
        return this.#orbis.ceramic.createDocumentSet(
          query,
          unique.map(
            (key: string) => (query.content as Record<string, any>)[key]
          )
        );
      }

      return this.#orbis.ceramic.createDocument(query);
    });

    if (error) {
      super.storeResult({
        timestamp,
        success: false,
        error,
        query,
      });

      throw new OrbisError(error.message, { error, query });
    }

    super.storeResult({
      timestamp,
      success: true,
      result: document,
      query,
    });

    return document;
  }
}
