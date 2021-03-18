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
import {GcipConfig, TenantUiConfig, ExtendedTenantUiConfig, UiConfig} from './config';

// TODO: Temporary URLs for now. Replace with production ones when ready.
// This is the icon for each tenant button in the tenant selection screen.
export const TENANT_ICON_URL = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png';

// List of required fields.
const REQUIRED_FIELDS = [
  '*.authDomain',
  '*.displayMode',
  '*.tenants.*.displayName',
  '*.tenants.*.iconUrl',
  '*.tenants.*.buttonColor',
  '*.tenants.*.signInOptions[]',
];

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
          if (value && !validators.isHttpsURL(value)) {
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
              fullLabel: {
                validator: (value: any, key: string) => {
                  if (!validators.isSafeString(value)) {
                    throw new Error(`"${key}" should be a valid string.`);
                  }
                },
              },
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
                  if (value && !validators.isHttpsURL(value)) {
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
                  fullLabel: {
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
                  disableSignUp: {
                    nodes: {
                      status: {
                        validator: (value: any, key: string) => {
                          if (!validators.isBoolean(value)) {
                            throw new Error(`"${key}" should be a boolean.`);
                          }
                        },
                      },
                      adminEmail: {
                        validator: (value: any, key: string) => {
                          if (value && !validators.isEmail(value)) {
                            throw new Error(`"${key}" should be a valid email.`);
                          }
                        },
                      },
                      helpLink: {
                        validator: (value: any, key: string) => {
                          if (value && !validators.isHttpsURL(value)) {
                            throw new Error(`"${key}" should be a valid HTTPS URL.`);
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
    },
  },
};

/** Utility for building the default UI config object. */
export class DefaultUiConfigBuilder {
  private static uiConfigValidator: validators.JsonObjectValidator =
      new validators.JsonObjectValidator(VALIDATION_TREE, REQUIRED_FIELDS);

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
    let totalSignInOptions: number = 0;

    for (const tenantId in optionsMap) {
      if (optionsMap.hasOwnProperty(tenantId)) {
        tenantIds.push(tenantId);
      }
    }
    tenantIds.forEach((tenantId) => {
      let key;
      let displayName;
      let fullLabel;
      if (tenantId.charAt(0) === '_') {
        key = '_';
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            'My Company';
        fullLabel = optionsMap[key] && optionsMap[key].fullLabel;
      } else {
        key = tenantId;
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            `Company ${String.fromCharCode(charCode)}`;
        fullLabel = optionsMap[key] && optionsMap[key].fullLabel;
        charCode++;
      }

      totalSignInOptions += (optionsMap[key] &&
        optionsMap[key].signInOptions && optionsMap[key].signInOptions.length) || 0;

      tenantConfigs[key] = {
        displayName,
        iconUrl: TENANT_ICON_URL,
        logoUrl: '',
        buttonColor: '#007bff',
        // By default, use immediate federated redirect.
        // This is safe since if more than one provider is used, FirebaseUI will ignore this.
        immediateFederatedRedirect: true,
        signInFlow: 'redirect',
        signInOptions: (optionsMap[key] && optionsMap[key].signInOptions) || [],
        tosUrl: '',
        privacyPolicyUrl: '',
      };

      if (fullLabel) {
        tenantConfigs[key].fullLabel = fullLabel;
      }
    });
    // IAP or IdPs not yet configured.
    if (totalSignInOptions === 0) {;
      return null;
    }

    return {
      [this.gcipConfig.apiKey]: {
        authDomain: this.gcipConfig.authDomain,
        displayMode: 'optionFirst',
        selectTenantUiTitle: this.projectId,
        selectTenantUiLogo: '',
        styleUrl: '',
        tenants: tenantConfigs,
        tosUrl: '',
        privacyPolicyUrl: '',
      },
    };
  }
}
