
#v0.1.0

gcr.io/gcip-iap/authui@sha256:11a871958769d45544794db8c22af958279817a213717e4f793993cc6433bc99

Launch first version of the Cloud Run Hosted UI for IAP external identities.

#v0.1.1

gcr.io/gcip-iap/authui@sha256:7805cdc257ce5296aaa7ebe7addc16628fc6596a013d82c679b93983d7592a7d

Ensures that GCS bucket names for custom configs meet [bucket name requirements](https://cloud.google.com/storage/docs/naming-buckets#requirements).
This includes trimming characters beyond the 63 character limit and requiring the last character to be a letter or number.

#v0.1.2

gcr.io/gcip-iap/authui@sha256:a7dc58008bb7fb2510cb78c8c834f3b9d6ab9d03919b8c261bcb22e4cc7a848d

Updates `firebaseui` version. The latest update supports customization of IdP buttons like Google, Email, etc. This includes the ability to overwrite the entire button label via `fullLabel` field.

#v0.1.3

gcr.io/gcip-iap/authui@sha256:3e2c606a2cce4944c9f7e816dacc968e3306d0a3aea6f14892b9837241497273

Updates `gcip-iap` module dependency to handle browsers with 3P cookies and site data disabled.

#v0.1.4

gcr.io/gcip-iap/authui@sha256:5c3030f22afffba367c3106acb3674bbbee7be826c9b9de0c64e1b26885e64f6

Updates `firebaseui` version. The latest update supports customization of tenant selection buttons. This includes the ability to overwrite the entire button label via `fullLabel` field.

#v0.1.5

gcr.io/gcip-iap/authui@sha256:d74bcbc4ba8797da73bc98f1a2695625eb7df78eb5bb4405213265f8a2350baa

Fixes authui-container support in pre-Chromium Edge and IE 11 browsers.

#v0.1.6

gcr.io/gcip-iap/authui@sha256:b7d58fed82542e39f12ac7d920c61629bde7f8baa3ba7abc5b2def7c16f6cb57

Fixes unexpected fragment parsing when determining selected tenant info.

#v0.1.7

gcr.io/gcip-iap/authui@sha256:362f671689af6b265c8dbd59caf99d06fae1af425758df121f39e8193766d270

Updates `firebaseui`, `firebase` versions and ES6 firebase/app import.

#v0.1.8

gcr.io/gcip-iap/authui@sha256:fa6d5e92351a4683235b5aaf1e126509667954a2ad5afa01b5f73f4e09f41ce0

Updates `gcip-iap` module dependency to `0.1.4`.

#v0.1.9

gcr.io/gcip-iap/authui@sha256:db842770d654782001b7aba24532458fdb9ef9953b70ea2fcd162b2a133abf29

Updates `firebaseui` dependency version to `4.8.0` to support disabling new user sign up in email providers, disabling new user sign up via project settings and blocking functions.

#v0.1.10

gcr.io/gcip-iap/authui@sha256:c9bc65e24793d5f69bfd5bfa3b518defd80ee39ee1a0efedac99b2b2c6ffba07

Fixes GCS file/bucket not found error handling.

#v0.1.11

gcr.io/gcip-iap/authui@sha256:7703925296db259590bae47e7004118d75f1727a132b742e76991a8407755905

Updates `firebaseui` dependency version to `4.8.1` to provide UI support for all identity provider sign up operations when they are restricted by site administrators.

#v0.1.12

gcr.io/gcip-iap/authui@sha256:b87f3da6be2981a4182e6877855aec7c5d6c20c95c457877f2903cc47b27084f

Updates `gcip-iap` module dependency to `1.0.0`, `firebase` module to `9.6.0` and `firebaseui` to `6.0.0`.

#v0.1.13

gcr.io/gcip-iap/authui@sha256:ce274e63d3eb1e9ba526e6530a6ba6c8550ed746cfba2236941d648a31464e44

Use the login page URL as authDomain for Hosted UI to prevent cross origin storage access in signInWithRedirect.

##v1.0.0

gcr.io/gcip-iap/authui@sha256:9d60aa020b50949a8c91fb102813dc5a37887680baebe878a5236996a8691573

Use modular web SDK v9 to refactor IAP SDK.


#v1.0.1

gcr.io/gcip-iap/authui@sha256:27c7908ccc66941a89e4774a858d75d514a0422ab4d9b0600bd41332d9e57bd1

Update the admin UI to use the IAP page URL as the authDomain.


#v1.0.2

gcr.io/gcip-iap/authui@sha256:eca6362af482a523c3d7f889728c8c36e2ebbc394a1a5033666456b2fd2fa8ff

Updated authui-container to use latest IAP SDK.

#v1.0.3

gcr.io/gcip-iap/authui@sha256:ccd62095da439d2685df163eb2ce61ce7d709f7fb88bd98cedf3bcbe5fcfe218

Dependency version bump to fix known vulnerabilities in the older versions
