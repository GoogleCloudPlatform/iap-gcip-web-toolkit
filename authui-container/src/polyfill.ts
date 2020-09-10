/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Polyfills for IE 11.
// tslint:disable-next-line:no-var-requires
require('@babel/polyfill');
// tslint:disable-next-line:no-var-requires
const entries = require('object.entries');
// tslint:disable-next-line:no-var-requires
const values = require('object.values');

// from:https://github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
((arr) => {
  arr.forEach((item) => {
    if (item.hasOwnProperty('remove')) {
      return;
    }
    Object.defineProperty(item, 'remove', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: function remove() {
        this.parentNode.removeChild(this);
      }
    });
  });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
if (!String.prototype.includes) {
  String.prototype.includes = function(search: any, start = 0) {
    'use strict';

    if (search instanceof RegExp) {
      throw TypeError('first argument must not be a RegExp');
    }
    return this.indexOf(search, start) !== -1;
  };
}

(() => {
  // https://stackoverflow.com/questions/19345392/why-arent-my-parameters-getting-passed-through-to-a-dispatched-event/
  if ((window.document as any).documentMode) {
    function CustomEvent(event: any, params: any) {
        params = params || {bubbles: false, cancelable: false, detail: undefined};
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
        return evt;
    }

    CustomEvent.prototype = (window as any).Event.prototype;

    (window as any).CustomEvent = CustomEvent;

    // Map.prototype.values() not provided in IE11.
    // tslint:disable-next-line
    window.Map = require('es6-map/polyfill');
  }
})();

if (!(Object as any).values) {
  values.shim();
}

if (!(Object as any).entries) {
  entries.shim();
}
