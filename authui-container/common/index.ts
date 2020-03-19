/*!
 * Copyright 2020 Google Inc.
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

// REGEX pattern for safe URL.
const SAFE_URL_PATTERN = /^(?:(?:https?|mailto|ftp):|[^:/?#]*(?:[/?#]|$))/i;

/**
 * The innocuous string returned when an unsafe URL is to be sanitized.
 * about:invalid is registered in
 * http://www.w3.org/TR/css3-values/#about-invalid.
 */
const INNOCUOUS_STRING = 'about:invalid';

/**
 * Defines a new read-only property directly on an object and returns the object.
 *
 * @param obj The object on which to define the property.
 * @param prop The name of the property to be defined or modified.
 * @param value The value associated with the property.
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
 * @param obj The object whose undefined fields are to be removed.
 * @return The same object with undefined fields removed.
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

/**
 * Formats a string of form 'project/{projectId}/{api}' and replaces
 * with corresponding arguments {projectId: '1234', api: 'resource'}
 * and returns output: 'project/1234/resource'.
 *
 * @param str The original string where the param need to be
 *     replaced.
 * @param params The optional parameters to replace in the
 *     string.
 * @return The resulting formatted string.
 */
export function formatString(str: string, params?:  {[key: string]: string}): string {
  let formatted = str;
  Object.keys(params || {}).forEach((key) => {
    formatted = formatted.replace(
        new RegExp('{' + key + '}', 'g'),
        (params as {[key: string]: string})[key]);
  });
  return formatted;
}

/**
 * Maps an object's value based on the provided callback function.
 *
 * @param obj The object to map.
 * @param cb The callback function used to compute the new mapped value.
 * @return The mapped new object.
 */
export function mapObject<T, V>(
    obj: {[key: string]: T},
    cb: (key: string, value: T) => V): {[key: string]: V} {
  const mappedObject: {[key: string]: V} = {};
  Object.keys(obj).forEach((key: string) => {
    mappedObject[key] = cb(key, obj[key]);
  });
  return mappedObject;
}

/**
 * Sanitizes the URL provided.
 *
 * @param url The unsanitized URL.
 * @return The sanitized URL.
 */
export function sanitizeUrl(url: string): string {
  if (!isSafeUrl(url)) {
    return INNOCUOUS_STRING;
  }
  return url;
}

/**
 * @param url The URL to validate for safety.
 * @return Whether the URL is safe to use.
 */
export function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url);
}
