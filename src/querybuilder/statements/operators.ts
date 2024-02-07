/**
 *
 * AGGREGATE OPERATORS
 *
 */

// SUM(DISTINCT? field) AS alias|field
// .select($sum(field, alias, distinct)
const $sum = (field: string, alias?: string, distinct?: boolean) => ({
  [alias ?? field]: { $sum: { $expr: field, $distinct: distinct } },
});

// COUNT(DISTINCT? field) AS alias|field
// .select($count(field, alias, distinct)
const $count = (field: string, alias?: string, distinct?: boolean) => ({
  [alias ?? field]: { $count: { $expr: field, $distinct: distinct } },
});

/**
 *
 * LOGICAL OPERATORS
 *
 */

// condition AND condition AND ...
// .where(
//    $and({ field: value }, { field: value })
//  )
const $and = (...conditions: any) => ({
  $and: conditions,
});

// condition OR condition OR ..
// .where(
//    $or({ field: value }, { field: value })
//  )
const $or = (...conditions: any) => ({
  $or: conditions,
});

/**
 *
 * COMPARISON OPERATORS
 *
 */

// field BETWEEN rangeStart and rangeEnd
const $between = (rangeStart: number, rangeEnd: number) => ({
  $between: { $min: rangeStart, $max: rangeEnd },
});

// field IN (...conditionParams)
const inOperator = (...conditionParams: Array<string | number | boolean>) => ({
  $in: conditionParams,
});

// field NOT IN (...conditionParams)
const $notIn = (...conditionParams: Array<string | number | boolean>) => ({
  $nin: conditionParams,
});

// field = compareValue
const $eq = (compareValue: string | number) => ({ $eq: compareValue });

// field <> compareValue
const $neq = (compareValue: string | number) => ({ $neq: compareValue });

// field > compareValue
const $gt = (compareValue: number) => ({ $gt: compareValue });

// field >= compareValue
const $gte = (compareValue: number) => ({ $gte: compareValue });

// field < compareValue
const $lt = (compareValue: number) => ({ $lt: compareValue });

// field <= compareValue
const $lte = (compareValue: number) => ({ $lte: compareValue });

// field LIKE "%compareValue%"
const $contains = (compareValue: string) => ({ $contains: compareValue });

// field ILIKE "%compareValue%"
const $icontains = (compareValue: string) => ({ $icontains: compareValue });

// field LIKE "%compareValue"
const $startsWith = (compareValue: string) => ({ $startsWith: compareValue });

// field ILIKE "%compareValue"
const $istartsWith = (compareValue: string) => ({ $istartsWith: compareValue });

// field LIKE "compareValue%"
const $endsWith = (compareValue: string) => ({ $endsWith: compareValue });

// field ILIKE "compareValue%"
const $iendsWith = (compareValue: string) => ({ $iendsWith: compareValue });

// field LIKE "compareValue"
const $like = (compareValue: string) => ({ $like: compareValue });

// field ILIKE "compareValue"
const $ilike = (compareValue: string) => ({ $ilike: compareValue });

export {
  $and,
  $or,
  inOperator as $in,
  $notIn,
  $between,
  $sum,
  $count,
  $eq,
  $neq,
  $gt,
  $gte,
  $lt,
  $lte,
  $contains,
  $startsWith,
  $endsWith,
  $icontains,
  $istartsWith,
  $iendsWith,
  $like,
  $ilike,

  // Export non prefixed version for environments
  // with $ as a reserverd keyword (Svelte, SvelteKit)
  $and as and,
  $or as or,
  inOperator as inOp,
  $notIn as notIn,
  $between as between,
  $sum as sum,
  $count as count,
  $eq as eq,
  $neq as neq,
  $gt as gt,
  $gte as gte,
  $lt as lt,
  $lte as lte,
  $contains as contains,
  $startsWith as startsWith,
  $endsWith as endsWith,
  $icontains as icontains,
  $istartsWith as istartsWith,
  $iendsWith as iendsWith,
  $like as like,
  $ilike as ilike,
};
