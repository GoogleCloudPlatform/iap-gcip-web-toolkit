# Hosted Authentication UI with Cloud Run

IAP uses [Cloud Run](https://cloud.google.com/run/) to host the authentication
UI. Cloud Run provides a managed compute platform that automatically scales
stateless containers.

Hosting the authentication UI with Cloud Run comes with the following benefits:

- Ability to automatically build and deploy the hosted authentication UI with
  enabled providers and default settings from the Cloud Console.
- Low friction, quick and easy solution to host the UI. Instead of dealing with
  the complexities of building and understanding the underlying
  authentication/security principles needed to build the UI, developers can
  instead focus on their application logic.
- Ability to quickly test and prototype external identities integration before
  building a more sophisticated custom authentication UI.
- Leverages all of Cloud Run's existing capabilities for hosting the
  authentication UI.
- Provides the ability to customize authentication UI domain, eg.
  `auth.example.com` instead of `servicename-vb74jk74ga-uc.a.run.app`
- Basic and advanced customization options of the UI via a configuration file.
  This includes UI title and logo customization, IdP buttons, tenant selection
  buttons, terms of service and privacy policy URL and other custom CSS
  overrides.

## Setup

1. Open the [IAP page](https://console.cloud.google.com/security/iap) in the
   Cloud Console.
2. Select the same project that you configured Identity Platform with.
3. Select the **HTTP Resources** tab.
4. Locate the App Engine app or Compute Engine service you want to restrict
   access to using IAP.
5. Toggle the switch in the IAP column to **On**.
6. In the side panel, click **Start** in the box labeled
   **Use external identities for authorization**.
7. Confirm your selection.
8. In the Identity Platform side panel:
  - Select the option to **Host a login page for me**.
  - Select the GCP region where the Cloud Run service will be served from and
    confirm selection.
  - This will start the login page creation by creating a new Cloud Run service
    and deploying it. It will also add the Cloud Run provisioned URL (eg.
    `servicename-vb74jk74ga-uc.a.run.app`) as an authorized domain with
    Identity Platform.
  - The process will take around a minute. Click **Finish** after the login
    page is created.
  - In the Identity Platform side panel, select whether to use
    **project providers** or **tenants**.
  - Check the boxes of the providers or tenants to enable. Select
    **Configure providers** if you need to modify your providers or tenants.
    You have to complete this step and finish saving the IAP configuration
    before you can start using the authentication UI for sign-in or
    administrative purposes (UI customization).
9. Click **Save**.

IAP is now configured to authenticate users with external identities and your
default authentication UI should be already deployed and ready for use.

You have the ability to customize the UI for that page by visiting the
`/admin` path of your hosted UI.

## Customize the authentication page

You have the ability to provide additional customization to the login page.

This includes customizing the tenant selection page for a multi-tenant
resource:
- Select tenant page title: By default, populated with default project ID.
- Select tenant logo: This is not available by default.
- Tenant button icon: By default, populated with some placeholder generic icon.
- Tenant button full label: When not provided, the tenant display name is used.
- Tenant button display name: By default, populated with a tenant's display name.
- Tenant button color: By default, populated with a fixed color.
- Terms of service URL: Not available by default.
- Privacy policy URL: Not available by default.

You can also customize the tenant sign-in screen for every selected tenant:
- Sign-in UI title: By default, populated with the default project ID for
  project-level IdPs, or tenant display name for tenant level IdPs.
- Sign-in UI logo: This is not available by default.
- IdP button icon: By default, populated with placeholder icons.
- IdP button full label: When not provided, the IdP display name, 
  as set in the Cloud Console, is used.
- IdP button display name: By default, populated with the display name
  as set in the Cloud Console for the corresponding provider.
- IdP button color: By default, populated with a default color.
- Terms of service URL for a specific tenant: Not available by default.
- Privacy policy URL for a specific tenant: Not available by default.

In order to customize the configuration, an admin's personal Google OAuth
access token is needed. In this case, admins are users with read/write
permission to GCS buckets for that project. Only these users can make use
of this panel.
The hosted UI facilitates retrieval of that and provides a UI for admins to
customize the configuration. In order to do so, the Google identity provider
should be enabled at the Identity Platform project-level IdPs in order to
facilitate retrieval of the Google Admin user's OAuth access tokens for
customization of the sign-in UI configuration. This will require the creation
of a Google OAuth client. Normally, when sensitive Google OAuth scopes are
requested (eg. to read and write to a GCS bucket), a warning is displayed to
the end user on sign-in. Normally to bypass that, an app review process is
required. However, Google exempts this requirement for users in the same
G Suite domain if the app is associated with a Cloud Organization that all of
your users belong to. So as long as users within the same organization with
the read/write permission to GCS are using this panel, they should be able to
do so without seeing any warning.

After the Google provider is enabled, visit the `/admin` path of the deployed
Cloud Run service's authentication URL
(`https://servicename-xyz-uc.a.run.app/admin`). You will be redirected to sign
in with Google. An authorized admin with permissions to read and write to GCS
is needed to customize the configuration.

On successful authorization, an editor with the default JSON configuration is
presented. You have the ability to customize the configuration and then apply
these changes through one of these 2 means:

- Directly write the configuration to a GCS bucket by clicking **Save**.
- Copy the configuration by clicking the copy icon in the top right corner of
  the editor and then redeploying a revision of the same Cloud Run service with
  the environment variable `UI_CONFIG` set to the copied content. Check the
  section below on how to deploy a revision of the Cloud Run service.

Each session lasts an hour. If the session duration is exceeded, a new OAuth
access token is required via re-authentication. This can be done by clicking
the `Reauthenticate` button presented on session expiration.

### JSON Configuration

The authentication UI behavior and styling is determined via a JSON file. This
file can be configured programmatically or via the Admin UI panel available via
`/admin` path.

The following sample illustrates the different options available in the
configuration file.

```javascript
{
  "AIzaSyC5DtmRUR...":{
    "authDomain": "awesomeco.firebaseapp.com",
    "displayMode": "optionFirst",
    "selectTenantUiTitle": "Awesome Company Portal",
    "selectTenantUiLogo": "https://awesome.com/abcd/logo.png",
    "styleUrl": "https://awesome.com/abcd/overrides/stylesheet.css",
    "tosUrl": "https://awesome.com/abcd/tos.html",
    "privacyPolicyUrl": "https://awesome.com/abcd/privacypolicy.html",
    "tenants":{
      "tenant-a-id":{
        "fullLabel": "Company A Portal",
        "displayName": "Company A",
        "iconUrl":"https://companya.com/img/icon.png",
        "logoUrl": "https://companya.com/img/logo.png",
        "buttonColor": "#007bff",
        "signInOptions":[
          "password",
          "facebook.com",
          "google.com",
          "microsoft.com",
          {
            "provider": "saml.okta-cicp-app",
            "providerName": "Corp Account",
            "buttonColor": "#ff0000",
            "iconUrl": "https://companya.com/abcd/icon-1.png"
          },
          {
            "provider": "oidc.okta-oidc",
            "providerName": "Contractor Account",
            "buttonColor": "#00ff00",
            "iconUrl": "https://companya.com/abcd/icon-2.png"
          }
        ],
        "tosUrl": "https://companya.com/abcd/tos.html",
        "privacyPolicyUrl": "https://companya.com/abcd/privacypolicy.html"
      },
      "tenant-b-id":{
        "fullLabel": "Company B Portal",
        "displayName": "Company B",
        "iconUrl": "https://companyb.com/img/icon.png",
        "logoUrl": "https://companyb.com/img/logo.png",
        "buttonColor": "#007bff",
        "immediateFederatedRedirect": true,
        "signInOptions":[
          {
            "provider": "saml.okta-bla-app",
            "providerName": "Corp Account",
            "buttonColor": "#0000ff",
            "iconUrl": "https://companyb.com/abcd/icon.png"
          }
        ],
        "tosUrl": "https://companyb.com/abcd/tos.html",
        "privacyPolicyUrl": "https://companyb.com/abcd/privacypolicy.html"
      },
      "tenant-c-id":{
        "fullLabel": "Company C Portal",
        "displayName": "Company C",
        "iconUrl": "https://companyc.com/img/icon.png",
        "logoUrl": "https://companyc.com/img/logo.png",
        "buttonColor": "#007bff",
        "signInOptions":[
          {
            "provider": "password",
            "requireDisplayName": false,
            "disableSignUp": {
              "status": true,
              "adminEmail": "admin@example.com",
              "helpLink": "https://www.example.com/trouble_signing_in"
            }
          }
        ],
        "tosUrl": "https://companyc.com/abcd/tos.html",
        "privacyPolicyUrl": "https://companyc.com/abcd/privacypolicy.html"
      },
      "tenant-d-id":{
        "fullLabel": "Company D Portal",
        "displayName": "Company D",
        "iconUrl": "https://companyd.com/img/icon.png",
        "logoUrl": "https://companyd.com/img/logo.png",
        "buttonColor": "#007bff",
        "signInOptions":[
          {
            "provider": "phone",
            "recaptchaParameters": {
              "size": "invisible",
              "badge": "bottomleft"
            },
            "whitelistedCountries": ["US", "+44"],
            "defaultCountry": "GB"
          }
        ]
        "tosUrl": "https://companyd.com/abcd/tos.html",
        "privacyPolicyUrl": "https://companyd.com/abcd/privacypolicy.html"
      }
    }
  }
}
```

The hosted sign-in UI is powered by FirebaseUI. As a result, it inherits most
of the
[customization options](https://cloud.google.com/iap/docs/using-firebaseui)
available there.

Additional new fields include the following:
- `[API_KEY].selectTenantUiTitle`: The tenant selection screen title. By
  default, this is the current GCP project ID.
- `[API_KEY].selectTenantUiLogo`: The tenant selection screen logo. By
  default, no logo is provided.
- `[API_KEY].styleUrl`: The CSS stylesheet used to override the default CSS
  styles. The hosted UI uses a superset of the FirebaseUI-web CSS styles. By
  default, no custom stylesheet is provided. The CSS styles used are defined in
  the following order of inclusion:
  - [MDL library styles](https://github.com/firebase/firebaseui-web/blob/master/stylesheet/mdl.scss)
  - [FirebaseUI](https://github.com/firebase/firebaseui-web/blob/master/stylesheet/firebase-ui.css)
  - [Hosted UI styles](./public/style.css)
  Here is an example of a CSS file to override existing styles:
  ```css
  /** Change header title style. */
  .heading-center {
    color: #7181a5;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 20px;
    font-weight: bold;
  }

  /** Use round edged borders for container. */
  .main-container {
    border-radius: 5px;
  }

  /** Change page background color. */
  body{
    background-color: #f8f9fa;
  }
  ```
  The file will need to be uploaded to an HTTPS enabled site.
- `[API_key].tenants[TENANT_ID].logoUrl`: The tenant logo URL. This is
  displayed after the user selects the tenant and is presented with the IdPs
  associated with the tenant. By default, no logo URL is provided.

All URL assets provided must be HTTPS URL. You can use GCS to upload these
files and make them publicly available and then use their
[associated URLs](https://cloud.google.com/storage/docs/request-endpoints) in
the customized configuration file.

The **UiConfig** JSON schema is documented below.

```typescript
interface SignInOption {
  // The provider identifier: eg. facebook.com, saml.my-saml-provider-id, oidc-my-oidc-provider-id
  provider: string;
  // The provider label name (SAML and OIDC).
  providerName?: string;
  // For identifier first flows, this is the user email domain: tenant1.com
  hd?: string;
  // The SAML / OIDC button color, eg. "#ff00ff"
  buttonColor?: string;
  // The IdP button icon URL in the form of an HTTPS URL.
  iconUrl?: string;
  // Additional OAuth scopes to request for OAuth providers.
  scopes?: string[];
  // Additional custom OAuth parameters to set on sign-in.
  // For example, setting {auth_type: 'reauthenticate'} will
  // require password re-entry on Facebook re-authentication.
  customParameters?: {[key: string]: any};
  // For identifier first flow, providing the login hint key makes it possible to pass the email to the IdP
  // to sign in with. This is useful when a user has multiple accounts with the IdP. For many providers,
  // this is "login_hint".
  loginHintKey?: string;
  // Whether to require display name when creating an email and password account. This is true by
  // default.
  requireDisplayName?: boolean;
  // reCAPTCHA customization for phone providers.
  recaptchaParameters?: {
    // The type of the reCAPTCHA ("audio" or "image")
    type?: string;
    // Whether the reCAPTCHA is invisible or not ("invisible", "normal", "compact").
    size?: string;
    // For invisible reCAPTCHAs, this defines how the invisible reCAPTCHA badge is displayed.
    // eg. "bottomleft", "bottomright" or "inline".
    badge?: string;
  };
  // Sets the default country, eg. (GB) for the United Kingdom for phone providers.
  defaultCountry?: string;
  // Sets the whitelisted countries for phone providers. Accepts either ISO (alpha-2) or E164 formatted
  // country codes. Example: ['US', '+44']
  whitelistedCountries?: string[];
  // Sets the blacklisted countries for phone providers. Accepts either ISO (alpha-2) or E164 formatted
  // country codes. Example: ['US', '+44']
  blacklistedCountries?: string[];
  // Sets the disableSignUp config for Email Password/Link sign in method.
  disableSignUp?: {
    // Whether to disable user from signing up with email providers (email/password or email link).
    status: boolean;
    // The optional site administrator email to contact for access when sign up is disabled.
    // eg. `admin@example.com`.
    adminEmail?: string;
    // The optional help link to provide information on how to get access to the site when sign up
    // is disabled.
    // eg. `https://www.example.com/trouble_signing_in`.
    helpLink?: string;
  }
}
}

interface ExtendedTenantUiConfig {
  // The tenant full label. This is used for the "sign in with tenant" button label.
  // When not provided, "Sign in to ${displayName}" is used as the full label.
  fullLabel?: string;
  // The tenant display name. This is used for the "sign in with tenant" button label.
  // By default, the configured tenant display name is used. For project-level IdPs, this is set to the
  // GCP project ID.
  displayName: string;
  // The tenant icon URL in the form of an HTTPS URL.
  // This is used for the "sign in with tenant" button icon URL.
  // By default, a placeholder icon is used.
  iconUrl: string;
  // The tenant logo URL in the form of an HTTPS URL.
  // This is displayed after the user selects the tenant and is presented with
  // the IdPs associated with the tenant.
  // By default, no logo URL is provided.
  logoUrl?: string;
  // The tenant button color. This is used for the "sign in with tenant" button.
  // A default color is used for all tenants.
  buttonColor: string;
  // The sign-in options associated with the tenant. This is auto-populated using the enabled providers
  // for the current tenant.
  signInOptions: (SignInOption | string)[];
  // The terms of service URL associated with the current tenant in the form of an HTTPS URL.
  // By default, this is empty.
  tosUrl?: string;
  // The privacy policy URL associated with the current tenant in the form of an HTTPS URL.
  // By default, this is empty.
  privacyPolicyUrl?: string;
  // For single providers with signInFlow set to 'redirect', setting this to 'true' will
  // result with a redirect to the IdP without user interaction.
  // By default, this is set to true.
  immediateFederatedRedirect?: boolean;
  // Whether to use popup or redirect flows for federated providers.
  // By default, redirect flows are used.
  signInFlow?: 'redirect' | 'popup';
}

interface UiConfig {
  // In this case the key is the API key for the current GCIP project.
  [key: string]: {
    // This is needed for federated flows and is provisioned by GCIP.
    authDomain?: string;
    // The display mode for tenant selection flow. This could be 'optionFirst' or
    // 'identifierFirst', defaults to 'optionFirst'.
    displayMode: string;
    // The tenant selection screen title. By default, this is the current GCP project ID.
    selectTenantUiTitle?: string;
    // The tenant selection screen logo in the form of an HTTPS URL. By default, no logo is provided.
    selectTenantUiLogo?: string;
    // The CSS stylesheet used to override the default CSS styles in the form of an HTTPS URL.
    // The hosted UI uses a superset of the FirebaseUI-web CSS styles.
    // By default, no custom stylesheet is provided.
    styleUrl?: string;
    // The tenants configurations.
    tenants: {
      // Each tenant configuration is keyed by the tenant identifier.
      [key: string]: ExtendedTenantUiConfig;
    };
    // The application terms of service URL in the form of an HTTPS URL. By default, this is empty.
    tosUrl?: string,
    // The application privacy policy URL in the form of an HTTPS URL. By default, this is empty.
    privacyPolicyUrl?: string,
  };
}
```

The default GCS bucket name where the configuration is saved is
`gcip-iap-bucket-${CLOUD_RUN_SERVICE_NAME}-${PROJECT_NUMBER}`. A custom bucket
name can be provided via the `GCS_BUCKET_NAME` environment variable.

If the customized configuration file is accidentally cleared by deleting it
from Cloud Storage or by removing the config environment variable, the Auth UI
will gracefully fall back to the default in-memory settings.

## Authentication UI Endpoints

The following endpoints will be defined in the Auth UI:

- **GET /**: This is the root path which will be set as the authentication URL
  with IAP. It will be used for handling sign-in requests forwarded from IAP.
- **GET /versionz**: This returns the current UI version (making it easier to
  know what version is used in their current build).
- **GET /admin**: This is the admin panel. This can be disabled by deploying a
  revision of the Cloud Run service with the environment variable `ALLOW_ADMIN`
  set to `0` or `false`.

The configuration can also be loaded and saved programmatically via
authenticated admin APIs which require an OAuth access token in the
authorization header with the following OAuth scopes:

- `https://www.googleapis.com/auth/devstorage.read_write`
- `https://www.googleapis.com/auth/cloud-platform`

The authenticated admin APIs:

- **GET /get_admin_config**: Used to load the current customized configuration
  (the default config is returned if not customized).
- **POST /set_admin_config**: Used to save the configuration to GCS. The POST
  body should contain the new updated configuration JSON (content-type set to
  application/json).

This is useful when an IAP resource and its associated GCIP IdPs are
automatically and continuously modified.
All admin APIs can be disabled by deploying a revision of the Cloud Run service
with the environment variable `ALLOW_ADMIN` set to `0` or `false`.

## Authentication UI Environment Variables

The following environment variables can be used to customize the behavior of
the Cloud Run service powering the authentication UI:

- **DEBUG_CONSOLE**: When manually provided (`1` or `true`), this will log all
  network request errors and details. This is useful for debugging and
  reporting issues. Sensitive data will not be logged. This is disabled by
  default.
- **UI_CONFIG**: When manually provided, this will be used as the customized
  Auth UI configuration JSON string. Using this environment variable to store
  the customized config avoids reading and writing to a GCS bucket to load and
  store the configuration. If an invalid configuration is provided, it will be
  ignored and the default or any existing GCS configuration is used instead.
  Use the `/admin` UI to customize the configuration before copying as it will
  validate the data before allowing you to copy it. This minimizes any errors
  in the JSON format.
- **GCS_BUCKET_NAME**: When manually provided, this will override the default
  GCS bucket name for storing. The default bucket name is
  `gcip-iap-bucket-${CLOUD_RUN_SERVICE_NAME}-${PROJECT_NUMBER}`. A custom
  bucket name can be provided via the GCS_BUCKET_NAME environment variable.
  The configuration file is saved in the bucket under the filename
  `config.json`.
- **ALLOW_ADMIN**: Used to disable `/admin` path (by passing `0` or `false`).
  Enabled by default.

## Updating the Cloud Run instance

In many cases, a new revision of the cloud run service used by IAP is required
to be deployed.

To redeploy a new revision of the associated Cloud Run service:

1. Open the Cloud Run page in the Cloud Console.
2. Select the same project that you configured IAP with.
3. Select the Cloud Run service name used for the authentication UI. (This is
   the prefix of the URL, eg:
   `https://${SERVICE_NAME}-${RANDOM_CHARS}-uc.a.run.app`).
4. Click the **EDIT & DEPLOY NEW REVISION** button.
5. Optionally, you can provide updated advanced settings to the revision, or
   add an environment variable by clicking the **VARIABLES & SECRETS** tab.
6. Click **DEPLOY** to deploy the revision. By default this will also divert
   100% of traffic to this new revision unless you unselect the
   **Serve this revision immediately** checkbox.

### Updating settings after deployment

The Auth UI will populate the default settings based on the current snapshot
when the current authentication UI web server is started and first accessed.
If a new tenant is added or removed from an IAP resource, or IdP configurations
are updated (IdP is enabled, disabled or modified), to force all default
configurations used by the Auth UI to synchronize to these changes, a new Cloud
Run revision needs to be deployed.

However, if a customized configuration is saved via GCS or the `UI_CONFIG`
environment variable, the configuration will need to be manually updated via
the `/admin` panel. Redeploying a revision will have no effect in this case.

### Updating to the latest version

It is important to keep updating the Cloud Run service on a regular basis to
pick up the latest bug fixes and security patches.

To alleviate concerns of breaking changes, the hosted UI will ensure backward
compatibility so updates should not be disruptive. Other measures can also be
taken to avoid issues being accidentally introduced. For example, a new
revision can be deployed and traffic can be diverted to it gradually via the
Cloud Run UI so if issues are detected, traffic can be ramped down and
diverted back to the older stable revision.

You can also check the latest UI builds in the [CHANGELOG.md](./CHANGELOG.md)
to keep track of all the hosted UI changes since your UI was deployed. You can
check the current version of your build by navigating to `/versionz`. You can
then look up the changes made since that version.

### Adding environment variables

Anytime an environment variable needs to be added, modified or removed, a new
revision needs to be deployed. This may be needed in the following cases:

- To debug the UI if unexpected authentication UI behavior is being experienced.
  This is done by redeploying the revision with the `DEBUG_CONSOLE` variable
  set to `1` or `true`. Logs are viewable from the Cloud Run service page in
  the **LOGS** tab.
- While customizing the UI configuration. The modified configuration can be
  added as an environment variable `UI_CONFIG`. Use the `/admin` panel to
  modify the configuration. This provides some validation before allowing
  admins the ability to copy the configuration.
- To disable the admin panel after customization. To avoid exposing the
  `/admin` panel or other administrative APIs, a revision can be deployed
  with the environment variable `ALLOW_ADMIN` set to `false` or `0`.

## Advanced

### Customizing Auth UI Domain

The Cloud Run provisioned URL for the Auth UI (eg.
`servicename-6tihbjyvla-uc.a.run.app`) can be customized (`auth.example.com`)
by following these instructions:

- Follow the
  [instructions](https://cloud.google.com/run/docs/mapping-custom-domains) to
  map the custom domain (eg. `auth.example.com`).
- Update the authentication UI URL in the IAP panel for the resource that was
  using it (by replacing the existing domain with the custom domain) and save
  it.
- Add to the allowlist the new domain with Identity Platform in the
  settings &gt; security section and save it.

### Using the same hosted Auth UI for multiple IAP resources

The same Cloud Run service deployed for one IAP resource can be shared among
multiple IAP resources in the same project even if they have different Identity
Platform configurations. This works as follows:

- Enable IAP with one resource and deploy the authentication UI with Cloud Run
  as documented above.
- Enable IAP with another resource. In the authentication URL input, the same
  previous authentication URL (provisioned by Cloud Run) should be entered.
- Since the second resource may have a different Identity Platform configuration
  (different associated tenants / enabled IdPs), a new revision of the Cloud Run
  service will need to be deployed. Redeploying a revision of the instance
  should automatically pick up the additional GCIP settings. Since the default
  configuration is lazy loaded on first authentication UI web server access,
  this step may be not required if the first visit occurs after the second
  resource is configured.

## Contributions

The following instructions illustrate how to make contributions to the
hosted authentication UI used by IAP and how to generate and deploy your own
custom container image build.

### Installation

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 10.0.0)
- npm (should be included with Node.js)
- [Google Cloud SDK](https://cloud.google.com/sdk/) which includes the gcloud
  command line tool.

Download the authentication UI container source code:

```bash
git clone https://github.com/GoogleCloudPlatform/iap-gcip-web-toolkit.git
```

Install the authentication UI container app:

```bash
cd iap-gcip-web-toolkit/authui-container
npm install
```

### Unit tests

To run client side unit tests:

```bash
npm run test:client
```

To run server side unit tests:

```bash
npm run test:server
```

To run all tests without linting:

```bash
npm run test:unit
```

To run all tests with linting:

```bash
npm run test
```

### Generate and deploy locally built container image

To generate the container image locally:

Modify the following 2 fields in `deploy-container.sh`.

```bash
# GCP project ID where the container image will be generated.
PROJECT_ID="<GCP_PROJECT_ID>"
# GCR container image name.
IMG_NAME="<GCR_CONTAINER_IMAGE>"
```

You can now generate the build by running:

`./deploy-container.sh test`

This will generate `gcr.io/${PROJECT_ID}/${IMG_NAME}` which can then be
deployed in a Cloud Run service for testing. Learn more how to
[deploy a prebuilt container](https://cloud.google.com/run/docs/quickstarts/prebuilt-deploy).

Note that the created Cloud Run service should:
- Be fully managed.
- Allow unauthenticated invocations.
- Use the container image above: `gcr.io/${PROJECT_ID}/${IMG_NAME}`.
- Have at least 512MiB memory allocated.

This will generate a URL of the form:
`https://${SERVICE_NAME}-${RANDOM_CHARS}-uc.a.run.app`

This will then need to be replaced as the authentication URL for the GCP
resources protected by IAP external identities in the
[Cloud Console](https://console.cloud.google.com/security/iap).

In addition, the domain `${SERVICE_NAME}-${RANDOM_CHARS}-uc.a.run.app`
should also be whitelisted with Identity Platform in the settings &gt;
security section and saved.
