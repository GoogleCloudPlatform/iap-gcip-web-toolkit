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

# Publishes a new version of the gcip-iap NPM package. The release notes is
# generated from CHANGELOG.md. You need to login to npm using
# `npm login --registry https://wombat-dressing-room.appspot.com` before running
# this script.
#
# Usage:
# $ buildtools/publish.sh <major|minor|patch> <push_sample_apps>

INTERNAL_REPOSITORY_TEAM="cicp-eng"
INTERNAL_REPOSITORY_NAME="cicp-iap-js"
INTERNAL_REPOSITORY="sso://team/${INTERNAL_REPOSITORY_TEAM}/${INTERNAL_REPOSITORY_NAME}"
set -e

printusage() {
  echo "publish.sh <version> <push_sample_apps>"
  echo ""
  echo "Arguments:"
  echo "  version: 'patch', 'minor', or 'major'."
  echo "  push_sample_apps: 'y', 'n'."
}

VERSION=$1
PUSH_SAMPLE_APPS=$2
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
trap "echo 'Missing hub.'; exit 1" ERR
which hub &> /dev/null
trap - ERR

trap "echo 'Missing node.'; exit 1" ERR
which node &> /dev/null
trap - ERR

trap "echo 'Missing jq.'; exit 1" ERR
which jq &> /dev/null
trap - ERR

trap "echo 'Missing git.'; exit 1" ERR
which git &> /dev/null
trap - ERR

trap "echo 'Missing Chrome.'; exit 1" ERR
which google-chrome &> /dev/null
trap - ERR
echo "Chrome version:"
google-chrome --version
echo "Checked for commands."

echo "Checking for logged-in npm user..."
trap "echo 'Please login to npm using \`npm login --registry https://wombat-dressing-room.appspot.com\`'; exit 1" ERR
npm whoami --registry https://wombat-dressing-room.appspot.com
trap - ERR
echo "Checked for logged-in npm user."

echo "Moving to temporary directory..."
TEMPDIR1=$(mktemp -d)
echo "[DEBUG] ${TEMPDIR1}"
cd "${TEMPDIR1}"
echo "Moved to temporary directory."

WDIR1=$(pwd)

echo "Cloning internal repo ${INTERNAL_REPOSITORY}..."
trap "echo 'Please login to corp account using \`glogin\` or \`prodaccess\`'; exit 1" ERR
git clone $INTERNAL_REPOSITORY
trap - ERR
echo "Internal repo cloned."

cd $INTERNAL_REPOSITORY_NAME

echo "Making sure there is a changelog..."
if [ ! -s CHANGELOG.md ]; then
  echo "CHANGELOG.md is empty. Aborting."
  exit 1
fi
echo "Made sure there is a changelog."

echo "Running npm install..."
npm install
echo "Ran npm install."

echo "Running tests..."
trap "echo 'Tests failed'; exit 1" ERR
# TODO: extend to run e2e tests.
npm test
trap - ERR
echo "Tests passed."

echo "Making a $VERSION version..."
npm version $VERSION
NEW_VERSION=$(jq -r ".version" package.json)
echo "Made a $VERSION version: $NEW_VERSION."

echo "Making the release notes..."
RELEASE_NOTES_FILE=$(mktemp)
echo "[DEBUG] ${RELEASE_NOTES_FILE}"
echo "v${NEW_VERSION}" >> "${RELEASE_NOTES_FILE}"
echo "" >> "${RELEASE_NOTES_FILE}"
cat CHANGELOG.md >> "${RELEASE_NOTES_FILE}"
echo "Made the release notes."

echo "Publishing to npm..."
npm publish --dry-run
echo "Published to npm."

echo "Cleaning up release notes..."
rm CHANGELOG.md
touch CHANGELOG.md
git commit -m "[gcip-iap-release] Removed change log after ${NEW_VERSION} release" CHANGELOG.md
echo "Cleaned up release notes."

echo "Publishing changes to internal repo: $INTERNAL_REPOSITORY"
git push origin master

GITHUB_REPOSITORY=$(jq -r ".repository.url" package.json)
echo "Moving to temporary directory..."
TEMPDIR2=$(mktemp -d)
echo "[DEBUG] ${TEMPDIR2}"
cd "${TEMPDIR2}"
echo "Moved to temporary directory."

WDIR2=$(pwd)

echo "Cloning repository..."
git clone "${GITHUB_REPOSITORY}.git"
# Only one directory should exist.
cd *
echo "Cloned repository."

# echo "Publishing release notes..."
# hub release create --file "${RELEASE_NOTES_FILE}" "v${NEW_VERSION}"
# echo "Published release notes."

# Copy package.json and README from internal repo to public one.
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/package.json" .
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/README.md" .
# Update sample apps if needed.
if [[ $PUSH_SAMPLE_APPS = "y" ]] || [[ $PUSH_SAMPLE_APPS = "Y" ]]; then
  cp -r "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/sample" "./sample"
fi
# git commit -am "[gcip-iap-release] Pushed v${NEW_VERSION}"
# echo "Pushing to GitHub..."
# git push origin master
# echo "Pushed to GitHub."
