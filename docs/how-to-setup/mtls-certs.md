Generate MTLS Certificates
==========================

Obtain auth `$token` using `extract_token.sh` and service key from BTP as described in 
[fos-cert-svc](https://github.tools.sap/bdc-fos/fos-certificate-svc#get-access-token-to-authorize-in-fos-certificate-svc) 
and forward ports from `fos-certificate-svc` to `localhost`.

```shell
token=$(./extract_token.sh service-key.json)
kubectl port-forward fos-certificate-svc-xxx 3000
```
DataSubscriptions API
---------------------

Find appropriate certificate subject in [fos-data-subscription-dev-config/values.yaml](https://github.tools.sap/bdc-fos/fos-data-subscription-dev-config/blob/main/values.yaml)
`.certificate` field.

Acually it is `L=bdc-fos/CN=test-certificate`

```shell
# dev-poc10
# BTP_SUBACCOUNT_ID=0950e3d7-1ed6-4adc-bc87-d58914cb753a 
openssl req -new -sha256 -key private-key.pem -out dsapi-csr.pem \
   -subj '/C=DE/O=SAP SE/OU=SAP Cloud Platform Clients/OU=Canary/OU=62fd854b-feb2-431b-95b2-f12956844bf4/L=eu10/CN=it-hcm'
# sign the certificate request
curl  http://localhost:3000/hdlfs/sign-csr -XPOST \
    -H "Authorization: Bearer $token" \
    --json (jq --rawfile csr dsapi-csr.pem -cnr '{csr: $csr}')  \
  | jq -r .cert > dsapi.cert
  
curl --key private-key.pem --cert test-cert.pem \
    https://api.mtls.dev-canary.eu10.bdcfos.cloud.sap/dsapi/dss/v0/dataSubscriptions\?subscriber=…
```
JK
```shell
curl http://localhost:3000/hdlfs/sign-csr -XPOST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(jq --rawfile csr dsapi-csr.pem -n '{csr: $csr}')" \
  | jq -r .cert > dsapi.cert
```
Metadata Catalog
----------------

`metadata_catalog.ucl_tenant_mapping.mapping_data` for tenant should contain the following fields:

```js
{
  "assignedTenant": {
    "subaccountId": "0950e3d7-1ed6-4adc-bc87-d58914cb753a",
    "applicationTenantId": "tenantABC",
    "applicationNamespace": "sap.datasphere",
    …
  },
  "receiverTenant": {
    "uclAssignmentId": "assignment123",
    "deploymentRegion": "eu10",
    "applicationTenantId": "TestTenant123",
    "applicationNamespace": "hcm",
    …
  },
  …
}
```

`fos-auth-svc` is checking the following attributes in the certificate:

| DN   | values                                                                                                        |                                                                                                       
|------|---------------------------------------------------------------------------------------------------------------| 
| `OA` | must have `SAP Cloud Platform Clients` and `$BTP_SUBACCOUNT_ID`                                               |
| `L`  | must match `${assignedTenant.applicationTenantId}_${receiverTenant.uclAssignmentId` from `mapping_data` field |

The certificate request will then look following

```shell
# generate a certificate request
openssl req -new -sha256 -key my-private-key.pem -out mdc-csr.pem \
# sign the certificate request
  -subj '/C=DE/O=SAP SE/OU=SAP Cloud Platform Clients/OU=0950e3d7-1ed6-4adc-bc87-d58914cb753a/L=tenantABC_assignment123/CN=tenantABC_assignment123'
curl  http://localhost:3000/hdlfs/sign-csr -XPOST \
    -H "Authorization: Bearer $token" \
    --json (jq --rawfile csr mdc-csr.pem -cnr '{csr: $csr}')  \
  | jq -r .cert > mdc.cert

curl --key privatekey.key  --cert mdc.cert 'https://fos-administration-svc.c-2d7b426.kyma.ondemand.com/public/onboarding/v1/tenants/sap.bdcfos:cf-eu10:DSAPI_IT_TENANT/dataproducts'
```

