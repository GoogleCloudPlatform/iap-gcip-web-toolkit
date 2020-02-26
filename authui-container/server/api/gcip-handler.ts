/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AuthenticatedRequestHandler} from './authenticated-request-handler';
import {AccessTokenManager} from './token-manager';
import {ApplicationData} from './metadata-server';

/** Get GCIP config endpoint. */
const GET_GCIP_CONFIG_URL =
    'https://identitytoolkit.googleapis.com/admin/v2/projects/{projectId}/config';
/** Get tenant config endpoint. */
const GET_TENANT_CONFIG_URL =
    'https://identitytoolkit.googleapis.com/v2/projects/{projectId}/tenants/{tenantId}';
/** Get default Idps config endpoint. */
const GET_DEFAULT_IDPS_URL =
   'https://identitytoolkit.googleapis.com/v2/{resourceId}/defaultSupportedIdpConfigs?pageSize={pageSize}';
/** Get SAML Idps config endpoint. */
const GET_SAML_IDPS_URL =
   'https://identitytoolkit.googleapis.com/v2/{resourceId}/inboundSamlConfigs?pageSize={pageSize}';
/** Get OIDC Idps config endpoint. */
const GET_OIDC_IDPS_URL =
   'https://identitytoolkit.googleapis.com/v2/{resourceId}/oauthIdpConfigs?pageSize={pageSize}';
/** Single page size for listing IdPs. */
const PAGE_SIZE = 100;

/** Default error message to show when GCIP config cannot be retrieved. */
export const DEFAULT_ERROR_GET_GCIP_CONFIG = 'Unable to retrieve Identity Platform config.';
/** Default error message to show when tenant config cannot be retrieved. */
export const DEFAULT_ERROR_GET_TENANT_CONFIG = 'Unable to retrieve tenant config.';
/** Default error message to show when default IdPs config cannot be retrieved. */
export const DEFAULT_ERROR_GET_DEFAULT_IDPS_CONFIG = 'Unable to retrieve default IdPs config.';
/** Default error message to show when SAML IdPs cannot be retrieved. */
export const DEFAULT_ERROR_GET_SAML_IDPS_CONFIG = 'Unable to retrieve SAML IdPs config.';
/** Default error message to show when OIDC IdPs cannot be retrieved. */
export const DEFAULT_ERROR_GET_OIDC_IDPS_CONFIG = 'Unable to retrieve OIDC IdPs config.';
/** Network request timeout duration. */
const TIMEOUT_DURATION = 10000;

// List of client GCIP interfaces.
export interface GcipConfig {
  apiKey: string;
  authDomain: string;
}

export interface SignInOption {
  provider: string;
  providerName?: string;
}

export interface TenantUiConfig {
  displayName?: string;
  signInOptions: SignInOption[];
}

// List of backend response interfaces.
export interface Config {
  client?: {
    apiKey?: string;
    firebaseSubdomain?: string;
  };
  signIn?: {
    email?: {
      enabled?: boolean;
      [key: string]: any;
    };
    phoneNumber?: {
      enabled?: boolean;
      [key: string]: any;
    };
  }
  [key: string]: any;
}

export interface Tenant {
  name?: string;
  displayName?: string;
  allowPasswordSignup?: boolean;
  enableEmailLinkSignin?: boolean;
  [key: string]: any;
}

export interface ListDefaultSupportedIdpConfigsResponse {
  defaultSupportedIdpConfigs?: {
    name?: string;
    enabled?: boolean;
    [key: string]: any;
  };
  nextPageToken?: string;
}

export interface ListInboundSamlConfigsResponse {
  inboundSamlConfigs?: {
    name?: string;
    enabled?: boolean;
    displayName?: string;
    [key: string]: any;
  };
  nextPageToken?: string;
}

export interface ListOAuthIdpConfigsResponse {
  oauthIdpConfigs?: {
    name?: string;
    enabled?: boolean;
    displayName?: string;
    [key: string]: any;
  };
  nextPageToken?: string;
}

/**
 * Utility used to make GCIP API calls. This is currently used to build the GCIP config
 * for web UI rendering. It is also used to retrieve the list of enabled IdPs for a
 * GCIP tenant in a format that is compatible with FirebaseUI.
 */
export class GcipHandler {
  private getGcipConfigHandler: AuthenticatedRequestHandler;
  private getDefaultIdpsHandler: AuthenticatedRequestHandler;
  private getSamlIdpsHandler: AuthenticatedRequestHandler;
  private getOidcIdpsHandler: AuthenticatedRequestHandler;
  private getTenantBasicConfigHandler: AuthenticatedRequestHandler;

