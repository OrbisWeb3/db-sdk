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
