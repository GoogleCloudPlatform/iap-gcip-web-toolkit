# gcip-iap-js for GCIP/IAP integration

This library implements the protocol used to integrate GCIP (Google Cloud's
Identity Platform) for third party authentication with IAP (Identity Aware
Proxy).
The developer will have to host a sign-in UI (or just use FirebaseUI) so
traffic can be routed to from IAP when a user tries to access a specific IAP
resource without being authenticated.

This repo is under construction and subject to change.

Refer to the
[GCIP/IAP design doc](https://docs.google.com/document/d/1Jc8pgZd9Yr_Rg3yRQTiFz8Ole8MfD8Ut8_F8yUr3Alo/)
for more details.

This implementation will go through multiple phases:
Phase 1:
- One IAP resource maps to one GCIP tenant.
- One IAP resource maps to one GCIP project.

Phase 2:
- One IAP resource maps to multiple GCIP tenants.

More details will be needed for phase 2 to determine how a user will be routed
to the appropriate tenant when trying to access a specific resource with
multiple tenants.

## Table of Contents

1. [Developer Setup](#developer-setup)
1. [Contributing](#contributing)
1. [Usage instructions](#usage-instructions)

## Developer Setup

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

```bash
git clone sso://team/cicp-eng/cicp-iap-js
cd cicp-iap-js
npm install
```
Note you need to be a member of mdb/cicp-eng in order to contribute to this repo.

## Contributing

If you want to submit CLs to the repo through gerrit, you will want to clone the
repo with the 'commit message hook' installed:

```bash
git clone sso://team/cicp-eng/cicp-iap-js && (cd cicp-iap-js && f=`git rev-parse --git-dir`/hooks/commit-msg ; curl -Lo $f https://gerrit-review.googlesource.com/tools/hooks/commit-msg ; chmod +x $f)
```

To begin code review:
```bash
# If this is the first commit of the CL, do:
git commit -am "Commit message"

# If you are responding to comments, do:
git commit --amend

# To upload the changes to gerrit:
git push origin HEAD:refs/for/master
```

To build the binary, run:
```bash
npm run build
```

This will generate an IIFE browser build (`index.iife.js`), a commonJS
build (`index.cjs.js`) and an ES6 module browser build (`index.esm.js`)
via `rollup` under `dist/`. The IIFE version can eventually be deployed via CDN
for developers who want to consume it this way.

To run various tests:
Unit tests: `npm run test:browser:unit`
Integration tests: `npm run test:browser:integration`
Lint and unit tests: `npm test`

Browsers tests are run using karma with `HeadlessChrome`. Additional browsers
will be added along with future integration with saucelab.

Integration tests will eventually be run in conjunction with `FirebaseUI`.

Code coverage is generated with above tests in a summary form and displayed
in the terminal window at the conclusion of the test.
Detailed coverage is generated in HTML form accessible from the `/coverage`
generated folder.

The library is expected to run in browsers only. It will also depend on `URL`,
`fetch` and `Promise` APIs which are not available in all browsers.
Developers who want to support these browsers are expected to provide
polyfills for them as peer dependencies.

## Usage Instructions

End to end testing is still not possible as there is no mechamism yet to
configure the resource to tenant mapping on the IAP side and the IAP
endpoints have not been created yet.

When the above is ready, a project with CICP and IAP will need to be
configured. A mapping defining the IAP resource to CICP tenant and the
corresponding URL where the sign-in UI will be hosted have to be provided via
the Cloud Console UI.

The library can then be used on the sign-in page.
This can be illustrated as shown, using FirebaseUI.

```javascript
// Import Firebase dependencies.
import * as firebase from 'firebase/app';
import 'firebase/auth';

// Import FirebaseUI dependencies.
// firebaseui.auth.FirebaseUiHandler is required to be implemented.
import * as firebaseui from 'firebaseui';

// Import GCIP/IAP module (using local build).
import * as ciap from './dist/index.esm.js';

// The agent project configuration.
const config = {
  apiKey: 'API_KEY',
  authDomain: 'project-id.firebaseapp.com',
};

// The list of UI configs for each supported tenant.
const uiConfigs = {
  tenantId1: {
    // Tenant1 supports Google and Email sign-in.
    signInOptions: [
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
    ]
  },
  tenantId2: {
    // Tenant2 supports OIDC providers.
    signInOptions: [
      {provider: 'oidc.myProvider1'},
      {provider: 'oidc.myProvider2'},
    ]
  },
  tenantId3: {
    // Tenant3 supports SAML providers.
    signInOptions: [
      {provider: 'saml.myProvider1'},
      {provider: 'saml.myProvider2'},
    ]
  },
};

// This will handle the underlying handshake for sign-in, sign-out,
// token refresh, safe redirect to callback URL, etc.
const handler = new firebaseui.auth.FirebaseUiHandler(
    '#firebaseui-auth-container', config, uiConfigs);
const ciapInstance = new ciap.Authentication(handler);
ciapInstance.start();
```