  /**
   * Instantiates an GCIP handler.
   * @param app The application data.
   * @param accessTokenManager The access token manager.
   */
  constructor(
      private readonly app: ApplicationData,
      private readonly accessTokenManager: AccessTokenManager) {
    this.getGcipConfigHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_GCIP_CONFIG_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.getDefaultIdpsHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_DEFAULT_IDPS_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.getSamlIdpsHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_SAML_IDPS_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.getOidcIdpsHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_OIDC_IDPS_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.getTenantBasicConfigHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_TENANT_CONFIG_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
  }

  /** @return A promise that resolves with the GCIP web config. */
  getGcipConfig(): Promise<GcipConfig> {
    return this.app.getProjectId()
      .then((projectId) => {
        return this.getGcipConfigHandler.send({
          urlParams: {
            projectId,
          },
        }, DEFAULT_ERROR_GET_GCIP_CONFIG);
      })
      .then((httpResponse) => {
        const config: Config = typeof httpResponse.body === 'object' ?
            httpResponse.body : JSON.parse(httpResponse.body);
        if (!config.client || !config.client.apiKey || !config.client.firebaseSubdomain) {
          throw new Error(DEFAULT_ERROR_GET_GCIP_CONFIG);
        }
        return {
          apiKey: config.client.apiKey,
          authDomain: `${config.client.firebaseSubdomain}.firebaseapp.com`,
        };
      });
  }

  /**
   * Retrieves the TenantUiConfig corresponding to the tenant ID provided.
   * @param tenantId The corresponding tenant ID whose TenantUiConfig is to be returned.
   * @return A promise that resolves with the corresponding TenantUiConfig.
   */
  getTenantUiConfig(tenantId: string): Promise<TenantUiConfig> {
    let tenantConfig: TenantUiConfig;
    return this.getEnabledPasswordAndPhoneIdps(tenantId)
      .then((config) => {
        tenantConfig = config;
        return this.getEnabledDefaultIdps(tenantId);
      })
      .then((defaultIdps) => {
        tenantConfig.signInOptions = tenantConfig.signInOptions.concat(defaultIdps);
        return this.getEnabledSamlIdps(tenantId);
      })
      .then((samlIdps) => {
        tenantConfig.signInOptions = tenantConfig.signInOptions.concat(samlIdps);
        return this.getEnabledOidcIdps(tenantId);
      })
      .then((oidcIdps) => {
        tenantConfig.signInOptions = tenantConfig.signInOptions.concat(oidcIdps);
        return tenantConfig;
      });
  }

  /**
   * Retrieves the password/phone TenantUiConfig corresponding to the tenant ID provided.
   * @param tenantId The corresponding tenant ID whose TenantUiConfig is to be returned.
   * @return A promise that resolves with the corresponding TenantUiConfig.
   */
  private getEnabledPasswordAndPhoneIdps(tenantId: string): Promise<TenantUiConfig> {
    if (tenantId.charAt(0) === '_') {
      let retrievedProjectId: string;
      return this.app.getProjectId()
        .then((projectId) => {
          retrievedProjectId = projectId;
          return this.getGcipConfigHandler.send({
            urlParams: {
              projectId,
            },
          }, DEFAULT_ERROR_GET_GCIP_CONFIG);
        })
        .then((httpResponse) => {
          const config: Config = typeof httpResponse.body === 'object' ?
              httpResponse.body : JSON.parse(httpResponse.body);
          const signInOptions: SignInOption[] = [];

          if (config &&
              config.signIn &&
              config.signIn.email &&
              config.signIn.email.enabled) {
            signInOptions.push({provider: 'password'});
          }
          if (config &&
              config.signIn &&
              config.signIn.phoneNumber &&
              config.signIn.phoneNumber.enabled) {
            signInOptions.push({provider: 'phone'});
          }
          return {
            displayName: retrievedProjectId,
            signInOptions,
          };
        });
    } else {
      return this.app.getProjectId()
        .then((projectId) => {
          return this.getTenantBasicConfigHandler.send({
            urlParams: {
              projectId,
              tenantId,
            },
          }, DEFAULT_ERROR_GET_TENANT_CONFIG);
        })
        .then((httpResponse) => {
          const config: Tenant = typeof httpResponse.body === 'object' ?
              httpResponse.body : JSON.parse(httpResponse.body);
          const signInOptions: SignInOption[] = [];

          if (config &&
              config.allowPasswordSignup) {
            signInOptions.push({provider: 'password'});
          }
          return {
            displayName: (config && config.displayName) || undefined,
            signInOptions,
          };
        });
    }
  }

