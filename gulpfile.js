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
'use strict';
/**************/
/*  REQUIRES  */
/**************/
const gulp = require('gulp');
const pkg = require('./package.json');
const runSequence = require('run-sequence');
// File I/O
const del = require('del');
const header = require('gulp-header');
const replace = require('gulp-replace');
// Rollup
const rollup = require('rollup');
const typescript = require('rollup-plugin-typescript2');
const minify = require('rollup-plugin-babel-minify');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
/****************/
/*  FILE PATHS  */
/****************/
const paths = {
  src: [
    'src/**/*.ts'
  ],
  build: [
    'dist/**/*.js'
  ],
  dist: 'dist/',
};

const banner = `/*! gcip-iap-js v${pkg.version} */\n`;

const plugins = [
  typescript({
    typescript: require('typescript'),
  }),
  resolve(),
  minify({
    comments: false,
  }),
  commonjs({
    include: 'node_modules/**',
  }),
];

const deps = Object.keys(
  Object.assign({}, pkg.peerDependencies, pkg.dependencies)
);
deps.push('whatwg-fetch');
deps.push('url-polyfill');
deps.push('promise-polyfill');
/***********/
/*  TASKS  */
/***********/
gulp.task('cleanup', function() {
  return del([
    paths.dist,
  ]);
});

gulp.task('rollupjs', function (done) {
  return rollup.rollup({
    input: 'src/index.ts',
    plugins,
    context: 'window',
    external: id => deps.some(dep => id === dep || id.startsWith(`${dep}/`))
  }).then(bundle => {
    const promises = [
      bundle.write({ file: pkg.browser, format: 'iife', name: 'ciap'}),
      bundle.write({ file: pkg.main, format: 'cjs' }),
      bundle.write({ file: pkg.module, format: 'es' })
    ]
    return Promise.all(promises);
  });
});

gulp.task('compile', ['rollupjs'], function() {
  return gulp.src(paths.build)
    // Replace SDK version
    .pipe(replace(/\<XXX_SDK_VERSION_XXX\>/g, pkg.version))
    // Add header
    .pipe(header(banner))
    // Write to build directory
    .pipe(gulp.dest(paths.dist))
});

gulp.task('copyTypings', function() {
  return gulp.src('src/index.d.ts')
    // Add header
    .pipe(header(banner))
    // Write to build directory
    .pipe(gulp.dest(paths.dist))
});

// Regenerates js every time a source file changes
gulp.task('watch', function() {
  gulp.watch(paths.src, ['compile']);
});

// Build task
gulp.task('build', function(done) {
  runSequence('cleanup', 'compile', 'copyTypings', function(error) {
    done(error && error.err);
  });
});

// Default task
gulp.task('default', function(done) {
  runSequence('build', function(error) {
    done(error && error.err);
  });
});
