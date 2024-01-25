/**
 *
 * Original implementation taken from Radash
 * https://github.com/rayepps/radash/blob/03dd3152f560414e933cedcd3bda3c6db3e8306b/src/async.ts#L265
 * Slightly modified to simplify it for our use case.
 *
 **/

const isFunction = (value: any): value is Function => {
  return !!(value && value.constructor && value.call && value.apply);
};

const isPromise = (value: any): value is Promise<any> => {
  if (!value) return false;
  if (!value.then) return false;
  if (!isFunction(value.then)) return false;
  return true;
};

export const catchError = <Return>(
  func: () => Return
): Return extends Promise<any>
  ? Promise<[undefined, Error] | [Awaited<Return>, undefined]>
  : [undefined, Error] | [Return, undefined] => {
  try {
    const result = func();
    if (isPromise(result)) {
      return result
        .then((value) => [value, undefined])
        .catch((err) => [undefined, err]) as Return extends Promise<any>
        ? Promise<[undefined, Error] | [Awaited<Return>, undefined]>
        : [undefined, Error] | [Return, undefined];
    }
    return [result, undefined] as Return extends Promise<any>
      ? Promise<[undefined, Error] | [Awaited<Return>, undefined]>
      : [undefined, Error] | [Return, undefined];
  } catch (err) {
    return [undefined, err as any] as Return extends Promise<any>
      ? Promise<[undefined, Error] | [Awaited<Return>, undefined]>
      : [undefined, Error] | [Return, undefined];
  }
};
