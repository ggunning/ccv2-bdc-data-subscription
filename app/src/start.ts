import { logger, loggerMiddleware } from '@bdc-fos/fos-logger';
import express from 'express';
import helmet from 'helmet';
import passport from 'passport';
import { createDataSubscription, deleteDataSubscription, getAllDataSubscriptions, getDataSubscription, updateDataSubscription } from './api';
import { errorHandler, handleErrors, requireId, setDefaultHeaders } from './common';
import { getHealth, getLiveness, getReadiness } from './health-api';
import { attachNext, auditMW } from './services/audit-service';
import { verifyCertificateMtls } from './mtls';
import { Strategy } from 'passport-custom';
import process from 'node:process';

passport.use('mtls-auth', new Strategy(verifyCertificateMtls));

export const app = express();

// ✅ **1️⃣ Log All Incoming Requests (Before Any Middleware)**
app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.method} ${req.url}`);
    logger.info(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    logger.info(`Body: ${JSON.stringify(req.body, null, 2)}`);
    next();
});

app.use(helmet()); // https://helmetjs.github.io
app.use(loggerMiddleware);
app.use(setDefaultHeaders);
app.set('etag', false); // switch off default express behavior, where eTag is generated based on response payload

// Health api
app.get('/probes/health', getHealth);
app.get('/probes/health/liveness', getReadiness);
app.get('/probes/health/readiness', getLiveness);


app.use('/v0/dataSubscriptions', passport.authenticate('mtls-auth', { session: false }));
app.use('/v0/dataSubscriptions', express.json());
app.post('/v0/dataSubscriptions', attachNext(createDataSubscription), auditMW('dsapiSubscription', 'dataSubscriptions'));
app.get('/v0/dataSubscriptions', getAllDataSubscriptions);
app.get('/v0/dataSubscriptions/:id', requireId, getDataSubscription);
app.patch('/v0/dataSubscriptions/:id', requireId, attachNext(updateDataSubscription), auditMW('dsapiSubscription', 'dataSubscriptions'));
app.delete('/v0/dataSubscriptions/:id', requireId, attachNext(deleteDataSubscription), auditMW('dsapiSubscription', 'dataSubscriptions'));

app.use(errorHandler);

// Tell jest to ignore next block for coverage because it will never be executed in test environment
/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, '0.0.0.0', () => {
        logger.info(`Server listening on port: ${port}`);
    });
    handleErrors(process);
}