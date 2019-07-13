#!/bin/bash
# Copyright 2019 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS-IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script is used to build and bundle sample/authui.
# This facilitates running integration tests on the latest changes in the ciap
# library.
# The script will be run from root folder.

# Generate the build files from the local files.
npm run build
# Copy index.esm to expected location for sample authui.
mkdir -p builds/ciap/
cp dist/index.esm.js builds/ciap/index.esm.js
# Go to sample Auth UI.
cd sample/authui
# Install sample Auth UI dependencies.
npm install
# Generate sample AuthUI bundle.
npm run bundle