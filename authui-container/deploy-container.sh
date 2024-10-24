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
# GCR path where the image is stored
GCR_PATH=gcr.io/$PROJECT_ID/$IMG_NAME

printusage() {
  echo "deploy-container.sh <version>"
  echo ""
  echo "Arguments:"
  echo "  version: 'test', 'patch', 'minor', or 'major'."
}

VERSION=$1
if [[ $VERSION == "" ]]; then
  printusage
  exit 1
elif [[ ! ($VERSION == "test" || \
           $VERSION == "patch" || \
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

trap "echo 'Missing jq.'; exit 1" ERR
which jq &> /dev/null
trap - ERR

# Install all dependencies.
npm install
# Build all output files before deploying container.

trap "echo 'Failed to create the bundle.'; exit 1" ERR
npm run bundle
trap - ERR

# Skip for non-production builds.
if [[ $VERSION != "test" ]]; then
  # Create new version of hosted UI.
  echo "Making a $VERSION version..."
  npm version $VERSION
  UI_VERSION=$(jq -r ".version" package.json)
  echo "Made a $VERSION version: $UI_VERSION."
  # Substitute version in file.
  trap "echo 'Failed to update container version in auth-server.js'; exit 1" ERR
  chmod 755 dist/server/auth-server.js

  case "$OSTYPE" in
    darwin*|bsd*)
      echo "Using BSD sed style"
      sed_no_backup=( -i '' )
      ;;
    *)
      echo "Using GNU sed style"
      sed_no_backup=( -i )
      ;;
  esac

  sed -i ${sed_no_backup[@]} "s/${VERSION_PLACEHOLDER}/${UI_VERSION}/g" dist/server/auth-server.js
  trap - ERR
fi

# Set expected GCP project where the container image lives.
gcloud config set project $PROJECT_ID
# Skip for non-production builds.
if [[ $VERSION != "test" ]]; then
  # Document changes introduced in the current build.
  read -p "Click enter to provide the changes introduced in this version: " next
  CHANGELOG_FILE=$(mktemp)
  vim $CHANGELOG_FILE
  change_summary=$(cat ${CHANGELOG_FILE})
fi

# Update cloudbuild.json file with GCR path
tmp=$(mktemp)
# Update path in the steps attribute in cloudbuild.json
jq --arg gcr_path "$GCR_PATH" '.steps[0].args[2] = $gcr_path' cloudbuild.json > "$tmp" && mv "$tmp" cloudbuild.json
# Update path in the images attribute in cloudbuild.json
jq --arg gcr_path "$GCR_PATH" '.images[0] = $gcr_path' cloudbuild.json > "$tmp" && mv "$tmp" cloudbuild.json

# Containerize the authui app. Save output to temporary file.
OUTPUT_FILE=$(mktemp)
# Note that the authui container image should be made public.
# Cloud Console -> Container Registry -> Settings
gcloud builds submit --config cloudbuild.json ./ | tee "${OUTPUT_FILE}"
# Find new image hash. This is needed to keep track of the current image for the current build.
GCR_VERSION=$(grep "latest: digest: sha256:" "${OUTPUT_FILE}" | awk '{ print $3 }')
echo "Deployed gcr.io/${PROJECT_ID}/${IMG_NAME}@${GCR_VERSION}"

#Generate SBOM explicitly via command as auto generation is not supported when build is triggered via CLI
gcloud artifacts sbom export --uri=$GCR_PATH

# Clean up.
rm "${OUTPUT_FILE}"
# Skip for non-production builds.
if [[ $VERSION != "test" ]]; then
  rm "${CHANGELOG_FILE}"
  # Log changes.
  echo "" >> CHANGELOG.md
  echo "#v${UI_VERSION}" >> CHANGELOG.md
  echo "" >> CHANGELOG.md
  echo "gcr.io/${PROJECT_ID}/${IMG_NAME}@${GCR_VERSION}"  >> CHANGELOG.md
  echo "" >> CHANGELOG.md
  echo "${change_summary}" >> CHANGELOG.md
fi
