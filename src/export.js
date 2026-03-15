import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import winston from 'winston';

import * as db from './db.js';
import { fetchReportsSince } from './ecowitt.js';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
    transports: [new winston.transports.Console()],
    exitOnError: false,
});

async function getStartDate() {
    const latestReport = await db.Report.findOne({}).sort({ dateutc: -1 }).exec();
    if (latestReport?.dateutc) {
        logger.info('latest report ' + latestReport.dateutc);
        return latestReport.dateutc;
    }

    if (process.env.START_DATE) {
        logger.info('using START_DATE ' + process.env.START_DATE);
        return new Date(process.env.START_DATE);
    }

    throw new Error('No latest report found. Set START_DATE for the initial import.');
}

/**
 * @param {import('./ecowitt.js').ReportData[]} reports
 */
async function importReports(reports) {
    const allPromises = reports.map((report) =>
        db.Report.create(report)
            .then((doc) => logger.debug('inserted ' + doc.dateutc))
            .catch((err) => {
                if (err.code !== 11000) {
                    logger.error('error writing report', err);
                    logger.error('report', report);
                    throw err;
                }
            }),
    );

    logger.debug('all promises: ' + allPromises.length);
    return Promise.all(allPromises);
}

export async function main() {
    try {
        const startDate = await getStartDate();
        const reports = await fetchReportsSince({
            account: process.env.ACCOUNT,
            password: process.env.PASSWORD,
            deviceId: process.env.DEVICEID,
            startDate,
            logger,
        });

        await importReports(reports);
        logger.info('done, waiting to finish ...');
    } finally {
        db.disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        logger.error(err);
        process.exitCode = 1;
    });
}
