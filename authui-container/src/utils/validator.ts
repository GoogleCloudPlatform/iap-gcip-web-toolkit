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

/**
 * Validates that a value is an array.
 *
 * @param value The value to validate.
 * @return Whether the value is an array or not.
 */
export function isArray(value: any): boolean {
  return Array.isArray(value);
}

/**
 * Validates that a value is a non-empty array.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-empty array or not.
 */
export function isNonEmptyArray(value: any): boolean {
  return isArray(value) && value.length !== 0;
}

/**
 * Validates that a value is a boolean.
 *
 * @param value The value to validate.
 * @return Whether the value is a boolean or not.
 */
export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

/**
 * Validates that a value is a number.
 *
 * @param value The value to validate.
 * @return Whether the value is a number or not.
 */
export function isNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Validates that a value is a string.
 *
 * @param value The value to validate.
 * @return Whether the value is a string or not.
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * Validates that a value is a non-empty string.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-empty string or not.
 */
export function isNonEmptyString(value: any): value is string {
  return isString(value) && value !== '';
}

/**
 * Validates that a value is a nullable object.
 *
 * @param value The value to validate.
 * @return Whether the value is an object or not.
 */
export function isObject(value: any): boolean {
  return typeof value === 'object' && !isArray(value);
}

/**
 * Validates that a value is a non-null object.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-null object or not.
 */
export function isNonNullObject(value: any): boolean {
  return isObject(value) && value !== null;
}
