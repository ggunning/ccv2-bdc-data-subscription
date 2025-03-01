import axios, { AxiosInstance } from 'axios';
import { cfServiceCredentials, ServiceCredentials, ServiceQuery } from '@sap/xsenv';
import { AuditAttribute } from "@sap/audit-logging";

jest.setTimeout(600000);

interface AuditLog<T=string> {
    message_uuid: string;
    time: string;
    tenant: string;
    org_id: string;
    space_id: string;
    app_or_service_id: string;
    als_service_id: string;
    user: string;
    category: string;
    format_version: string;
    message: T;
}

interface AuditMessage {
    uuid: string;
    user: string;
    time: string;
    id: string;
    object: {
        type: string;
        id: {
            action: string;
            'correlation-id': string;
        };
    };
    attributes: AuditAttribute[];
    category: string;
    tenant: string;
    customDetails: {
        email: string;
        user: string;
    };
}

class AuditLogManagementService {
    creds: ServiceCredentials;
    accessToken: string;
    private axios: AxiosInstance;

    constructor(filter: ServiceQuery) {
        this.creds = cfServiceCredentials(filter);
    }

    async getAccessToken() {
        const { data: { access_token: accessToken } } = await axios.post(`${(this.creds as any).uaa.url}/oauth/token`,
            new URLSearchParams({
                client_id: (this.creds as any).uaa.clientid,
                client_secret: (this.creds as any).uaa.clientsecret,
                grant_type: 'client_credentials'
            }).toString()
        );
        return accessToken;
    }

    async *fetchLogs(category = 'audit.configuration', back = 1) {
        if (!this.accessToken) {
            this.accessToken = await this.getAccessToken();
            this.axios = axios.create({
                baseURL: this.creds.url as string,
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
        }
        const now = Date.now();
        const t1 = new Date(now).toISOString().split('.')[0];
        const t0 = new Date(now - 3600000 * back).toISOString().split('.')[0];

        let { data, headers } = await this.axios.get<AuditLog[]>(`/auditlog/v2/auditlogrecords?time_from=${t0}&time_to=${t1}&category=${category}`, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        for (const log of data) {
            yield { ...log, message: JSON.parse(log.message) };
        }

        while (headers.paging) {
            ({ data, headers } = await this.axios.get(`/auditlog/v2/auditlogrecords?${headers.paging}`));
            for (const log of data) {
                yield { ...log, message: JSON.parse(log.message) };
            }
        }
    }
}

describe('auditlog management', () => {
    const service = new AuditLogManagementService({ label: 'auditlog-management' });

    it('should find some audit.configurations', async () => {
        const logs = [] as Array<AuditLog<AuditMessage>>;

        for await (const log of service.fetchLogs()) {
            if (log?.message?.object?.id?.namespace?.startsWith('dsapiSubscription.')) {
                logs.push(log);
            }
        }

        expect(logs.length).toBeGreaterThan(0);
    });
});
