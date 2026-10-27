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

import * as url from 'url';
// TODO: find cleaner way to have this work client and server side.
const URL: any = url.URL || (window && window.URL);

/** Defines a single validation node needed for validating JSON object. */
interface ValidationNode {
  nodes?: {
    [key: string]: ValidationNode;
  };
  validator?: (value: any, key: string) => void;
}

/** Defines the JSON object validation tree. */
export interface ValidationTree {
  [key: string]: ValidationNode;
}

/** Basic IPv4 address regex matcher. */
const IP_ADDRESS_REGEXP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

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

/**
 * Validates that a string is a valid web URL.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is valid web URL or not.
 */
export function isURL(urlStr: any): boolean {
  if (typeof urlStr !== 'string') {
    return false;
  }
  // Lookup illegal characters.
  const re = /[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i;
  if (re.test(urlStr)) {
    return false;
  }
  try {
    const uri = new URL(urlStr);
    const scheme = uri.protocol;
    const hostname = uri.hostname;
    const pathname = uri.pathname;
    if (scheme !== 'http:' && scheme !== 'https:') {
      return false;
    }
    // Validate hostname: Can contain letters, numbers, underscore and dashes separated by a dot.
    // Each zone must not start with a hyphen or underscore.
    if (!/^[a-zA-Z0-9]+[\w\-]*([\.]?[a-zA-Z0-9]+[\w\-]*)*$/.test(hostname)) {
      return false;
    }
    // Allow for pathnames: (/+chars+)*/*
    // Where chars can be a combination of: a-z A-Z 0-9 - _ . ~ ! $ & ' ( ) * + , ; = : @ %
    const pathnameRe = /^(\/+[\w\-\.\~\!\$\'\(\)\*\+\,\;\=\:\@\%]+)*\/*$/;
    // Validate pathname.
    if (pathname &&
      !/^\/+$/.test(pathname) &&
      !pathnameRe.test(pathname)) {
      return false;
    }
    // Allow any query string and hash as long as no invalid character is used.
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * Validates that a string is a valid HTTPS URL.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is valid HTTPS URL or not.
 */
export function isHttpsURL(urlStr: any): boolean {
  return isURL(urlStr) && new URL(urlStr).protocol === 'https:';
}

/**
 * Validates that a string is localhost or a valid HTTPS URL.
 * This is needed to facilitate testing. As localhost is always served locally, there is no
 * risk of man in the middle attack.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is localhost/valid HTTPS URL or not.
 */
export function isLocalhostOrHttpsURL(urlStr: any): boolean {
  if (isURL(urlStr)) {
    const uri = new URL(urlStr);
    return (uri.protocol === 'http:' && uri.hostname === 'localhost') ||
      uri.protocol === 'https:';
  }
  return false;
}

/**
 * Validates that a string is a valid email.
 *
 * @param email The string to validate.
 * @return Whether the string is valid email or not.
 */
export function isEmail(email: any): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  // There must at least one character before the @ symbol and another after.
  const re = /^[^@]+@[^@]+$/;
  return re.test(email);
}

/**
 * Validates that a string is a valid provider ID.
 *
 * @param providerId The string to validate.
 * @return Whether the string is valid provider ID or not.
 */
export function isProviderId(providerId: any): boolean {
  if (typeof providerId !== 'string') {
    return false;
  }
  // This check is quite lax. It may be tightened in the future.
  const re = /^[a-zA-Z0-9\-\_\.]+$/;
  return isNonEmptyString(providerId) && re.test(providerId);
}

/**
 * Validates that a value is an empty object.
 *
 * @param value The value to validate.
 * @return Whether the value is an empty object.
 */
export function isEmptyObject(value: any): boolean {
  return isNonNullObject(value) && Object.keys(value).length === 0 && value.constructor === Object;
}

/**
 * Validates that the input in a valid color string of format #00ff00.
 *
 * @param value The string to validate.
 * @return Whether the string is a valid color string.
 */
export function isValidColorString(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  // Actually raw strings and rgba(50, 75, 75, 1) formats are allowed but for
  // simplicity limit to this format.
  const re = /^#[0-9a-f]{6}$/i;
  return isNonEmptyString(value) && re.test(value);
}

/**
 * Validates that the input is a safe string. This minimizes the risk of XSS.
 *
 * @param value The string to validate.
 * @return Whether the string is safe or not.
 */
export function isSafeString(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  // This check only allows limited set of characters and spaces.
  const re = /^[a-zA-Z0-9\-\_\.\s\,\+\?\!\&\;]+$/;
  return isNonEmptyString(value) && re.test(value);
}

/**
 * Validates that the input is a safe string including Japanese characters. This minimizes the risk of XSS.
 *
 * @param value The string to validate.
 * @return Whether the string is safe or not.
 */
export function isSafeWideString(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  // This check allows alphanumeric characters, spaces, basic punctuation, and Japanese characters (hiragana, katakana, kanji, punctuation).
  const re = /^[a-zA-Z0-9\-\_\.\s\,\+\?\!\&\;\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]+$/;
  return isNonEmptyString(value) && re.test(value);
}

/**
 * Utility used to validate a JSON object with nested content using a provided validation tree structure.
 * For the following interface:
 * interface MyStructure {
 *   [key: string]: {
 *     key1: string;
 *     key2: string[];
 *     key3: {
 *       key4: (boolean | {key5: number});
 *     };
 *   };
 * }
 *
 * The following ValidationTree is provided:
 * const VALIDATION_TREE = {
 *   '*': {
 *     nodes: {
 *       key1: {
 *         validator: (input: any) => { // if input not string, throw },
 *       },
 *       key2[]: {
 *         validator: (input: any) => { // if input not string, throw },
 *       },
 *       key3: {
 *         nodes: {
 *           key4: {
 *             validator: (input: any) => { // if input not boolean, throw },
 *             nodes: {
 *               key5: {
 *                 validator: (input: any) => { // if input not number, throw },
 *               },
 *             },
 *           },
 *         },
 *       },
 *     },
 *   },
 * };
 * Required fields can also be enforced:
 * const requiredFields = ['*.key1', '*.key2[]', '*.key3.key4.key5'];
 */
export class JsonObjectValidator {
  /**
   * Instantiates a JSON object validator using the provided validation tree.
   * @param validationTree The validation tree to use.
   * @param requiredFields list of required field paths.
   */
  constructor(
    private readonly validationTree: ValidationTree,
    private readonly requiredFields: string[] = []) {}

  /**
   * Validates the provided object.
   * @param obj The object to validate.
   */
  validate(obj: any) {
    this.validateJson(obj, []);
    this.checkRequiredFields(obj);
  }

  /**
   * Validates that all required fields are provided.
   * @param obj The object to validate.
   */
  private checkRequiredFields(obj: any) {
    for (const requiredField of this.requiredFields) {
      this.validateRequired(obj, requiredField.split('.'), requiredField);
    }
  }

  /**
   * Validates that the list of component keys are available in the provided object.
   * @param obj The object to validate.
   * @param components The array of keys to continue traversing to ensure availability.
   * @param path The full path, useful for providing details in the error message.
   */
  private validateRequired(obj: any, components: string[], path: string) {
    if (!components.length) {
      return;
    }
    const component = components[0];
    if (component === '*') {
      const allKeys = Object.keys(obj);
      if (!allKeys.length) {
        throw new Error(`Missing required field "${path}"`);
      }
      for (const key of allKeys) {
        this.validateRequired(obj[key], components.slice(1), path);
      }
    } else if (component.substring(component.length - 2) === '[]') {
      const prefixKey = component.substring(0, component.length - 2);
      if (!isArray(obj[prefixKey])) {
        throw new Error(`Missing required field "${path}"`);
      }
      for (const entry of obj[prefixKey]) {
        this.validateRequired(entry, components.slice(1), path);
      }
    } else if (obj.hasOwnProperty(component)) {
      this.validateRequired(obj[component], components.slice(1), path);
    } else {
      throw new Error(`Missing required field "${path}"`);
    }
  }

  /**
   * Returns the validator function for the provided path. If not found, null is returned.
   * @param pathSoFar The path so far in the nested JSON object.
   * @return The validation function for the specified path, null if not found.
   */
  private getValidator(pathSoFar: string[]): ((value: any, key: string) => void) | null {
    let currentNode: any = this.validationTree;
    let currentValidator: any = null;
    for (const currentKey of pathSoFar) {
      // For variable object keys, * is used in the validation tree.
      if (currentNode.hasOwnProperty('*')) {
        currentValidator = currentNode['*'].validator || ((value: any, key: string) => {
          if (!isEmptyObject(value)) {
            throw new Error(`Invalid value for "${key}"`);
          }
        });
        currentNode = currentNode['*'].nodes || {};
      } else if (currentNode.hasOwnProperty(currentKey)) {
        currentValidator = currentNode[currentKey].validator || ((value: any, key: string) => {
          if (!isEmptyObject(value)) {
            throw new Error(`Invalid value for "${key}"`);
          }
        });
        currentNode = currentNode[currentKey].nodes || {};
      } else {
        // Not found.
        return null;
      }
    }
    return currentValidator || null;
  }

  /**
   * Recursive internal validator.
   * @param obj The object to validate.
   * @param pathSoFar The path so far in the object.
   */
  private validateJson(obj: any, pathSoFar: string[] = []) {
    if (isNonEmptyArray(obj)) {
      const key = pathSoFar.pop() || '';
      pathSoFar.push(`${key}[]`);
      obj.forEach((item: any) => {
        this.validateJson(item, pathSoFar);
      });
      pathSoFar.pop();
      if (key) {
        pathSoFar.push(key);
      }
    } else if (isNonNullObject(obj) && !isEmptyObject(obj)) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          pathSoFar.push(key);
          this.validateJson(obj[key], pathSoFar);
          pathSoFar.pop();
        }
      }
    } else if (isEmptyObject(obj)) {
      const validator = this.getValidator(pathSoFar);
      if (!validator) {
        throw new Error(`Invalid key or type "${pathSoFar.join('.')}"`);
      }
    } else if (isArray(obj) && obj.length === 0) {
      const key = pathSoFar.pop() || '';
      pathSoFar.push(`${key}[]`);
      const validator = this.getValidator(pathSoFar);
      if (!validator) {
        throw new Error(`Invalid key or type "${pathSoFar.join('.')}"`);
      }
    } else {
      const validator = this.getValidator(pathSoFar);
      if (!validator) {
        throw new Error(`Invalid key or type "${pathSoFar.join('.')}"`);
      }
      validator(obj, pathSoFar.join('.'));
    }
  }
}
