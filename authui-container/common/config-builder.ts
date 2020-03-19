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

import * as validators from './validator';

// TODO: Temporary URLs for now. Replace with production ones when ready.
// This is the icon for each tenant button in the tenant selection screen.
export const TENANT_ICON_URL = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png';
// Select tenant screen logo. This is the logo on the tenant selection screen.
export const SELECT_TENANT_LOGO_URL =
    'https://lh3.googleusercontent.com/AdcgmqzXjd7-Vpo478h7TzTkyagFycEvT38zSxFOQRFbyGUgtdraQe5fAtTlqsWx3FJN' +
    '-rlkYYZNeSjm8xRd=w80-h40';
// Sign in UI screen logo. This is the logo on the sign-in UI screen after a tenant is already selected.
export const SIGN_IN_UI_LOGO_URL = 'https://img.icons8.com/cotton/2x/cloud.png';

interface GcipConfig {
  apiKey: string;
  authDomain: string;
}

interface TenantUiConfigSignInOption {
  provider: string;
  providerName?: string;
}

interface TenantUiConfig {
  displayName?: string;
  signInOptions: TenantUiConfigSignInOption[];
}

interface SignInOption {
  provider: string;
  providerName?: string;
  hd?: string;
  buttonColor?: string;
  iconUrl?: string;
  scopes?: string[];
  customParameters?: {[key: string]: any};
  loginHintKey?: string;
  requireDisplayName?: boolean;
  recaptchaParameters?: {
    type?: string;
    size?: string;
    badge?: string;
  };
  defaultCountry?: string;
  defaultNationalNumber?: string;
  loginHint?: string;
  whitelistedCountries?: string[];
  blacklistedCountries?: string[];
}

interface ExtendedTenantUiConfig {
  displayName: string;
  iconUrl: string;
  logoUrl: string;
  buttonColor: string;
  signInOptions: (SignInOption | string)[];
  tosUrl?: string;
  privacyPolicyUrl?: string;
  immediateFederatedRedirect?: boolean;
  signInFlow?: 'redirect' | 'popup';
}

export interface UiConfig {
  [key: string]: {
    authDomain?: string;
    displayMode: string;
    selectTenantUiTitle?: string;
    selectTenantUiLogo?: string;
    styleUrl?: string;
    tenants: {
      [key: string]: ExtendedTenantUiConfig;
    };
    tosUrl?: string,
    privacyPolicyUrl?: string,
  };
}

