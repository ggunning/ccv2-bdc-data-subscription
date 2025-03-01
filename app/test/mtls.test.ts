import express from 'express';
import { verifyCertificateMtls } from '../src/mtls';
import * as mtls from '../src/mtls';

const desiredtenantId = 'tenantId_123';
const desiredIssuer = 'C=DE,L=EU10-Canary,O=SAP SE,OU=SAP Cloud Platform Clients,CN=SAP Cloud Platform Client CA';
const desiredSubject = 'C=DE,O=SAP SE,OU=SAP Cloud Platform Clients,OU=Canary,OU=62fd854b-feb2-431b-95b2-f12956844bf4,L=eu11,CN=f09aa9e8-dcf1-48ae-ace2-ec4eb6125a07';
process.env.CERTS_DETAILS = JSON.stringify([{ tenantId: "someStr1", issuer: "someStr2", subject: "someStr3" },{ tenantId: desiredtenantId, issuer: desiredIssuer, subject: desiredSubject }]);

jest.mock('@bdc-fos/fos-logger');

describe('verifyCertificateMtls', () => {
    let req: express.Request;
    let done: jest.Mock;

    const pem = `-----BEGIN CERTIFICATE-----
MIIF3DCCA8SgAwIBAgIRAKUSLvgBhSUOoiH9xSJYX1EwDQYJKoZIhvcNAQELBQAw
gYAxCzAJBgNVBAYTAkRFMRQwEgYDVQQHDAtFVTEwLUNhbmFyeTEPMA0GA1UECgwG
U0FQIFNFMSMwIQYDVQQLDBpTQVAgQ2xvdWQgUGxhdGZvcm0gQ2xpZW50czElMCMG
A1UEAwwcU0FQIENsb3VkIFBsYXRmb3JtIENsaWVudCBDQTAeFw0yNTAyMTExMTI2
NThaFw0yNjAyMTExMjI2NThaMIHBMQswCQYDVQQGEwJERTEPMA0GA1UECgwGU0FQ
IFNFMSMwIQYDVQQLDBpTQVAgQ2xvdWQgUGxhdGZvcm0gQ2xpZW50czEPMA0GA1UE
CwwGQ2FuYXJ5MS0wKwYDVQQLDCQ2MmZkODU0Yi1mZWIyLTQzMWItOTViMi1mMTI5
NTY4NDRiZjQxDTALBgNVBAcMBGV1MTExLTArBgNVBAMMJGYwOWFhOWU4LWRjZjEt
NDhhZS1hY2UyLWVjNGViNjEyNWEwNzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC
AQoCggEBAOSsiv0tsxdzSklJlLUwRL4QnjKB5m2EkHQ+XyVJfgoSTQsKYE/CXOZI
z/EhZoXNxQk3OVy0+5CgWkyV2f1PXqcoMgmRurq5UPp3VPBE2lkLEDENvxupeYjm
HrgiArj8+A23nn/HxFkEoPdQ+uNmcLQps7a6xvSuq9jTsd3pbbxtHh5/iTNy+zlW
zVcRwN6JpyBApFhXuxSyy6Va2ZudfxT1eqknNBy974E+YxN7832PFgrGwzZFGzdm
nk0704U4hjsxtaRdHQO//TkSd0GtIzERvuG5ESOn4FV5p472uk/dfffXgHGFKXY8
dgmUtIGFboFAOcaknnqOexNldryj/3cCAwEAAaOCAQwwggEIMAkGA1UdEwQCMAAw
HwYDVR0jBBgwFoAUR7zXK6QaXuhfBYbTL0NvipRO6M0wHQYDVR0OBBYEFJWCzJHg
wzawz7c0XhlCc9t9IUnsMA4GA1UdDwEB/wQEAwIFoDATBgNVHSUEDDAKBggrBgEF
BQcDAjCBlQYDVR0fBIGNMIGKMIGHoIGEoIGBhn9odHRwOi8vc2FwLWNsb3VkLXBs
YXRmb3JtLWNsaWVudC1jYS1ldTEwLWNhbmFyeS1jcmxzLnMzLmV1LWNlbnRyYWwt
MS5hbWF6b25hd3MuY29tL2NybC9kM2NhYzY3Mi05M2YyLTQxZjAtYTI1Ni01MWQw
YzgxMmZlYjIuY3JsMA0GCSqGSIb3DQEBCwUAA4ICAQBfU7pk2dY2B5KRJao6id9b
onz1Z9dtYuyTlVPYngYSELtAVvINHqLNmAy5O0gHsjwgsSGgBjj53QAkMMKU3QJe
S1GzRvKk97yFkkAptNX+Q46eze5dS3iFGHxUwSztJQNFH/c1BWyqO6lj5m2q858F
cseBu0SmAM3IEfjEKjA5whTB/MXJIuyd58Wv4qhFaN/+yiFye3NAQ+OW6GbcC1Kf
ycAU2oX72nH0gPj8b/GIw12TbeeCxEX8U1RcCHh5UDiaqk0FbBBERVjpQ3oHl8pp
l09LvA+41TrLC3ZniOjJ6NEANFQFMGwVoytiDdG0Nqhh4k52Kq5nQVXtQAPyMaX0
dfQx/QWnoKgdHhVGOKKUrZ6bNIRXVsmAE0/sk/GqCWa4yJyhLIMnzMMUf5ZJn/dS
5NK4pcDaLyh9VfnAfdgE/f5nvC8v2efy7tycEYhEM1pyASvdfoetv/18+AATseTf
CTHJk3rQDs6nNGRrEqwdAsPWtupYh5r2WoGwHK6gnKlk0XxwRUeFRidXQLRF/cNe
UCGIjJQA0Ufv5b7ytoen6p67QYgMlmKb6ZDBNK6V/w10m79/hxLj4jQZ3PBvpvde
SWyTmNCBejr3D5Ng6lVYgSQ1edFJP+swZPbUQJgR7bNJlRM418lPSBDIL/nSqPGC
ufyiGBiEVMrWHVZtkw/jOA==
-----END CERTIFICATE-----`;

    beforeEach(() => {
        req = {
            headers: {
                'x-forwarded-client-cert': 'a=a;Cert="' + pem + '";b=b',
                'bdcfos-producer-tenantid': desiredtenantId 
            }
        } as unknown as express.Request;
        done = jest.fn();
    });

    it('should authenticate and call done with tenantId, issuer and subject', () => {
        mtls.verifyCertificateMtls(req, done);
        expect(done).toHaveBeenCalledWith(null, {
            tenantId: desiredtenantId,
            issuer: desiredIssuer,
            subject: desiredSubject,
        });
    });

    it('should not authenticate and call done with null - desired issue differs', () => {
        process.env.CERTS_DETAILS = JSON.stringify([{ issuer: 'InvalidIssuer', subject: desiredSubject }]);
        verifyCertificateMtls(req, done);
        expect(done).toHaveBeenCalledWith(null, null);
    });

    it('should not authenticate and call done with null - desired subject differs', () => {
        process.env.CERTS_DETAILS = JSON.stringify([{ issuer: desiredIssuer, subject: 'InvalidSubject' }]);
        verifyCertificateMtls(req, done);
        expect(done).toHaveBeenCalledWith(null, null);
    });

    it('should not authenticate and call done with null - desired tenandId differs', () => {
        req.headers['bdcfos-producer-tenantid'] = 'InvalidTenantId';
        verifyCertificateMtls(req, done);
        expect(done).toHaveBeenCalledWith(null, null);
    });

    it('should throw an error if certificate part is not found in header', () => {
        req.headers['x-forwarded-client-cert'] = 'InvalidHeader';
        verifyCertificateMtls(req, done);
        expect(done).toHaveBeenCalledWith(null, null);
    });
});
