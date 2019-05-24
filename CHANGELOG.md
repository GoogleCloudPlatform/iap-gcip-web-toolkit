# Unreleased

- [fixed] Improved unauthorized domain error message.

# v0.0.3

- [fixed] Updated `npm run deploy` for sample authui to trigger webpack bundling.
- [changed] Added `promise-polyfill`, `url-polyfill` and `whatwg-fetch` as peer dependencies for `ciap`.
- [changed] Added peer dependency polyfills of `ciap` as `devDependencies` for authui sample app.

# v0.0.2

- [feature] Added the ability to immediately redirect to the provider's site when there is only a single federated provider enabled in FirebaseUI handler.
- [fixed] Improved error code and error message for token expired error.

# v0.0.1

- [fixed] Fixed GAE sample app gcip claim parsing.