/** UiConfig validation tree. */
const VALIDATION_TREE: validators.ValidationTree = {
  '*': {
    nodes: {
      authDomain: {
        validator: (value: any, key: string) => {
          if (!validators.isSafeString(value)) {
            throw new Error(`"${key}" should be a valid string.`);
          }
        },
      },
      displayMode: {
        validator: (value: any, key: string) => {
          if (value !== 'optionFirst' && value !== 'identifierFirst') {
            throw new Error(`"${key}" should be either "optionFirst" or "identifierFirst".`);
          }
        },
      },
      selectTenantUiTitle: {
        validator: (value: any, key: string) => {
          if (!validators.isSafeString(value)) {
            throw new Error(`"${key}" should be a valid string.`);
          }
        },
      },
      selectTenantUiLogo: {
        validator: (value: any, key: string) => {
          if (!validators.isHttpsURL(value)) {
            throw new Error(`"${key}" should be a valid HTTPS URL.`);
          }
        },
      },
      styleUrl: {
        validator: (value: any, key: string) => {
          if (value && !validators.isHttpsURL(value)) {
            throw new Error(`"${key}" should be a valid HTTPS URL.`);
          }
        },
      },
      tosUrl: {
        validator: (value: any, key: string) => {
          if (value && !validators.isHttpsURL(value)) {
            throw new Error(`"${key}" should be a valid HTTPS URL.`);
          }
        },
      },
      privacyPolicyUrl: {
        validator: (value: any, key: string) => {
          if (value && !validators.isHttpsURL(value)) {
            throw new Error(`"${key}" should be a valid HTTPS URL.`);
          }
        },
      },
      tenants: {
        nodes: {
          '*': {
            nodes: {
              displayName: {
                validator: (value: any, key: string) => {
                  if (!validators.isSafeString(value)) {
                    throw new Error(`"${key}" should be a valid string.`);
                  }
                },
              },
              iconUrl: {
                validator: (value: any, key: string) => {
                  if (!validators.isHttpsURL(value)) {
                    throw new Error(`"${key}" should be a valid HTTPS URL.`);
                  }
                },
              },
              logoUrl: {
                validator: (value: any, key: string) => {
                  if (!validators.isHttpsURL(value)) {
                    throw new Error(`"${key}" should be a valid HTTPS URL.`);
                  }
                },
              },
              buttonColor: {
                validator: (value: any, key: string) => {
                  if (!validators.isValidColorString(value)) {
                    throw new Error(`"${key}" should be a valid color string of format #xxxxxx.`);
                  }
                },
              },
              tosUrl: {
                validator: (value: any, key: string) => {
                  if (value && !validators.isHttpsURL(value)) {
                    throw new Error(`"${key}" should be a valid HTTPS URL.`);
                  }
                },
              },
              privacyPolicyUrl: {
                validator: (value: any, key: string) => {
                  if (value && !validators.isHttpsURL(value)) {
                    throw new Error(`"${key}" should be a valid HTTPS URL.`);
                  }
                },
              },
              immediateFederatedRedirect: {
                validator: (value: any, key: string) => {
                  if (!validators.isBoolean(value)) {
                    throw new Error(`"${key}" should be a valid boolean.`);
                  }
                },
              },
              signInFlow: {
                validator: (value: any, key: string) => {
                  if (value !== 'popup' && value !== 'redirect') {
                    throw new Error(`"${key}" should be either "popup" or "redirect".`);
                  }
                },
              },
              'signInOptions[]': {
                // signInOptions can be a list of string too.
                validator: (value: any, key: string) => {
                  if (!validators.isProviderId(value)) {
                    throw new Error(`"${key}" should be a valid providerId string or provider object.`);
                  }
                },
                nodes: {
                  provider: {
                    validator: (value: any, key: string) => {
                      if (!validators.isProviderId(value)) {
                        throw new Error(`"${key}" should be a valid providerId string.`);
                      }
                    },
                  },
                  providerName: {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  hd: {
                    validator: (value: any, key: string) => {
                      // Regexp is not an allowed JSON field. Limit to domains.
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid domain string.`);
                      }
                    },
                  },
                  buttonColor: {
                    validator: (value: any, key: string) => {
                      if (!validators.isValidColorString(value)) {
                        throw new Error(`"${key}" should be a valid color string of format #xxxxxx.`);
                      }
                    },
                  },
                  iconUrl: {
                    validator: (value: any, key: string) => {
                      if (!validators.isHttpsURL(value)) {
                        throw new Error(`"${key}" should be a valid HTTPS URL.`);
                      }
                    },
                  },
                  'scopes[]': {
                    validator: (value: any, key: string) => {
                      // Google OAuth scopes are URLs.
                      if (!validators.isSafeString(value) && !validators.isHttpsURL(value)) {
                        throw new Error(`"${key}" should be a valid array of OAuth scopes.`);
                      }
                    },
                  },
                  customParameters: {
                    nodes: {
                      '*': {
                        validator: (value: any, key: string) => {
                          if (!validators.isSafeString(value)) {
                            throw new Error(`"${key}" should be a valid string.`);
                          }
                        },
                      },
                    },
                  },
                  loginHintKey: {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  requireDisplayName: {
                    validator: (value: any, key: string) => {
                      if (!validators.isBoolean(value)) {
                        throw new Error(`"${key}" should be a valid boolean.`);
                      }
                    },
                  },
                  recaptchaParameters: {
                    nodes: {
                      type: {
                        validator: (value: any, key: string) => {
                          if (value !== 'image' && value !== 'audio') {
                            throw new Error(`"${key}" should be either "image" or "audio".`);
                          }
                        },
                      },
                      size: {
                        validator: (value: any, key: string) => {
                          if (value !== 'invisible' && value !== 'compact' && value !== 'normal') {
                            throw new Error(`"${key}" should be one of ["invisible", "compact", "normal"].`);
                          }
                        },
                      },
                      badge: {
                        validator: (value: any, key: string) => {
                          if (value !== 'bottomright' && value !== 'bottomleft' && value !== 'inline') {
                            throw new Error(`"${key}" should be one of ["bottomright", "bottomleft", "inline"].`);
                          }
                        },
                      },
                    },
                  },
                  defaultCountry: {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  defaultNationalNumber: {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  loginHint: {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  'whitelistedCountries[]': {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                  'blacklistedCountries[]': {
                    validator: (value: any, key: string) => {
                      if (!validators.isSafeString(value)) {
                        throw new Error(`"${key}" should be a valid string.`);
                      }
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/** Utility for building the default UI config object. */
export class DefaultUiConfigBuilder {
  private static uiConfigValidator: validators.JsonObjectValidator =
      new validators.JsonObjectValidator(VALIDATION_TREE);

  /**
   * Validates the provided UiConfig object.
   * @param config The input configuration to validate.
   */
  public static validateConfig(config: UiConfig) {
    DefaultUiConfigBuilder.uiConfigValidator.validate(config);
  }

  /**
   * Instantiates a default UI config builder instance.
   * @param projectId The project ID to use.
   * @param gcipConfig The GCIP web config.
   * @param tenantUiConfigMap The map of tenant IDs to TenantUiConfig object.
   */
  constructor(
      private readonly projectId: string,
      private readonly gcipConfig: GcipConfig,
      private readonly tenantUiConfigMap: {[key: string]: TenantUiConfig}) {}

  /**
   * @return The generated UiConfig object if available, null otherwise.
   */
  build(): UiConfig | null {
    const tenantConfigs: {[key: string]: ExtendedTenantUiConfig} = {};
    let charCode = 'A'.charCodeAt(0);
    const optionsMap = this.tenantUiConfigMap;
    const tenantIds: string[] = [];

    for (const tenantId in optionsMap) {
      if (optionsMap.hasOwnProperty(tenantId)) {
        tenantIds.push(tenantId);
      }
    }
    tenantIds.forEach((tenantId) => {
      let key;
      let displayName;
      if (tenantId.charAt(0) === '_') {
        key = '_';
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            'My Company';
      } else {
        key = tenantId;
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            `Company ${String.fromCharCode(charCode)}`;
        charCode++;
      }

      tenantConfigs[key] = {
        displayName,
        iconUrl: TENANT_ICON_URL,
        logoUrl: SIGN_IN_UI_LOGO_URL,
        buttonColor: '#007bff',
        // By default, use immediate federated redirect.
        // This is safe since if more than one provider is used, FirebaseUI will ignore this.
        immediateFederatedRedirect: true,
        signInFlow: 'redirect',
        signInOptions: (optionsMap[key] && optionsMap[key].signInOptions) || [],
        tosUrl: '',
        privacyPolicyUrl: '',
      };
    });
    // IAP not yet configured.
    if (tenantIds.length === 0) {;
      return null;
    }

    return {
      [this.gcipConfig.apiKey]: {
        authDomain: this.gcipConfig.authDomain,
        displayMode: 'optionFirst',
        selectTenantUiTitle: this.projectId,
        selectTenantUiLogo: SELECT_TENANT_LOGO_URL,
        styleUrl: '',
        tenants: tenantConfigs,
        tosUrl: '',
        privacyPolicyUrl: '',
      },
    };
  }
}
