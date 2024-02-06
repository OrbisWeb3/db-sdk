import { StreamID } from "@ceramicnetwork/streamid";
import { OrbisDB } from "../../index.js";
import { StatementHistory } from "./historyProvider.js";

export class UpdateByIdStatement<
  T = Record<string, any>,
> extends StatementHistory {
  #orbis: OrbisDB;
  #id: string;
  #newContent?: T;

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

  replace(newContent: T) {
    this.#newContent = newContent;
    return this;
  }

  // TODO: Implement validation
  // async validate(){

  // }

  async run() {
    if (!this.#newContent) {
      throw "[QueryBuilder:update] Cannot update a document with no content.";
    }

    const timestamp = Date.now();

    const query = {
      id: this.#id,
      newContent: this.#newContent,
    };

    try {
      const document = await this.#orbis.ceramic.updateDocument(
        this.#id,
        this.#newContent as Record<string, any>
      );

      super.storeResult({
        timestamp,
        success: true,
        result: document,
        query,
      });

      return document;
    } catch (error) {
      super.storeResult({
        timestamp,
        success: false,
        error,
        query,
      });

      return {
        query,
        error,
      };
    }
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
