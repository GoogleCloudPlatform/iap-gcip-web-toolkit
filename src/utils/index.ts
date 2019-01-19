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

import {isNonNullObject} from './validator';

/**
 * Defines a new read-only property directly on an object and returns the object.
 *
 * @param {object} obj The object on which to define the property.
 * @param {string} prop The name of the property to be defined or modified.
 * @param {any} value The value associated with the property.
 */
export function addReadonlyGetter(obj: object, prop: string, value: any): void {
  Object.defineProperty(obj, prop, {
    value,
    // Make this property read-only.
    writable: false,
    // Include this property during enumeration of obj's properties.
    enumerable: true,
  });
}

/**
 * Removes entries in an object whose values are undefined and returns the same
 * object. This only removes the top-level undefined fields.
 *
 * @param {T} obj The object whose undefined fields are to be removed.
 * @return {T} The same object with undefined fields removed.
 */
export function removeUndefinedFields<T>(obj: T): T {
  // If obj is not a non-null object, return it back.
  if (!isNonNullObject(obj)) {
    return obj;
  }
  for (const key in obj) {
    if (typeof obj[key] === 'undefined') {
      delete obj[key];
    }
  }
  return obj;
}
