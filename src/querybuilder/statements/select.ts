import knex from "knex";

const knexQueryBuilder = knex({ client: "pg" });

export const selectQueryBuilder = knexQueryBuilder;

export type SelectQueryBuilder = knex.Knex.Select;
export type SelectStatement = knex.Knex.QueryBuilder;
