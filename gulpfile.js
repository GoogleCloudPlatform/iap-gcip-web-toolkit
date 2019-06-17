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
// File I/O
const del = require('del');
const header = require('gulp-header');
const replace = require('gulp-replace');
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
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
    'dist/**/*'
  ],
  dist: 'dist/',
  // Temporary directory.
  tmpDir: 'tmp/',
  // Path to ciap builds to be included in alpha package.
  ciapBuild: 'builds/ciap',
  // Intermediate temporary files to be zipped for alpha package.
  tmp: [
    'tmp/**/*'
  ],
  // Public build files to be included in alpha package.
  publicBuilds: [
    'builds/**/*',
  ],
  // Public sample apps to be included in alpha package.
  publicSamples: [
    'sample/**/*',
    // Exclude READMEs for now. This are explained in the user guide doc.
    '!sample/app/README.md',
    '!sample/authui/README.md',
    // Exclude node_modules folders from public sample apps.
    '!**/node_modules',
    '!**/node_modules/**/*',
  ],
  metadata: [
    'CHANGELOG.md',
  ],
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
gulp.task('cleanup', () => {
  return del([
    paths.dist,
    paths.tmpDir,
    paths.ciapBuild,
  ]);
});

gulp.task('rollupjs', (done) => {
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

gulp.task('compile', gulp.series('rollupjs', () => {
  return gulp.src(paths.build)
    // Replace SDK version.
    .pipe(replace(/\<XXX_SDK_VERSION_XXX\>/g, pkg.version))
    // Add header.
    .pipe(header(banner))
    // Write to build directory.
    .pipe(gulp.dest(paths.dist))
}));

gulp.task('copyTypings', () => {
  return gulp.src('src/index.d.ts')
    // Add header.
    .pipe(header(banner))
    // Write to build directory.
    .pipe(gulp.dest(paths.dist))
});

// Regenerates js every time a source file changes.
gulp.task('watch', () => {
  gulp.watch(paths.src, ['compile']);
});

// Builds the GCIP/IAP binaries and their type definition file.
gulp.task('build', gulp.series('cleanup', 'compile', 'copyTypings'));

// Copies the generated ciap JS files to build/ciap folder.
// This task depends on build task.
gulp.task('copy-ciap-builds',
    () => gulp.src(paths.build)
    .pipe(gulp.dest(paths.ciapBuild)));

// Copies the metadata, eg. CHANGELOG.md.
gulp.task('copy-metadata',
    () => gulp.src(paths.metadata)
    .pipe(gulp.dest(`${paths.tmpDir}/`)));

// Copies the sample folder for the alpha package into a temporary folder.
gulp.task('copy-alpha-package-sample',
    () => gulp.src(paths.publicSamples)
    .pipe(gulp.dest(`${paths.tmpDir}/sample`)));

// Copies the builds folder for the alpha package into a temporary folder.
// This task depends on copy-ciap-builds.
gulp.task('copy-alpha-package-builds',
    () => gulp.src(paths.publicBuilds)
    .pipe(gulp.dest(`${paths.tmpDir}/builds`)));

// Generates the tarball for the alpha package which includes the sample
// apps and builds folders.
// This task depends on copy-alpha-package-sample and copy-alpha-package-builds.
gulp.task('compress-alpha-package',
    () => gulp.src(paths.tmp)
    .pipe(tar(`gcip-iap-${pkg.version}.tar`))
    .pipe(gzip())
    .pipe(gulp.dest(paths.dist)));

// Generates the alpha package and compresses it into one file.
// This task depends on 'copy-ciap-builds.
gulp.task('create-alpha-package', gulp.series(
  'copy-metadata',
  'copy-alpha-package-sample',
  'copy-alpha-package-builds',
  'compress-alpha-package'));

// Builds alpha task. This will generate the dist/gcip-iap-x.y.z.tar.gz file
// with all the files and sample apps needed for the alpha testers.
gulp.task('build-alpha', gulp.series(
  'build', 'copy-ciap-builds', 'create-alpha-package'));

// Default task.
gulp.task('default', gulp.series('build'));
