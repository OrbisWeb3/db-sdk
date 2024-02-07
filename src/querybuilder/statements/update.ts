import { StreamID } from "@ceramicnetwork/streamid";
import { OrbisDB } from "../../index.js";
import { StatementHistory } from "./historyProvider.js";
import { catchError } from "../../util/tryit.js";
import { OrbisError } from "../../util/results.js";

export class UpdateByIdStatement<
  T = Record<string, any>,
> extends StatementHistory {
  #orbis: OrbisDB;
  #id: string;
  #newValue?: T;
  #replaceValues?: Partial<T>;

  constructor(orbis: OrbisDB, documentId: string | StreamID) {
    super();

    this.#orbis = orbis;
    this.#id =
      typeof documentId === "string" ? documentId : documentId.toString();
  }

  id(documentId: string | StreamID) {
    const id =
      typeof documentId === "string" ? documentId : documentId.toString();

    if (this.#id) {
      console.warn("[QueryBuilder:update] Modfying documentId to update.", {
        old: this.#id,
        new: id,
      });
    }

    this.#id = id;
    return this;
  }

  replace(newValue: T) {
    if (this.#replaceValues) {
      console.warn(
        "[QueryBuilder:update] Replacing existing value settings set by .set()."
      );
      this.#replaceValues = undefined;
    }

    this.#newValue = newValue;
    return this;
  }

  set(partialValues: Partial<T>) {
    if (this.#newValue) {
      console.warn(
        "[QueryBuilder:update] Replacing existing value settings set by .replace()."
      );
      this.#newValue = undefined;
    }

    this.#replaceValues = partialValues;
    return this;
  }

  // TODO: Implement validation
  // async validate(){

  // }

  async run() {
    if (!this.#newValue && !this.#replaceValues) {
      throw "[QueryBuilder:update] Cannot update a document with no updated or replaced values.";
    }

    const timestamp = Date.now();

    const query = {
      id: this.#id,
      ...((this.#newValue && { newValue: this.#newValue }) || {
        replaceValues: this.#replaceValues,
      }),
    };

    let document, error;
    if (this.#newValue) {
      [document, error] = await catchError(() =>
        this.#orbis.ceramic.updateDocument(
          this.#id,
          this.#newValue as Record<string, any>
        )
      );
    } else {
      [document, error] = await catchError(() =>
        this.#orbis.ceramic.updateDocumentBySetter(
          this.#id,
          async (document) => {
            return {
              ...document.content,
              ...this.#replaceValues,
            };
          }
        )
      );
    }

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

// class UpdateByModelStatement<T = Record<string, any>> {
//   statementType = "CERAMIC_UPDATE";

//   #parent: QueryBuilder;
//   #fetchModelSchema: (model: string) => Promise<Record<string, any>>;

//   #query: knex.Knex.QueryBuilder;

//   #model: string;
//   #controller: DIDAny;

//   // @ts-ignore
//   #type: "replace" | "update";
//   // @ts-ignore
//   #value: Partial<T>;

//   constructor(
//     parent: QueryBuilder,
//     orbis: OrbisDB,
//     fetchModelSchema: (model: string) => Promise<Record<string, any>>,
//     model: string,
//     controller?: DIDAny
//   ) {
//     if (!controller && !orbis.user) {
//       throw "Cannot use updateByQuery without a user session or a controller.";
//     }

//     this.#parent = parent;
//     this.#model = model;
//     this.#fetchModelSchema = fetchModelSchema;
//     this.#controller = (controller || orbis.user?.did) as DIDAny;

//     this.#query = knexQueryBuilder.select("stream_id").from(this.#model);
//   }

//   get model() {
//     return this.#model;
//   }

//   replace(content: T) {
//     this.#type = "replace";
//     this.#value = content;

//     return this;
//   }

//   set(content: Partial<T>) {
//     this.#type = "update";
//     this.#value = content;

//     return this;
//   }

//   query(callback: (select: knex.Knex.QueryBuilder) => knex.Knex.QueryBuilder) {
//     this.#query = callback(this.#query);
//     return this;
//   }

//   async documents() {
//     const query = this.#query.where({ controller: this.#controller });
//     const result: any = await this.#parent.run(query);

//     return result.rows.map((v: any) => v.stream_id);
//   }
// }