  /**
   * Retrieves the default IdP provider IDs corresponding to the tenant ID provided.
   * @param tenantId The corresponding tenant ID whose default IdP provider IDs are to be returned.
   * @return A promise that resolves with the corresponding default IdP provider IDs.
   */
  private getEnabledDefaultIdps(tenantId: string): Promise<SignInOption[]> {
    return this.app.getProjectId()
      .then((projectId) => {
        return this.getDefaultIdpsHandler.send({
          urlParams: {
            resourceId: (tenantId.charAt(0) === '_' ?
                `projects/${projectId}` : `projects/${projectId}/tenants/${tenantId}`),
            pageSize: PAGE_SIZE.toString(),
          },
        }, DEFAULT_ERROR_GET_DEFAULT_IDPS_CONFIG);
      })
      .then((httpResponse) => {
        const config: ListDefaultSupportedIdpConfigsResponse = typeof httpResponse.body === 'object' ?
            httpResponse.body : JSON.parse(httpResponse.body);
        const delimiter = 'defaultSupportedIdpConfigs/';
        const signInOptions: SignInOption[] = [];
        (config.defaultSupportedIdpConfigs || []).forEach((defaultSupportedIdp) => {
          const name = defaultSupportedIdp && defaultSupportedIdp.name;
          if (defaultSupportedIdp && defaultSupportedIdp.enabled) {
            signInOptions.push({
              provider: name.substring(name.indexOf(delimiter) + delimiter.length),
            });
          }
        });
        return signInOptions;
      });
  }

  /**
   * Retrieves the SAML sign-in options corresponding to the tenant ID provided.
   * @param tenantId The corresponding tenant ID whose SAML sign-in options are to be returned.
   * @return A promise that resolves with the corresponding SAML sign-in options.
   */
  private getEnabledSamlIdps(tenantId: string): Promise<SignInOption[]> {
    return this.app.getProjectId()
      .then((projectId) => {
        return this.getSamlIdpsHandler.send({
          urlParams: {
            resourceId: (tenantId.charAt(0) === '_' ?
                `projects/${projectId}` : `projects/${projectId}/tenants/${tenantId}`),
            pageSize: PAGE_SIZE.toString(),
          },
        }, DEFAULT_ERROR_GET_SAML_IDPS_CONFIG);
      })
      .then((httpResponse) => {
        const config: ListInboundSamlConfigsResponse = typeof httpResponse.body === 'object' ?
            httpResponse.body : JSON.parse(httpResponse.body);
        const delimiter = 'inboundSamlConfigs/';
        const signInOptions: SignInOption[] = [];
        (config.inboundSamlConfigs || []).forEach((inboundSamlConfig) => {
          if (inboundSamlConfig && inboundSamlConfig.enabled) {
            const name = inboundSamlConfig.name;
            signInOptions.push({
              provider: name.substring(name.indexOf(delimiter) + delimiter.length),
              providerName: inboundSamlConfig.displayName,
            });
          }
        });
        return signInOptions;
      });
  }

  /**
   * Retrieves the OIDC sign-in options corresponding to the tenant ID provided.
   * @param tenantId The corresponding tenant ID whose OIDC sign-in options are to be returned.
   * @return A promise that resolves with the corresponding OIDC sign-in options.
   */
  private getEnabledOidcIdps(tenantId: string): Promise<SignInOption[]> {
    return this.app.getProjectId()
      .then((projectId) => {
        return this.getOidcIdpsHandler.send({
          urlParams: {
            resourceId: (tenantId.charAt(0) === '_' ?
                `projects/${projectId}` : `projects/${projectId}/tenants/${tenantId}`),
            pageSize: PAGE_SIZE.toString(),
          },
        }, DEFAULT_ERROR_GET_OIDC_IDPS_CONFIG);
      })
      .then((httpResponse) => {
        const config: ListOAuthIdpConfigsResponse = typeof httpResponse.body === 'object' ?
            httpResponse.body : JSON.parse(httpResponse.body);
        const delimiter = 'oauthIdpConfigs/';
        const signInOptions: SignInOption[] = [];
        (config.oauthIdpConfigs || []).forEach((oauthIdpConfig) => {
          if (oauthIdpConfig && oauthIdpConfig.enabled) {
            const name = oauthIdpConfig.name;
            signInOptions.push({
              provider: name.substring(name.indexOf(delimiter) + delimiter.length),
              providerName: oauthIdpConfig.displayName,
            });
          }
        });
        return signInOptions;
      });
  }
}
