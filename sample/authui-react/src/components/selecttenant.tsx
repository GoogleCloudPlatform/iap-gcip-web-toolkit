/*
 * Copyright 2019 Google Inc. All Rights Reserved.
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
import React from 'react';

export interface SelectTenantParameters {
  tenants: Array<{
    tenantId: string;
    tenantDisplayName: string;
  }>;
  onSelectTenant: (tenantId: string) => void;
}

export class SelectTenant extends React.Component<SelectTenantParameters, {}> {
  render(): JSX.Element {
    return (
      <div className="card">
        <div className="card-header sign-in-header">
          IAP/GCIP Sample App
        </div>
        <div className="card-body">
          <h5 className="card-title">Select Company</h5>
          <form id="select-tenant-form" onSubmit={(e) => {e.preventDefault();}}>
            <div className="padded-div" >
              {this.props.tenants.map((tenant, index) => {
                return (
                  <button type="button"
                      key={tenant.tenantId}
                      id={'sign-in-' + tenant.tenantId}
                      data-tenant-id={tenant.tenantId}
                      className="sign-in-with-tenant-btn btn btn-primary btn-block"
                      onClick={() => {this.props.onSelectTenant(tenant.tenantId);}}>
                    Sign in with {tenant.tenantDisplayName}
                  </button>
                );
              })}
            </div>
          </form>
        </div>
      </div>
    );
  }
}