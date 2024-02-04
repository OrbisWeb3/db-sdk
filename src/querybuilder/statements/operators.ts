const $between = (rangeStart: number, rangeEnd: number) => ({
  $between: { $min: rangeStart, $max: rangeEnd },
});

const inOperator = (...conditionParams: Array<string | number | boolean>) => ({
  $in: conditionParams,
});

const $notIn = (...conditionParams: Array<string | number | boolean>) => ({
  $nin: conditionParams,
});

const $sum = (field: string, alias?: string, distinct?: boolean) => ({
  [alias ?? field]: { $sum: { $expr: field, $distinct: distinct } },
});

const $count = (field: string, alias?: string, distinct?: boolean) => ({
  [alias ?? field]: { $count: { $expr: field, $distinct: distinct } },
});

const $and = (...conditions: any) => ({
  $and: conditions,
});

const $or = (...conditions: any) => ({
  $or: conditions,
});

const $eq = (compareValue: string | number) => ({ $eq: compareValue });

const $neq = (compareValue: string | number) => ({ $neq: compareValue });

const $gt = (compareValue: number) => ({ $gt: compareValue });

const $gte = (compareValue: number) => ({ $gte: compareValue });

const $lt = (compareValue: number) => ({ $lt: compareValue });

const $lte = (compareValue: number) => ({ $lte: compareValue });

const $contains = (compareValue: string) => ({ $contains: compareValue });

const $icontains = (compareValue: string) => ({ $icontains: compareValue });

const $startsWith = (compareValue: string) => ({ $startsWith: compareValue });

const $istartsWith = (compareValue: string) => ({ $istartsWith: compareValue });

const $endsWith = (compareValue: string) => ({ $endsWith: compareValue });

const $iendsWith = (compareValue: string) => ({ $iendsWith: compareValue });

const $like = (compareValue: string) => ({ $like: compareValue });

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
};
