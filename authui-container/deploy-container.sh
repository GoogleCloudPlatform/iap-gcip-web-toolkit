#!/bin/bash
# Copyright 2020 Google Inc. All Rights Reserved.
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

# This script is used to deploy a new version of the containerized Auth UI.
# Sign in to gcloud with editor role in project ID gcip-iap is required.

# Install all dependencies.
npm install
# Build all output files before deploying container.
npm run bundle
# Set expected GCP project where the container image lives.
gcloud config set project gcip-iap
# Containerize the authui app.
gcloud builds submit --tag gcr.io/gcip-iap/authui

# Note that the authui container image should be made public.
# Cloud Console -> Container Registry -> Settings
