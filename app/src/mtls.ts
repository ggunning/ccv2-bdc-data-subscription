import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import express from 'express';
import * as forge from 'node-forge';
import { VerifiedCallback } from 'passport-custom';

export const verifyCertificateMtls = (req: express.Request, done: VerifiedCallback) => {
    logger.info('verifyCertificateMtls...');
    try {
        const authenticationResult = isCallerValid(req);
        console.log("isCallerValid reports: ", JSON.stringify(authenticationResult, null, 2));
        if (authenticationResult.authenticated) {
            return done(null, {
                tenantId: authenticationResult.tenantId,
                issuer: authenticationResult.issuer,
                subject: authenticationResult.subject
            });
        }
    } catch (error) {
        logger.error('Error in verifyCertificateMtls: ', convertToSafeError(error));
    }
    return done(null, null);
};

interface CertAttribute {
    shortName: string;
    value: string;
  }
const isCallerValid = (req: express.Request) => {
    const headerCert = forge.pki.certificateFromPem(extractPemFromHeader(String(req.headers['x-forwarded-client-cert'])));
    const headerCertParams = {
        subject: (headerCert.subject.attributes as CertAttribute[]).map(attr => `${attr.shortName}=${attr.value}`).join(','),
        issuer: (headerCert.issuer.attributes as CertAttribute[]).map(attr => `${attr.shortName}=${attr.value}`).join(','),
        tenantId: req.headers['bdcfos-producer-tenantid'] 
    }
    console.error("request cert details: ", JSON.stringify(headerCertParams, null, 2));

    const desiredCertsJson = JSON.parse(process.env.CERTS_DETAILS || `[
        {
            "tenantId": "123",
            "subject": "CN=ValidC",
            "issuer": "CN=Trust"
        },
        {
            "tenantId": "1234",
            "subject": "CN=ValidClient, O=Company",
            "issuer": "CN=TrustedCA, O=CertificateAuthority"
        },
        {
            "tenantId": "sap.bdcfos.testing::cx-commerce-ccv2",
            "subject": "CN=ValidClient, O=Company",
            "issuer": "CN=TrustedCA, O=CertificateAuthority" 
        }
    ]`);

    const normalizeAndSort = (str: string): string => {
        return str
            .split(',')
            .map(part => part.trim()) // Trim whitespace
            .sort() // Sort alphabetically
            .join(',');
    };

    const isValid = desiredCertsJson.some((desiredCertParams: any) => {
        const tenantIdMatch = headerCertParams.tenantId === desiredCertParams.tenantId;
        const subjectMatch = normalizeAndSort(headerCertParams.subject) === normalizeAndSort(desiredCertParams.subject);
        const issuerMatch = normalizeAndSort(headerCertParams.issuer) === normalizeAndSort(desiredCertParams.issuer);

        console.error("🔹 Tenant ID Match:", tenantIdMatch, `(Expected: ${desiredCertParams.tenantId}, Received: ${headerCertParams.tenantId})`);
        console.error("🔹 Subject Match:", subjectMatch, `(Expected: ${normalizeAndSort(desiredCertParams.subject)}, Received: ${normalizeAndSort(headerCertParams.subject)})`);
        console.error("🔹 Issuer Match:", issuerMatch, `(Expected: ${normalizeAndSort(desiredCertParams.issuer)}, Received: ${normalizeAndSort(headerCertParams.issuer)})`);

        return tenantIdMatch && subjectMatch && issuerMatch;
    });

    console.error(`✅ Final Validation Result: ${isValid ? "✔ Valid" : "❌ Invalid"}`);

    return {
        authenticated: isValid,
        tenantId: headerCertParams.tenantId,
        issuer: headerCertParams.issuer,
        subject: headerCertParams.subject
    };
};

const extractPemFromHeader = (headerValue: string) => {
    console.error("❌ Starting extractPemFromHeader...");
    console.log("🔹 Raw Header Value:", headerValue);

    const parts = headerValue.split(';');
    console.log("🔹 Split Parts:", parts);

    const certPart = parts.find(part => part.startsWith('Cert="'));
    if (!certPart) {
        console.error("❌ Error: Certificate part not found in header");
        throw new Error('Certificate part not found in header');
    }
    console.log("✅ Found Cert Part:", certPart);

    const encodedCert = certPart.slice(6, -1); // Remove Cert=" at the start and " at the end
    console.log("🔹 Encoded Cert:", encodedCert);

    const decodedCert = decodeURIComponent(encodedCert);
    console.log("✅ Decoded Certificate:", decodedCert);

    return decodedCert;
};

