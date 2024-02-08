/**
 *
 * AGGREGATE OPERATORS
 *
 */

// SUM(DISTINCT? column) AS alias|column
// .select($sum(column, alias, distinct)
const $sum = (column: string, alias?: string, distinct?: boolean) => ({
  [alias ?? column]: { $sum: { $expr: column, $distinct: distinct } },
});

// COUNT(DISTINCT? column) AS alias|column
// .select($count(column, alias, distinct)
const $count = (column: string, alias?: string, distinct?: boolean) => ({
  [alias ?? column]: { $count: { $expr: column, $distinct: distinct } },
});

/**
 *
 * COLUMN OPERATORS
 *
 */

// column AS alias
const $as = (column: string, alias: string) => ({
  [column]: { $as: alias },
});

/**
 *
 * LOGICAL OPERATORS
 *
 */

// condition AND condition AND ...
// .where(
//    $and({ column: value }, { column: value })
//  )
const $and = (...conditions: any) => ({
  $and: conditions,
});

// condition OR condition OR ..
// .where(
//    $or({ column: value }, { column: value })
//  )
const $or = (...conditions: any) => ({
  $or: conditions,
});

/**
 *
 * COMPARISON OPERATORS
 *
 */

// column BETWEEN rangeStart and rangeEnd
const $between = (rangeStart: number, rangeEnd: number) => ({
  $between: { $min: rangeStart, $max: rangeEnd },
});

// column IN (...conditionParams)
const inOperator = (...conditionParams: Array<string | number | boolean>) => ({
  $in: conditionParams,
});

// column NOT IN (...conditionParams)
const $notIn = (...conditionParams: Array<string | number | boolean>) => ({
  $nin: conditionParams,
});

// column = compareValue
const $eq = (compareValue: string | number) => ({ $eq: compareValue });

// column <> compareValue
const $neq = (compareValue: string | number) => ({ $neq: compareValue });

// column > compareValue
const $gt = (compareValue: number) => ({ $gt: compareValue });

// column >= compareValue
const $gte = (compareValue: number) => ({ $gte: compareValue });

// column < compareValue
const $lt = (compareValue: number) => ({ $lt: compareValue });

// column <= compareValue
const $lte = (compareValue: number) => ({ $lte: compareValue });

// column LIKE "%compareValue%"
const $contains = (compareValue: string) => ({ $contains: compareValue });

// column ILIKE "%compareValue%"
const $icontains = (compareValue: string) => ({ $icontains: compareValue });

// column LIKE "%compareValue"
const $startsWith = (compareValue: string) => ({ $startsWith: compareValue });

// column ILIKE "%compareValue"
const $istartsWith = (compareValue: string) => ({ $istartsWith: compareValue });

// column LIKE "compareValue%"
const $endsWith = (compareValue: string) => ({ $endsWith: compareValue });

// column ILIKE "compareValue%"
const $iendsWith = (compareValue: string) => ({ $iendsWith: compareValue });

// column LIKE "compareValue"
const $like = (compareValue: string) => ({ $like: compareValue });

// column ILIKE "compareValue"
const $ilike = (compareValue: string) => ({ $ilike: compareValue });

export {
  $sum,
  $sum as sum,
  $count,
  $count as count,
  $as,
  $as as as,
  $and,
  $and as and,
  $or,
  $or as or,
  inOperator as $in,
  inOperator as inOp,
  $notIn,
  $notIn as notIn,
  $between,
  $between as between,
  $eq,
  $eq as eq,
  $neq,
  $neq as neq,
  $gt,
  $gt as gt,
  $gte,
  $gte as gte,
  $lt,
  $lt as lt,
  $lte,
  $lte as lte,
  $contains,
  $contains as contains,
  $icontains,
  $icontains as icontains,
  $startsWith,
  $startsWith as startsWith,
  $istartsWith,
  $istartsWith as istartsWith,
  $endsWith,
  $endsWith as endsWith,
  $iendsWith,
  $iendsWith as iendsWith,
  $like,
  $like as like,
  $ilike,
  $ilike as ilike,
};
