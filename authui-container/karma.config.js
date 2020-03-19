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

const path = require('path');

module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai', 'sinon', 'karma-typescript'],
    files: [
      'src/**/*.ts',
      'common/**/*.ts',
      'src/utils/**/*.ts',
      'test/unit/src/**/*.ts',
      'test/unit/src/utils/**/*.ts',
    ],
    exclude: [],
    preprocessors: {
      'test/unit/src/**/*.ts': ['karma-typescript'],
      'src/utils/**/*.ts': ['karma-typescript', 'coverage'],
      'src/**/*.ts': ['karma-typescript', 'coverage'],
      'common/**/*.ts': ['karma-typescript'],
    },
    mime: {
      'text/x-typescript': ['ts']
    },
    karmaTypescriptConfig: {
      transformPath: function(path) {
        return path.replace(/\.ts$/, '.js');
      },
      tsconfig: './tsconfig.webpack.json',
      bundlerOptions: {
        transforms: [require('karma-typescript-es6-transform')()],
      },
    },
    reporters: ['verbose', 'progress', 'coverage', 'karma-typescript'],
    client: {
      clearContext: false
    },
    browserConsoleLogOptions: {
      level: 'log',
      terminal: true
    },
    singleRun: true,
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless'],
    autoWatch: false,
    concurrency: Infinity,
    coverageReporter: {
      includeAllSources: true,
      dir: 'coverage/',
      reporters: [
        {type: 'html', subdir: 'html'},
        {type: 'text-summary'}
      ]
    }
  })
};