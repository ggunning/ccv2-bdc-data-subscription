import * as xsenv from '@sap/xsenv';
import { logger } from '@bdc-fos/fos-logger';
import axios from 'axios';
import { Agent } from 'https';
import jose from 'node-jose';

export interface MdcTenantResponse {
    tenantId: string;
    uniqueCustomerId: string;
    applicationType: string;
    applicationTenantId: string;
    deploymentRegion: string;
    uclSystemTenantId: string;
    applicationURL: string;
    hdlfsContainerId: string;
    hdlfsContainerHostName: string;
    s4ReleaseVersion: string;
    dsapiSubscriptionUrl: string;
    dsapiSubscriptionAuthUrl: string;
    dsapiClientId: string;
    dsapiClientCert: string;
    dsapiClientKeyId: string;
}

export interface DscDataSource {
    id: string;
    tenantId: string;
    dataSourceDefinitionId: string;
    dataSourcePath: string;
    dataSourceId: string;
    producerSubscriptionId: string;
    schedule: string;
    beginWatermark: string;
    upperWatermark: string;
    status: string;
}

export interface DscDataSourcePostPayload {
    dataSourceId: string;
    tenantId: string;
    dataSourceDefinitionId: string;
    dataSourcePath: string;
}

export interface DssSubscription {
    id: string;
    subscriber: string;
    producer: string;
    dataSourceId: string;
    schedule: string;
    beginWatermark: string;
    upperWatermark: string;
    destinationPath: string;
    version: string;
    createdAt: string;
    updatedAt: string;
}

export const getTokenCertAuth = async (authUrl: string, clientId: string, cert: string, key: string): Promise<string> => {
    // Authenticating with grant_type = client_credentials (System to system authentication)
    const result = await axios.post(
        authUrl.endsWith('/oauth/token') ? authUrl : `${authUrl}/oauth/token`,
        new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId }).toString(),
        {
            httpsAgent: new Agent({ cert, key }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );
    return result?.data?.access_token;
};

let cachedCredentials: any = null;

export const loadCredentials = (): void => {
    if (!cachedCredentials) {
        logger.debug('Loading credentials from credstore');
        cachedCredentials = xsenv.serviceCredentials({ label: 'credstore' });
    }
};

const getCredstorSvcUrl = (): string => {
    return cachedCredentials.url;
};

const getCredstoreSvcKey = (): string => {
    return cachedCredentials.key;
};

const getCredstoreSvcCert = (): string => {
    return cachedCredentials.certificate;
};

const getCredstoreSvcEncryption = (): any => {
    return cachedCredentials.encryption;
};

const getConfig = (namespace: string, initHeaders?: any) => {
    const result = {
        httpsAgent: new Agent({
            cert: getCredstoreSvcCert(),
            key: getCredstoreSvcKey()
        }),
        headers: { DataServiceVersion: '2.0', 'sapcp-credstore-namespace': namespace }
    };
    if (initHeaders) { result.headers = { ...result.headers, ...initHeaders }; }
    return result;
};

const decryptPayload = async (data: string): Promise<string> => {
    const encryption = getCredstoreSvcEncryption();
    const key = await jose.JWK.asKey(
        `-----BEGIN PRIVATE KEY-----${encryption.client_private_key}-----END PRIVATE KEY-----`,
        'pem',
        { alg: 'RSA-OAEP-256', enc: 'A256GCM' }
    );
    const decrypt = await jose.JWE.createDecrypt(key).decrypt(data);
    return decrypt.plaintext.toString();
};

export const readCredential = async (name: string): Promise<any> => {
    // Load credstore credentials
    loadCredentials();
    const result = await axios.get(`${getCredstorSvcUrl()}/key?name=${encodeURIComponent(name)}`, getConfig('dsapi'));
    const credential = JSON.parse(await decryptPayload(result.data));
    return Buffer.from(credential.value, 'base64').toString('utf-8');
};
