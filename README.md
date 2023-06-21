# IAP External Identities Support with Identity Platform

[Cloud Identity-Aware Proxy (Cloud IAP)](https://cloud.google.com/iap/)
controls access to your cloud applications and VMs running on Google Cloud Platform (GCP).
Cloud IAP verifies user identity and the context of the request to determine if a user
should be allowed to access an application or a VM.

[Google Cloud's Identity Platform (GCIP)]((https://cloud.google.com/identity-platform/))
aims to provide Developers with Google-grade Authentication and Security for their
applications, services, APIs, or anything else that requires identity and authentication.

By default, IAP uses Google identities and Cloud IAM. External identities can be used
with IAP by leveraging Identity Platform. This allows the end users to do authentication
using any identity and identity provider that GCIP supports. This means that developers
will be able to use IdPs that are supported by GCIP (SAML, OIDC, social etc)
to authenticate users.

To use
[external identities with IAP](https://cloud.google.com/iap/docs/external-identities),
your app needs a page for authenticating users. IAP will redirect any unauthenticated
requests to this page.

`gcip-iap` NPM module implements the protocol used to integrate
GCIP (Google Cloud's Identity Platform) for authenticating external identities
with IAP (Identity Aware Proxy).

`iap-gcip-web-toolkit` repository provides quick-start samples demonstrating how
to integrate a GCIP authentication UI with a [GAE application](sample/app/README.md)
gated with Cloud IAP.

Sample authentication UI pages are provided using:
- [Single Federated Provider Using FirebaseUI](sample/authui-firebaseui/README.md)
- [Angular framework](sample/authui/README.md)
- [ReactJS framework](sample/authui-react/README.md)

## Table of Contents

1. [Overview](#overview)
1. [Create an Authentication UI with FirebaseUI](#create-an-authentication-ui-with-firebaseui)
1. [Create your own Custom Authentication UI](#create-your-own-custom-authentication-ui)
1. [Sample App](#sample-app)
1. [Sample Authentication Pages](#sample-authentication-pages)

## Overview

In order to use
[external identities with IAP](https://cloud.google.com/iap/docs/external-identities),
an authentication page needs to be hosted to handle authentication, tenant
selection, token refreshes, sign-out and all authentication related operations.
This page can be hosted anywhere and the same page can be shared for multiple
IAP resources or GCP projects.

The `gcip-iap` NPM module is provided to abstract the underlying communication
between GCIP and IAP on that authentication page. This will expose callbacks
for UI and authentication related logic.
You will be able to build your own authentication UI on top of this via
these callbacks using the GCIP JS library. You can also use the pre-built
[FirebaseUI](https://github.com/firebase/firebaseui-web)
library as your authentication UI.

This will allow you to use all GCIP supported external providers such as:
- Email/password
- OAuth based providers (Google, Facebook, Twitter, GitHub, Microsoft, Apple,
  LinkedIn, etc.)
- SAML based identity providers
- OIDC based identity providers
- Phone number authentication (not supported for multi-tenancy)
- Custom authentication (not supported for multi-tenancy)
- Anonymous sign-in (not supported for multi-tenancy)

Learn more on how to
[create an authentication UI with FirebaseUI](### Create an Authentication UI with FirebaseUI)
or
[create your own custom authentication UI](### Create your own Custom Authentication UI).

## Create an Authentication UI with FirebaseUI

[FirebaseUI](https://github.com/firebase/firebaseui-web), an open-source
JavaScript library provides simple, customizable elements that reduce
boilerplate code when building the authentication UI. It includes flows a wide
range of identity providers, including username/password, OAuth, SAML, OIDC, and
more.

FirebaseUI makes it easy to build an authentication page for using external
identities with IAP by providing an implementation of the
`AuthenticationHandler` required by the `gcip-iap` module.

FirebaseUI can be configured for the following use cases:
- IAP resource configured with
  [no tenants](https://cloud.google.com/iap/docs/external-identities#no_tenants).
- IAP resource configured with a
  [single tenant](https://cloud.google.com/iap/docs/external-identities#one_tenant_per_resource).
- IAP resource configured with
  [multiple tenants](https://cloud.google.com/iap/docs/external-identities#multiple_tenants_per_resource).

The UI provides the following additional capabilities:
- Ability to re-use the same hosted authentication page for multiple IAP resources.
- Ability to re-use the same hosted authentication page for multiple GCP projects.
- Ability to act as a proxy between the IAP resource and the IdP. This is commonly
  used for an IAP resource configured with a single federated provider where the
  user is redirected to the IdP directly without showing an intermediate UI or
  requiring any additional user interaction.

With `FirebaseUI`, a configuration object needs to be provided in order to render
authentication UI as required. Additional customizations can be done via CSS
overrides or via provided callbacks.

Starting with version v1.0.0, `gcip-iap` requires the `firebase` V9 peer dependency or greater.
No additional changes are needed beyond updating the import mechanism for `firebase` V9:

```javascript
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// The rest of the code is the same.
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';
```

See the Firebase [upgrade guide](https://firebase.google.com/docs/web/modular-upgrade) for more information.
For integrations with FirebaseUI, `firebaseui` V6 or greater would be required.

`firebaseui` import remains the same:

```javascript
import * as firebaseui from 'firebaseui';
```

The following snippet demonstrates using a shared authentication page for
2 project configurations keyed by their respective API keys. Snippet below is
using gcip-iap v1.0.0 requiring `firebase` V9 and `firebaseui` V6.

```javascript
// Import GCIP/Firebase and FirebaseUI dependencies.
// These are installed with npm install.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import * as firebaseui from 'firebaseui';

// Import GCIP/IAP module.
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
      selectTenantUiShown: () => {
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
            provider: EmailAuthProvider.PROVIDER_ID,
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
            provider: EmailAuthProvider.PROVIDER_ID,
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
      selectTenantUiShown: () => {
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
// token refreshes, safe redirect to callback URL, etc.
const handler = new firebaseui.auth.FirebaseUiHandler(
    '#firebaseui-auth-container', configs);
const ciapInstance = new ciap.Authentication(handler);
ciapInstance.start();
```

For a more comprehensive documentation, refer to the
[`FirebaseUI`](https://github.com/firebase/firebaseui-web/tree/master/firebaseuihandler/README.md)
documentation.

## Create your own Custom Authentication UI

To use external identities with IAP, your app needs a page that handles
authentication-related operations such as tenant selection, user authentication,
token refreshes, sign-out, etc.

The `gcip-iap` library defines an interface `AuthenticationHandler` that can be
implemented to handle UI customizations for the above operations. If you don't
need a fully customizable UI, consider
[using FirebaseUI](### Create an Authentication UI with FirebaseUI) instead to
simplify your code.

### Installing the gcip-iap library

The `gcip-iap` NPM module abstracts the communications between your application,
IAP, and Identity Platform.

Using the library is strongly recommended. It allows you to customize the entire
authentication flow without worrying about the underlying exchanges between the
UI and IAP.

Include the library as a dependency like this, if you are using gcip-iap v0.1.4
or less:

```javascript
// Import Firebase/GCIP dependencies. These are installed on npm install.
import firebase from 'firebase/app';
import 'firebase/auth';
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';
```

If you are migrating to gcip-iap v1.0.0, refer to above
[create your own custom authentication UI](### Create your own Custom Authentication UI)
for more details.

### Implementing AuthenticationHandler

The `gcip-iap` module defines an interface named `AuthenticationHandler`.
The library automatically calls its methods at the appropriate time to handle
authentication. The interface looks like this:

```typescript
interface AuthenticationHandler {
  languageCode?: string | null;
  getAuth(apiKey: string, tenantId: string | null): FirebaseAuth;
  startSignIn(auth: FirebaseAuth, match?: SelectedTenantInfo): Promise<UserCredential>;
  selectTenant?(projectConfig: ProjectConfig, tenantIds: string[]): Promise<SelectedTenantInfo>;
  completeSignOut(): Promise<void>;
  processUser?(user: User): Promise<User>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
  handleError?(error: Error | CIAPError): void;
}
```

When building your own custom authentication UI, you will need to implement
the `AuthenticationHandler` interface, and pass an instance of that to
`Authentication` constructor:

```javascript
import * as ciap from 'gcip-iap';
// Implement interface AuthenticationHandler.
// const authHandlerImplementation = ....
const ciapInstance = new ciap.Authentication(authHandlerImplementation);
ciapInstance.start();
```

The sections below provide additional information on how to build each method.

#### Selecting a tenant

The first step to authenticating a user is determining a tenant.

To choose a tenant, the library invokes the `selectTenant()` callback.
You can opt to select tenant programmatically, or display a UI so the user
can select one themselves.

This method is not required when no tenant or only a single tenant is associated
with the IAP resource.

This example demonstrates how to pick the best matching tenant programmatically
by checking the original URL the user was visiting.

```javascript
// Select tenant programmatically.
selectTenant(projectConfig, tenantIds) {
  return new Promise((resolve, reject) => {
    // Show UI to select the tenant.
    auth.getOriginalURL()
      .then((originalUrl) => {
        resolve({
          tenantId: getMatchingTenantBasedOnVisitedUrl(originalUrl),
          // If associated provider IDs can also be determined,
          // populate this list.
          providerIds: [],
        });
      })
      .catch(reject);
  });
}
```

#### Getting the Auth object

Once you have a tenant, you need a way of obtaining an `Auth` object.
Implement the `getAuth()` callback to return an
[`Auth`](https://firebase.google.com/docs/reference/js/auth)
instance corresponding to the API key and tenant ID provided.
If no tenant ID is provided, it should use project-level identity providers
instead.

```javascript
getAuth(apiKey, tenantId) {
  let auth = null;
  // Make sure the expected API key is being used.
  if (apiKey !== expectedApiKey) {
    throw new Error('Invalid project!');
  }
  try {
    auth = firebase.app(tenantId || undefined).auth();
    // Tenant ID should be already set on initialization below.
  } catch (e) {
    // Use different App names for every tenant. This makes it possible to have
    // multiple users signed in at the same time (one per tenant).
    const app = firebase.initializeApp(this.config, tenantId || '[DEFAULT]');
    auth = app.auth();
    // Set the tenant ID on the Auth instance.
    auth.tenantId = tenantId || null;
  }
  return auth;
}
```

#### Signing users in

To handle sign in, implement the `startSignIn()` callback. It should display
a UI for the user to authenticate, and then return a
[`UserCredential`](https://firebase.google.com/docs/reference/js/auth.usercredential)
for the signed in user on completion.

This example demonstrates how to sign in a user with a SAML provider using a
popup or a redirect via the GCIP web SDK.

```javascript
startSignIn(auth, selectedTenantInfo) {
  // Show UI to sign-in or sign-up a user.
  return new Promise((resolve, reject) => {
    // Provide user multiple buttons to sign-in.
    // For example sign-in with popup using a SAML provider.
    // The method of sign in may have already been determined from the
    // selectedTenantInfo object.
    const provider = new SAMLAuthProvider('saml.myProvider');
    auth.signInWithPopup(provider)
      .then((userCredential) => {
        resolve(userCredential);
      })
      .catch((error) => {
        // Show error message.
       });
    // Using redirect flow. When the page redirects back and sign-in completes,
    // ciap will detect the result and complete sign-in without any additional
    // action.
    auth.signInWithRedirect(provider);
  });
}
```

#### Signing users out

In some cases, you may want to allow users to sign out from all current
sessions that share the same authentication URL.
In some case where a user signs out from all tenants associated with a
sign-in page, the `completeSignOut()` callback needs to be implemented
to display a message indicating the user logged out successfully.
Otherwise, a blank page will appear at the end of the flow.

For a more comprehensive documentation of the API, refer to the official
Google Cloud documentation on
[creating a custom authentication UI for IAP external identities](https://cloud.google.com/iap/docs/create-custom-auth-ui).

#### Processing a user

The optional `processUser()` method allows you to modify a signed in user
before redirecting back to the IAP resource. This might be used to link to
additional providers, update the user's profile, ask user for additiona data
after registration, etc.

In the following example, the user was previously signed in using
`signInWithRedirect`. On redirect back to the authentication page after
completing sign in with the IdP, `getRedirectResult()` may be called
to retrieve additional IdP profile information or OAuth tokens
before completing sign-in and redirecting back to IAP.

```javascript
processUser(user) {
  return lastAuthUsed.getRedirectResult().then(function(result) {
    // Save additional data, or ask user for additional profile information
    // to store in database, etc.
    if (result) {
      // Save result.additionalUserInfo.
      // Save result.credential.accessToken for OAuth provider, etc.
    }
    // Return the user.
    return user;
  });
}
```

#### Displaying a progress UI

Implement the optional `showProgressBar()` and `hideProgressBar()` callbacks
to display a custom progress UI to the user whenever the `gcip-iap` module is
making long-running network tasks.

#### Handling errors

`handleError()` is an optional callback for error handling. Implement it to
display error messages to users, or attempt to recover from certain errors
(such as network timeout).

In the following example, a retry button may be shown to the end user to
recover from a network error when the device goes offline while processing
the authentication operation.

```javascript
handleError(error) {
  showAlert({
    code: error.code,
    message: error.message,
    // Whether to show the retry button. This is only available if the error is
    // recoverable via retrial.
    retry: !!error.retry,
  });
  // When user clicks retry, call error.retry();
  $('.alert-link').on('click', (e) => {
    error.retry();
    e.preventDefault();
    return false;
  });
}
```

### Type definitions for gcip-iap

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
  selectTenant?(projectConfig: ProjectConfig, tenantIds: string[]): Promise<SelectedTenantInfo>;
  completeSignOut(): Promise<void>;
  processUser?(user: User): Promise<User>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
  handleError?(error: Error | CIAPError): void;
}
```

## Sample App

Refer to the [sample folder](sample/) for a more in-depth example,
showcasing how a GAE app can be gated by IAP with GCIP authenticated users.
The sample app can be used with any authentication page, whether it is custom
built or built with FirebaseUI.

The sample includes:
- [A GAE Node.js app gated by IAP](sample/app)

## Sample Authentication Pages

Multiple sample codes for building and deploying authentication pages for common
use cases and in various JavaScript frameworks are provided:

- [Proxy for single federated provider using FirebaseUI](sample/authui-firebaseui)
  - Illustrating how to build an authentication page to sign in to a single
    federated IdP (eg. Facebook) on unauthenticated user access to an IAP
    resource, using FirebaseUI.
- [Sample authentication page built with Angular](sample/authui):
  - Illustrating how to build your own custom authentication UI.
  - Using pre-built UI with FirebaseUI.
- [Sample authentication page built with ReactJS](sample/authui-react):
  - Illustrating how to build your own custom authentication UI.
  - Using pre-built UI with FirebaseUI.

