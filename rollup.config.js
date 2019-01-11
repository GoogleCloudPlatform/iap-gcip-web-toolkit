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

import typescript from 'rollup-plugin-typescript2';
import minify from 'rollup-plugin-babel-minify';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pkg from './package.json';

const plugins = [
  typescript({
    typescript: require('typescript'),
  }),
  resolve(),
  minify({
    comments: false
  }),
  commonjs({
    include: 'node_modules/**'
  })
];

const deps = Object.keys(
  Object.assign({}, pkg.peerDependencies, pkg.dependencies)
);
deps.push('whatwg-fetch');
deps.push('url-polyfill');
deps.push('promise-polyfill');

export default [
  {
    input: 'src/index.ts',
    output: [
      { file: pkg.browser, format: 'iife', name: 'ciap'},
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    plugins,
    context: 'window',
    external: id => deps.some(dep => id === dep || id.startsWith(`${dep}/`))
  }
];
