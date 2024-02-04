/**
 * Taken from https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/utils.js
 */

export const escapeId = (value: string) => {
  return '"' + value.replace(/"/g, '""') + '"';
};

export const escape = function (value: string | number | boolean | bigint) {
  if (["number", "boolean", "bigint"].includes(typeof value)) {
    return value;
  }

  let hasBackslash = false;
  let escaped = "'";

  for (let i = 0; i < (value as string).length; i++) {
    let c = (value as string)[i];
    if (c === "'") {
      escaped += c + c;
    } else if (c === "\\") {
      escaped += c + c;
      hasBackslash = true;
    } else {
      escaped += c;
    }
  }

  escaped += "'";

  if (hasBackslash === true) {
    escaped = " E" + escaped;
  }

  return escaped;
};
