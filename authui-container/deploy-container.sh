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

# GCP project ID.
PROJECT_ID="gcip-iap"
# GCR container image name.
IMG_NAME="authui"
# Version placeholder to replace in file.
VERSION_PLACEHOLDER="__XXX_HOSTED_UI_VERSION_XXX__"

printusage() {
  echo "deploy-container.sh <version>"
  echo ""
  echo "Arguments:"
  echo "  version: 'patch', 'minor', or 'major'."
}

VERSION=$1
if [[ $VERSION == "" ]]; then
  printusage
  exit 1
elif [[ ! ($VERSION == "patch" || \
           $VERSION == "minor" || \
           $VERSION == "major") ]]; then
  printusage
  exit 1
fi

echo "Checking for commands..."
trap "echo 'Missing tee.'; exit 1" ERR
which tee &> /dev/null
trap - ERR

trap "echo 'Missing gcloud.'; exit 1" ERR
which gcloud &> /dev/null
trap - ERR

trap "echo 'Missing npm.'; exit 1" ERR
which npm &> /dev/null
trap - ERR

trap "echo 'Missing sed.'; exit 1" ERR
which sed &> /dev/null
trap - ERR

trap "echo 'Missing awk.'; exit 1" ERR
which awk &> /dev/null
trap - ERR

trap "echo 'Missing vim.'; exit 1" ERR
which vim &> /dev/null
trap - ERR

trap "echo 'Missing cat.'; exit 1" ERR
which cat &> /dev/null
trap - ERR

# Install all dependencies.
npm install
# Build all output files before deploying container.
npm run bundle
# Create new version of hosted UI.
echo "Making a $VERSION version..."
npm version $VERSION
UI_VERSION=$(jq -r ".version" package.json)
echo "Made a $VERSION version: $UI_VERSION."
# Substitute version in file.
chmod 755 dist/server/auth-server.js
sed -i "" "s/${VERSION_PLACEHOLDER}/${UI_VERSION}/g" dist/server/auth-server.js
# Set expected GCP project where the container image lives.
gcloud config set project $PROJECT_ID
# Document changes introduced in the current build.
read -p "Click enter to provide the changes introduced in this version: " next
CHANGELOG_FILE=$(mktemp)
vim $CHANGELOG_FILE
change_summary=$(cat ${CHANGELOG_FILE})
# Containerize the authui app. Save output to temporary file.
OUTPUT_FILE=$(mktemp)
# Note that the authui container image should be made public.
# Cloud Console -> Container Registry -> Settings
gcloud builds submit --tag gcr.io/$PROJECT_ID/$IMG_NAME | tee "${OUTPUT_FILE}"
# Find new image hash. This is needed to keep track of the current image for the current build.
GCR_VERSION=$(grep "latest: digest: sha256:" "${OUTPUT_FILE}" | awk '{ print $3 }')
echo "Deployed gcr.io/${PROJECT_ID}/${IMG_NAME}@${GCR_VERSION}"
# Clean up.
rm "${OUTPUT_FILE}"
rm "${CHANGELOG_FILE}"
# Log changes.
echo "" >> CHANGELOG.md
echo "#v${UI_VERSION}" >> CHANGELOG.md
echo "" >> CHANGELOG.md
echo "gcr.io/${PROJECT_ID}/${IMG_NAME}@${GCR_VERSION}"  >> CHANGELOG.md
echo "" >> CHANGELOG.md
echo "${change_summary}" >> CHANGELOG.md
