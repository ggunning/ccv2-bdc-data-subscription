import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import express from 'express';
import * as forge from 'node-forge';
import { VerifiedCallback } from 'passport-custom';

export const verifyCertificateMtls = (req: express.Request, done: VerifiedCallback) => {
    logger.info('verifyCertificateMtls...');
    try {
        const authenticationResult = isCallerValid(req);
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
    const desiredCertsJson = JSON.parse(process.env.CERTS_DETAILS);
    const isValid = desiredCertsJson.some((desiredCertParams: any) => {
        return headerCertParams.tenantId && headerCertParams.tenantId === desiredCertParams.tenantId &&
            headerCertParams.subject && headerCertParams.subject === desiredCertParams.subject &&
            headerCertParams.issuer && headerCertParams.issuer === desiredCertParams.issuer;
    });
    return {
        authenticated: isValid,
        tenantId: headerCertParams.tenantId,
        issuer: headerCertParams.issuer,
        subject: headerCertParams.subject
    };
};

const extractPemFromHeader = (headerValue: string) => {
    const parts = headerValue.split(';');
    const certPart = parts.find(part => part.startsWith('Cert="'));
    if (!certPart) {
        throw new Error('Certificate part not found in header');
    }
    const encodedCert = certPart.slice(6, -1); // Remove Cert=" at the start and " at the end
    const decodedCert = decodeURIComponent(encodedCert);
    return decodedCert;
};
