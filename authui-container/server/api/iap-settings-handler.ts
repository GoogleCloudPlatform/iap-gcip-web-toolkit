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

/** List compute backend service IDs endpoint. */
const LIST_COMPUTE_BACKEND_SERVICE_IDS_URL =
    'https://compute.googleapis.com/compute/v1/projects/{projectId}/global/backendServices';
/** Get IAP settings endpoint. */
const GET_IAP_SETTINGS_URL =
    'https://iap.googleapis.com/v1/projects/{projectNumber}/iap_web/{id}:iapSettings';
/** Default error message to show when compute backend service IDs cannot be listed. */
export const DEFAULT_ERROR_COMPUTE_BACKEND_SERIVCE_IDS_LIST = 'Unable to list compute backend service IDs.';
/** Default error message to show when IAP settings for a specified resource cannot be retrieved. */
export const DEFAULT_ERROR_IAP_SETTINGS = 'Unable to get IAP settings for requested resource.';
/** Network request timeout duration. */
const TIMEOUT_DURATION = 10000;

// IAP related interfaces.
// https://cloud.google.com/iap/docs/reference/rest/v1/IapSettings
interface GcipSettings {
  tenantIds?: string[];
  loginPageUri?: string;
}

interface CorsSettings {
  allowHttpOptions?: boolean;
}

interface OAuthSettings {
  loginHint?: string;
  clientId?: string;
}

interface AccessSettings {
  gcipSettings?: GcipSettings;
  corsSettings?: CorsSettings;
  oauthSettings?: OAuthSettings;
}

interface ApplicationSettings {
  csmSettings?: {
    rctokenAud?: string;
  };
}

export interface IapSettings {
  name: string;
  accessSettings?: AccessSettings;
  applicationSettings?: ApplicationSettings;
}

// Compute backend service IDs interfaces.
// https://cloud.google.com/compute/docs/reference/rest/v1/backendServices/list
export interface BackendServicesList {
  id?: string;
  items?: {
    id?: string;
    creationTimestamp?: string;
    name?: string;
    description?: string;
    selfLink?: string;
    backends?: {
      group?: string;
      balancingMode?: string;
      maxUtilization?: number;
      capacityScaler?: number;
    }[];
    healthChecks?: string[];
    timeoutSec?: number;
    port?: number;
    protocol?: string;
    fingerprint?: string;
    portName?: string;
    enableCDN?: boolean;
    sessionAffinity?: string;
    affinityCookieTtlSec?: number;
    loadBalancingScheme?: string;
    connectionDraining?: {
      drainingTimeoutSec?: number;
    };
    iap?: {
      enabled?: boolean;
      oauth2ClientId?: string;
      oauth2ClientSecretSha256?: string;
    };
    kind?: string;
  }[];
  selfLink?: string;
  kind?: string;
}

/**
 * Utility used to make IAP API calls. This is currently used to list the IAP settings
 * of all enabled IAP settings.
 */
export class IapSettingsHandler {
  private listComputeBackendServiceIdsHandler: AuthenticatedRequestHandler;
  private getIapSettingsHandler: AuthenticatedRequestHandler;

  /**
   * Instantiates an IAP settings handler.
   * @param app The application data.
   * @param accessTokenManager The access token manager.
   */
  constructor(
      private readonly app: ApplicationData,
      private readonly accessTokenManager: AccessTokenManager) {
    this.listComputeBackendServiceIdsHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: LIST_COMPUTE_BACKEND_SERVICE_IDS_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.getIapSettingsHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GET_IAP_SETTINGS_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
  }

  /**
   * Retrieves the IAP settings associated with the provided resource ID.
   * @param id The IAP resource ID whose IAP settings are to be retrieved.
   *     id can be:
   *     GAE: appengine-APP_ID eg: appengine-ciap-prod-agent
   *     GCE: compute/services/BACKEND_SERVICE_ID or BACKEND_SERVICE_NAME
   * @return A promise that resolves with the resource's IAP settings, if found.
   */
  getIapSettings(id: string): Promise<IapSettings> {
    return this.app.getProjectNumber()
      .then((projectNumber) => {
        return this.getIapSettingsHandler.send({
          urlParams: {
            projectNumber,
            id,
          },
        }, DEFAULT_ERROR_IAP_SETTINGS);
      })
      .then((httpResponse) => {
        const iapSettings: IapSettings = typeof httpResponse.body === 'object' ?
            httpResponse.body : JSON.parse(httpResponse.body);
        return iapSettings;
      });
  }

  /**
   * @return A promise that resolves with the list of all IAP settings for all enabled
   *     IAP resources.
   */
  listIapSettings(): Promise<IapSettings[]> {
    const configs: any[] = [];
    const getSettings = (ids: string[], i: number, settings: IapSettings[]): Promise<IapSettings> => {
      if (i < ids.length) {
        return this.getIapSettings(ids[i])
          .then((config) => {
            settings.push(config);
          })
          .catch((error) => {
            // Ignore.
          })
          .then(() => {
            return getSettings(ids, i + 1, settings);
          });
      }
    };
    const iapResourceIds: string[] = [];
    return this.app.getProjectId()
      .then((projectId) => {
        iapResourceIds.push(`appengine-${projectId}`);
        return this.getComputeBackendServiceIds();
      })
      .then((backendServiceIds) => {
        backendServiceIds.forEach((backendServiceId) =>  {
          iapResourceIds.push(`compute/services/${backendServiceId}`);
        });
        return iapResourceIds;
      })
      .then((ids) => {
        return getSettings(ids, 0, configs);
      })
      .then(() => {
        return configs;
      });
  }

  /**
   * @return A promise that resolves with the list of Compute backend service IDs.
   */
  private getComputeBackendServiceIds(): Promise<string[]> {
    return this.app.getProjectId()
      .then((projectId) => {
        return this.listComputeBackendServiceIdsHandler.send({
          urlParams: {
            projectId,
          },
        }, DEFAULT_ERROR_COMPUTE_BACKEND_SERIVCE_IDS_LIST);
      })
      .then((httpResponse) => {
        const backendServiceIds: string[] = [];
        const computeBackendServiceIdsList: BackendServicesList =
            typeof httpResponse.body === 'object' ? httpResponse.body : JSON.parse(httpResponse.body);
        if (computeBackendServiceIdsList.items) {
          computeBackendServiceIdsList.items.forEach((item) => {
            backendServiceIds.push(item.id);
          });
        }
        return backendServiceIds;
      })
      .catch((error) => {
        // GCE API not enabled. GCE usage is not required. Ignore error.
        if (error.message.indexOf('Access Not Configured.') !== -1) {
          return [];
        }
        throw error;
      });
  }
}
