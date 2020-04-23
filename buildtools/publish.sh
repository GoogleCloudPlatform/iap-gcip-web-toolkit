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
#
# The environment variables SA_KEY_NONE, SA_KEY_SINGLE and SA_KEY_MULTI
# should be populated with the service account credentials.
# If running locally, this can be done as follows:
# export SA_KEY_NONE=`cat ./test/resources/key.json`
# export SA_KEY_SINGLE=`cat ./test/resources/key_single_tenant.json`
# export SA_KEY_MULTI=`cat ./test/resources/key_multi_tenant.json`

INTERNAL_REPOSITORY_TEAM="cicp-eng"
INTERNAL_REPOSITORY_NAME="cicp-iap-js"
INTERNAL_REPOSITORY="sso://team/${INTERNAL_REPOSITORY_TEAM}/${INTERNAL_REPOSITORY_NAME}"
SAMPLE_APPS=( "authui" "authui-react" "authui-firebaseui" )
set -e

printusage() {
  echo "publish.sh <version> <push_sample_apps>"
  echo ""
  echo "Arguments:"
  echo "  version: 'patch', 'minor', or 'major'."
  echo "  push_sample_apps: 'y', 'n'. Default is 'n'."
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

echo "Checking environment variables..."
if [[ $SA_KEY_NONE == "" ]]; then
  echo "SA_KEY_NONE environment variable is not defined."
  exit 1
elif [[ $SA_KEY_SINGLE == "" ]]; then
  echo "SA_KEY_SINGLE environment variable is not defined."
  exit 1
elif [[ $SA_KEY_MULTI == "" ]]; then
  echo "SA_KEY_MULTI environment variable is not defined."
  exit 1
fi
echo "Environment variables checked."

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

trap "echo 'Missing firebase.'; exit 1" ERR
which firebase &> /dev/null
trap - ERR

trap "echo 'Missing Chrome.'; exit 1" ERR
if [[ `uname` = "Darwin" ]]; then
  # Mac OS.
  which /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome &> /dev/null
  trap - ERR
  echo "Chrome version:"
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
else
  # Linux.
  which google-chrome &> /dev/null
  trap - ERR
  echo "Chrome version:"
  google-chrome --version
fi
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
# Copy key files needed for e2e tests to new directory.
echo "${SA_KEY_NONE}" > test/resources/key.json
echo "${SA_KEY_SINGLE}" > test/resources/key_single_tenant.json
echo "${SA_KEY_MULTI}" > test/resources/key_multi_tenant.json
trap "echo 'Tests failed'; exit 1" ERR
# Run unit tests.
npm test
# Run integration tests.
npm run test:e2e
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
npm publish
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

echo "Cloning GitHub repository..."
git clone "${GITHUB_REPOSITORY}.git"
# Only one directory should exist.
cd *
echo "Cloned GitHub repository."

# Copy package.json and README from internal repo to public one.
echo "Copying package.json and README..."
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/package.json" .
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/README.md" .
# Copy other required files.
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/CONTRIBUTING.md" .
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/LICENSE" .
cp "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/.gitignore" .
# Remove scripts from package.json
jq "del(.scripts)" package.json > tmp.$$.json && mv tmp.$$.json package.json
echo "Copied package.json and README."

# Update sample apps if needed.
if [[ $PUSH_SAMPLE_APPS = "y" ]] || [[ $PUSH_SAMPLE_APPS = "Y" ]]; then
  echo "Copying sample apps..."
  cp -r "${WDIR1}/${INTERNAL_REPOSITORY_NAME}/sample" "./sample"
  echo "Copied sample apps."
fi

# Updating gcip-iap dependencies in sample apps.
echo "Updating gcip-iap dependencies in sample apps..."
for i in ${SAMPLE_APPS[@]}
do
  if [[ `uname` = "Darwin" ]]; then
    sed -i '' -e "s/\"gcip-iap\":\ \"\(.*\)\"/\"gcip-iap\":\ \"${NEW_VERSION}\"/g" ./sample/${i}/package.json
  else
    sed -i "s/\"gcip-iap\":\ \"\(.*\)\"/\"gcip-iap\":\ \"${NEW_VERSION}\"/g" ./sample/${i}/package.json
  fi
done
echo "Updated gcip-iap dependencies in sample apps..."

# Commit the change and create a release tag.
echo "Creating release commit and tag in GitHub repository..."
git add -A
git commit -m "[gcip-iap-release] Pushed v${NEW_VERSION}"
git tag -a v${NEW_VERSION} -m "[gcip-iap-release] Pushed v${NEW_VERSION}"
echo "Created release commit and tag in GitHub repository."

# echo "Pushing release commit and tag to GitHub..."
git push origin master --tags
# echo "Pushed release commit and tag GitHub."

# echo "Publishing release notes..."
hub release create --file="${RELEASE_NOTES_FILE}" "v${NEW_VERSION}"
# echo "Published release notes."
