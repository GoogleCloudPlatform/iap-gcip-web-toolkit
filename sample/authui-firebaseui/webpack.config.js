/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for t`he specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const path = require('path');

const config = {
  context: __dirname,
  entry: {
    'script': './src/script.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './public'),
  },
  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      'promise-polyfill': path.resolve(__dirname, './node_modules/promise-polyfill/'),
      'url-polyfill': path.resolve(__dirname, './node_modules/url-polyfill/'),
      'whatwg-fetch': path.resolve(__dirname, './node_modules/whatwg-fetch/'),
    },
  },
  stats: {
    colors: true,
    reasons: true,
    chunks: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        loader: 'url-loader?limit=100000'
      }
    ]
  },
  mode: 'none',
  optimization: {
    minimize: true
  }
}

module.exports = config;
