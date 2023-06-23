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

print_usage() {
  echo "publish.sh <version> <push_sample_apps>"
  echo ""
  echo "Arguments:"
  echo "  version: 'patch', 'minor', or 'major'."
  echo "  push_sample_apps: 'y', 'n'. Default is 'n'."
}

# expects the first param as the line number, second param as working dir, third+ params as dirs to be deleted.
handle_github_error() {
  echo "Hit error on line $1"
  echo "Github clone failed. Ensure that your ssh keys are setup as described in https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent"
  cd $2
  # delete directories specified as arg3 and later
  for i in "${@:3}"
  do
    echo "Deleting temp directory $i"
    rm -rf $i
  done
}

# expects the first param as the working dir, second+ params as dirs to be deleted.
cleanup_and_exit() {
  cd $1
  # delete directories specified as arg2 and later
  for i in "${@:2}"
  do
    echo "Deleting temp directory $i"
    rm -rf $i
  done
  exit 1
}

VERSION=$1
PUSH_SAMPLE_APPS=$2
if [[ $VERSION == "" ]]; then
  print_usage
  exit 1
elif [[ ! ($VERSION == "patch" || \
           $VERSION == "minor" || \
           $VERSION == "major") ]]; then
  print_usage
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

CURRENTDIR=$(pwd)
TEMPDIRGITHUB=$(mktemp -d)
GITHUB_SSH_CLONE=$(jq -r .repository.sshclone package.json)
echo -e "Attempting git clone in ${TEMPDIRGITHUB} to make sure the SSH keys are setup correctly. Another clone will be done later.\n\n";
cd "${TEMPDIRGITHUB}"
echo "Moved to temporary directory for github cloning."
trap 'handle_github_error $LINENO $CURRENTDIR $TEMPDIRGITHUB' ERR
git clone "${GITHUB_SSH_CLONE}"
trap - ERR
cd "${CURRENTDIR}"
rm -rf "${TEMPDIRGITHUB}"
echo -e "Verified that git clone works.\n\n";

TEMPDIR1=$(mktemp -d)
echo -e "Moving to temporary directory ${TEMPDIR1} for testing + release...\n\n"
cd "${TEMPDIR1}"
echo "Moved to temporary directory."

echo -e "Cloning internal repo ${INTERNAL_REPOSITORY}...\n\n"
trap "echo 'Please login to corp account using \`glogin\` or \`prodaccess\`'; exit 1" ERR
git clone $INTERNAL_REPOSITORY
trap - ERR
echo "Internal repo cloned."

cd $INTERNAL_REPOSITORY_NAME

echo "Making sure there is a changelog..."
if [ ! -s CHANGELOG.md ]; then
  echo "CHANGELOG.md is empty. Aborting."
  cleanup_and_exit $CURRENTDIR $TEMPDIR1
fi
echo "Made sure there is a changelog."

echo "Running npm install..."
npm install
echo "Ran npm install."

echo -e "Running tests...\n\n"
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
echo -e "Tests passed.\n\n"

echo "Making a $VERSION version..."
npm version $VERSION
NEW_VERSION=$(jq -r ".version" package.json)
echo -e "Made a $VERSION version: $NEW_VERSION.\n\n"

RELEASE_NOTES_FILE=$(mktemp)
echo "Making the release notes in file ${RELEASE_NOTES_FILE}..."
echo "v${NEW_VERSION}" >> "${RELEASE_NOTES_FILE}"
echo "" >> "${RELEASE_NOTES_FILE}"
cat CHANGELOG.md >> "${RELEASE_NOTES_FILE}"
echo -e "Made the release notes.\n\n"

read -p "Do you want to continue publishing to npm?(Y/N)" continue
if [[ $continue != "y" && $continue != "Y" ]]; then
  echo "Exiting."
  cleanup_and_exit $CURRENTDIR $TEMPDIR1
fi

echo "Publishing to npm..."
npm publish --registry https://wombat-dressing-room.appspot.com
echo -e "Published to npm.\n\n"

echo "Cleaning up release notes..."
rm CHANGELOG.md
touch CHANGELOG.md
git commit -m "[gcip-iap-release] Removed change log after ${NEW_VERSION} release" CHANGELOG.md
echo "Cleaned up release notes."

echo "Publishing changes to internal repo: $INTERNAL_REPOSITORY"
git push origin master

TEMPDIR2=$(mktemp -d)
echo "Moving to temporary directory ${TEMPDIR2} for github cloning..."
cd "${TEMPDIR2}"
echo "Moved to temporary directory."

echo "Cloning GitHub repository.."
trap 'handle_github_error $LINENO $CURRENTDIR $TEMPDIR1 $TEMPDIR2' ERR
git clone "${GITHUB_SSH_CLONE}"
trap - ERR
# Only one directory should exist.
cd *
echo "Cloned GitHub repository."

# Copy package.json and README from internal repo to public one.
echo "Copying package.json and README..."
cp "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/package.json" .
cp "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/README.md" .
# Copy other required files.
cp "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/CONTRIBUTING.md" .
cp "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/LICENSE" .
cp "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/.gitignore" .
# Remove scripts from package.json
jq "del(.scripts)" package.json > tmp.$$.json && mv tmp.$$.json package.json
echo "Copied package.json and README."

# Update sample apps if needed.
if [[ $PUSH_SAMPLE_APPS = "y" ]] || [[ $PUSH_SAMPLE_APPS = "Y" ]]; then
  echo "Copying sample apps..."
  cp -r "${TEMPDIR1}/${INTERNAL_REPOSITORY_NAME}/sample" "./sample"
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

read -p "Do you want to push a release tag on github? (Y/N)" continue
if [[ $continue != "y" && $continue != "Y" ]]; then
  echo "Exiting."
  cleanup_and_exit $CURRENTDIR $TEMPDIR1 $TEMPDIR2
  exit 1
fi

# Commit the change and create a release tag.
echo "Creating release commit and tag in GitHub repository..."
git add -A
git commit -m "[gcip-iap-release] Pushed v${NEW_VERSION}"
git tag -a v${NEW_VERSION} -m "[gcip-iap-release] Pushed v${NEW_VERSION}"
echo "Created release commit and tag in GitHub repository."

echo -e "Pushing release commit and tag to GitHub...\n\n"
git push origin master --tags
echo -e "Pushed release commit and tag to GitHub.\n\n"

echo "Last Step - Publish a new release from the github console at https://github.com/GoogleCloudPlatform/iap-gcip-web-toolkit/releases/new, with the v${NEW_VERSION} tag."
