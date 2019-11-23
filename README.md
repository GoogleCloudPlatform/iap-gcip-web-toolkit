# gcip-iap for GCIP/IAP integration

[Cloud Identity-Aware Proxy (Cloud IAP)](https://cloud.google.com/iap/)
controls access to your cloud applications and VMs running on Google Cloud Platform (GCP).
Cloud IAP verifies user identity and the context of the request to determine if a user
should be allowed to access an application or a VM.

[Google Cloud's Identity Platform (GCIP)]((https://cloud.google.com/identity-platform/))
aims to provide Developers with Google-grade Authentication and Security for their
applications, services, APIs, or anything else that requires identity and authentication.

Integrating IAP with GCIP allows the end users to do authentication using any
identity and identity provider that GCIP supports. This means that developers
will be able to use IdPs that are supported by GCIP (SAML, OIDC, social etc)
to authenticate users.

`gcip-iap` implements the protocol used to integrate
GCIP (Google Cloud's Identity Platform) for authenticating external identities
with IAP (Identity Aware Proxy).
Developers will have to host a sign-in UI (or just use
[FirebaseUI](https://github.com/firebase/firebaseui-web)) so
traffic can be routed to from IAP when a user tries to access a specific IAP
resource without being authenticated.

This repository contains the quick-start samples demonstrating how to integrate
a GCIP authentication UI with a GAE application gated with Cloud IAP.
Sample authentication UI pages are provided using Angular and ReactJS frameworks.

## Table of Contents

1. [Usage instructions](#usage-instructions)
1. [Sample app](#sample-app)
1. [Developer Setup](#developer-setup)

## Usage Instructions

In order to use external identities with IAP, an authentication page needs
to be hosted to handle authentication, tenant selection, token refreshes,
sign-out and all authentication related operations.
This page can be hosted anywhere and the same page can be shared for multiple
IAP resources or ever GCP projects.

The `gcip-iap` module is provided to abstract the underlying communication
between GCIP and IAP on that authentication page. This will expose callbacks
for UI and authentication related logic.
You will be able to build your own authentication UI on top of this via
these callbacks using the GCIP JS library. You can also use the pre-built
[FirebaseUI](https://github.com/firebase/firebaseui-web)
library as your authentication UI.

This will allow you to use all GCIP supported external providers such as:
- Email/password
- OAuth based (Google, Facebook, Twitter, GitHub, Microsoft, etc.)
- SAML based identity providers
- OIDC based identity providers
- Phone number authentication (not supported for multi-tenancy)
- Custom authentication (not supported for multi-tenancy)
- Anonymous sign-in (not supported for multi-tenancy)

Learn more on how to
[build your own authentication UI](### Build your own Authentication UI) or
[use the pre-built FirebaseUI](### Use pre-built UI with FirebaseUI).

### Build your own Authentication UI

The `gcip-iap` library defines an interface that can be implemented to
handle UI customizations for various scenarios dealing with sign-in and
sign-out flows:

```typescript
class Authentication {
  constructor(handler: AuthenticationHandler);
  start(): void;
  getOriginalURL(): Promise<string | null>;
}

interface SelectedTenantInfo {
  email?: string;
  tenantId: string | null;
  providerIds?: string[];
}

interface ProjectConfig {
  projectId: string;
  apiKey: string;
}

interface AuthenticationHandler {
  languageCode?: string | null;
  getAuth(apiKey: string, tenantId: string | null): FirebaseAuth;
  startSignIn(auth: FirebaseAuth, match?: SelectedTenantInfo): Promise<UserCredential>;
  selectProvider(projectConfig: ProjectConfig, tenantIds: string[]): Promise<SelectedTenantInfo>;
  completeSignOut(): Promise<void>;
  processUser?(user: User): Promise<User>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
  handleError?(error: Error | CIAPError): void;
}
```

When building your own custom authentication UI, you will need to implement
the AuthenticationHandler interface, and pass an instance of that to
Authentication constructor:

```javascript
import * as ciap from 'gcip-iap';
// Implement interface AuthenticationHandler.
// const authHandlerImplementation = ....
const ciapInstance = new ciap.Authentication(authHandlerImplementation);
ciapInstance.start();
```

### Use pre-built UI with FirebaseUI

If you do not want to build your own authentication page. An implementation of the
above AuthenticationHandler is provided via
[FirebaseUI](https://github.com/firebase/firebaseui-web).

The pre-built UI can be configured for the following use cases:
- One tenant configured per IAP resource
- Project level non-tenant per IAP resource.
- Multiple tenants per IAP resource
- One sign-in page hosted for multiple IAP resources.

```javascript
// Import GCIP/Firebase and FirebaseUI dependencies.
// These are installed with npm install.
import * as firebase from 'firebase/app';
import 'firebase/auth';
import * as firebaseui from 'firebaseui';

// Import GCIP/IAP module (using local build).
import * as ciap from 'gcip-iap';

// The project configuration.
const configs = {
  // Configuration for project identified by API key API_KEY1.
  API_KEY1: {
    authDomain: 'project-id1.firebaseapp.com',
    // Decide whether to ask user for identifier to figure out
    // what tenant to select or whether to present all the tenants to select from.
    displayMode: 'optionFirst', // Or identifierFirst
    // The terms of service URL and privacy policy URL for the page
    // where the user select tenant or enter email for tenant/provider
    // matching.
    tosUrl: 'http://localhost/tos',
    privacyPolicyUrl: 'http://localhost/privacypolicy',
    callbacks: {
      // The callback to trigger when the selection tenant page
      // or enter email for tenant matching page is shown.
      selectProviderUiShown: () => {
        // Show title and additional display info.
      },
      // The callback to trigger when the sign-in page
      // is shown.
      signInUiShown: (tenantId) => {
        // Show tenant title and additional display info.
      },
      beforeSignInSuccess: (user) => {
        // Do additional processing on user before sign-in is
        // complete.
        return Promise.resolve(user);
      }
    },
    tenants: {
      // Tenant configuration for tenant ID tenantId1.
      tenantId1: {
        // Display name, button color and icon URL of the
        // tenant selection button. Only needed if you are
        // using the option first option.
        displayName: 'ACME',
        buttonColor: '#2F2F2F',
        iconUrl: '<icon-url-of-sign-in-button>',
         // Sign-in providers enabled for tenantId1.
        signInOptions: [
          // Microsoft sign-in.
          {
            provider: 'google.com',
            providerName: 'Microsoft',
            buttonColor: '#2F2F2F',
            iconUrl: '<icon-url-of-sign-in-button>',
            loginHintKey: 'login_hint'
          },
          // Email/password sign-in.
          {
            provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
            // Do not require display name on sign up.
            requireDisplayName: false
          },
          // SAML provider. (multiple SAML providers can be passed)
          {
            provider: 'saml.my-provider1',
            providerName: 'SAML provider',
            buttonColor: '#4666FF',
            iconUrl: 'https://www.example.com/photos/my_idp/saml.png'
          },
        ],
        // If there is only one sign-in provider eligible for the user,
        // whether to show the provider selection page.
        immediateFederatedRedirect: true,
        signInFlow: 'redirect', // Or popup
        // The terms of service URL and privacy policy URL for the sign-in page
        // specific to each tenant.
        tosUrl: 'http://localhost/tenant1/tos',
        privacyPolicyUrl: 'http://localhost/tenant1/privacypolicy'
      },
      // Tenant configuration for tenant ID tenantId2.
      tenantId2: {
        displayName: 'OCP',
        buttonColor: '#2F2F2F',
        iconUrl: '<icon-url-of-sign-in-button>',
        // Tenant2 supports a SAML, OIDC and Email/password sign-in.
        signInOptions: [
          // Email/password sign-in.
          {
            provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
            // Do not require display name on sign up.
            requireDisplayName: false
          },
          // SAML provider. (multiple SAML providers can be passed)
          {
            provider: 'saml.my-provider2',
            providerName: 'SAML provider',
            buttonColor: '#4666FF',
            iconUrl: 'https://www.example.com/photos/my_idp/saml.png'
          },
          // OIDC provider. (multiple OIDC providers can be passed)
          {
            provider: 'oidc.my-provider1',
            providerName: 'OIDC provider',
            buttonColor: '#4666FF',
            iconUrl: 'https://www.example.com/photos/my_idp/oidc.png'
          },
        ],
      },
    },
  },
  // Configuration for project identified by API key API_KEY2.
  // This is useful in case the same URL is used for multiple projects.
  API_KEY2: {
    authDomain: 'project-id2.firebaseapp.com',
    displayMode: 'optionFirst',
    tosUrl: 'http://localhost/tos',
    privacyPolicyUrl: 'http://localhost/privacypolicy',
    callbacks: {
      // The callback to trigger when the selection tenant page
      // or enter email for tenant matching page is shown.
      selectProviderUiShown: () => {
        // Show title and additional display info.
      },
      // The callback to trigger when the sign-in page
      // is shown.
      signInUiShown: (tenantId) => {
        // Show tenant title and additional display info.
      },
      beforeSignInSuccess: (user) => {
        // Do additional processing on user before sign-in is
        // complete.
        return Promise.resolve(user);
      }
    },
    tenants: {
      // For project level IdPs, _ is used as an identifier.
      _: {
        // ...
      },
    }
  },
};

// This will handle the underlying handshake for sign-in, sign-out,
// token refresh, safe redirect to callback URL, etc.
const handler = new firebaseui.auth.FirebaseUiHandler(
    '#firebaseui-auth-container', configs);
const ciapInstance = new ciap.Authentication(handler);
ciapInstance.start();
```

## Sample App

Please refer to the sample sign-in page in the [sample folder](sample/)
for a more in-depth example, showcasing how a GAE app can be gated by
IAP with GCIP authenticated users, for both custom authentication UI and
using pre-built UI with FirebaseUI.

The sample includes:
- [The GAE Node.js app gated by IAP](sample/app)
- [A sample sign-in page built with Angular](sample/authui):
  - Illustrating how to build your own custom authentication UI
  - Using pre-built UI with FirebaseUI
- [A sample sign-in page built with ReactJS](sample/authui-react):
  - Illustrating how to build your own custom authentication UI
  - Using pre-built UI with FirebaseUI

## Developer Setup

Before you begin, you need to follow the steps to configure IAP and GCIP.

To set up a development environment to run the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

Refer to the README files in each samples to build, run and deploy the apps.
