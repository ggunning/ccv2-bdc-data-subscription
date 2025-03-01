declare module '@sap/audit-logging' {
    export interface AuditAttribute {
        name: string;
        new: string;
        old: string;
    }

    export interface MessageBase {
        attribute: (attr: AuditAttribute) => this;
        by: (user: string) => this;
        tenant: (tenant: '$PROVIDER' | '$SUBSCRIBER') => this;
        at: (ts: Date | string) => this;
    }

    export interface AuditLogSubmit {
        logPrepare: () => Promise<any>;
        logSuccess: () => Promise<any>;
        logFailure: () => Promise<any>;
    }

    type ConfigurationChangeMessage = MessageBase & AuditLogSubmit;

    export function v2(credentials: any): Promise<{
        configurationChange: (accessedObject: {
            type: string,
            id: {
                state?: string, operation?: string, namespace?: string,
                [other: string]: string
            }
        }) => ConfigurationChangeMessage;
        read: () => any;
        update: (accessedObject: {
            type: string,
            id: {
                state?: string, operation?: string, namespace?: string,
                [other: string]: string
            }
        }) => MessageBase & AuditLogSubmit;
        securityMessage: () => any;
    }>;
    // the declarations I use
}
