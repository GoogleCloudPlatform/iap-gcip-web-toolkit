/*!
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Returns a deep copy of an object or array.
 *
 * @param {object|array} value The object or array to deep copy.
 * @return {object|array} A deep copy of the provided object or array.
 */
export function deepCopy<T>(value: T): T {
  return deepExtend(undefined, value);
}

/**
 * Checks for deep equality between the provided parameters.
 * https://stackoverflow.com/questions/25456013/javascript-deepequal-comparison/25456134
 *
 * @param {any} a The first object to be compared for deep equality.
 * @param {any} b The second object to be compared for deep equality.
 * @return {boolean} Whether a deep equals b.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  } else if (typeof a === 'object' &&
             typeof b === 'object' &&
             a !== null &&
             b !== null &&
             Object.keys(a).length === Object.keys(b).length) {
    // Match properties one by one.
    for (const prop in a) {
      if (a.hasOwnProperty(prop)) {
        if (!b.hasOwnProperty(prop) ||
            !deepEqual(a[prop], b[prop])) {
          return false;
        }
      }
    }
    // All sub properties match.
    return true;
  }
  return false;
}


/**
 * Copies properties from source to target (recursively allows extension of objects and arrays).
 * Scalar values in the target are over-written. If target is undefined, an object of the
 * appropriate type will be created (and returned).
 *
 * We recursively copy all child properties of plain objects in the source - so that namespace-like
 * objects are merged.
 *
 * Note that the target can be a function, in which case the properties in the source object are
 * copied onto it as static properties of the function.
 *
 * @param {any} target The value which is being extended.
 * @param {any} source The value whose properties are extending the target.
 * @return {any} The target value.
 */
export function deepExtend(target: any, source: any): any {
  if (!(source instanceof Object)) {
    return source;
  }
  switch (source.constructor) {
    case Date:
      // Treat Dates like scalars; if the target date object had any child
      // properties - they will be lost!
      const dateValue = (source as any) as Date;
      return new Date(dateValue.getTime());

    case Object:
      if (target === undefined) {
        target = {};
      }
      break;

    case Array:
      // Always copy the array source and overwrite the target.
      target = [];
      break;

    default:
      // Not a plain Object - treat it as a scalar.
      return source;
  }

  for (const prop in source) {
    if (!source.hasOwnProperty(prop)) {
      continue;
    }
    target[prop] = deepExtend(target[prop], source[prop]);
  }

  return target;
}
