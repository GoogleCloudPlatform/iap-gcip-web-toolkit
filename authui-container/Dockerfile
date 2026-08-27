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

# Use the official lightweight Node.js 24 image.
# https://hub.docker.com/_/node
FROM node:24-slim

# Update OS image and purge unused perl-base to eliminate upstream Perl CVEs
RUN apt update && apt -y upgrade && apt -y autoremove && rm -rf /var/lib/apt/lists/* && \
    dpkg --purge --force-depends --force-remove-essential perl-base

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies and remove global npm CLI to eliminate build tooling CVEs
RUN npm install --only=production && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy local code to the container image.
COPY . ./

# Run the web service on container startup directly via node.
CMD [ "node", "dist/server/app.js" ]