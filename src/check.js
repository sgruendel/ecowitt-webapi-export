import moment from 'moment';
import winston from 'winston';
import process from 'node:process';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
    exitOnError: false,
});

import * as db from './db.js';

const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm:ss';
const DATE_TIME_FORMAT = DATE_FORMAT + ' ' + TIME_FORMAT;

async function findMissingData() {
    const pageSize = 1000;
    let start = 0;
    let reportstoRead = true;
    while (reportstoRead) {
        const reports = await db.Report.find()
            .sort({ dateutc: -1 })
            .skip(start)
            .limit(pageSize + 1)
            .exec();

        let prevDate;
        reports.forEach((report) => {
            const date = moment(report.dateutc);
            if (prevDate) {
                const compDate = moment(date).add(10, 'minutes');
                if (compDate.isBefore(prevDate)) {
                    logger.info(prevDate.format(DATE_TIME_FORMAT) + ' / ' + date.format(DATE_TIME_FORMAT));
                    logger.info(' => ' + compDate.format(DATE_TIME_FORMAT));
                }
            }
            prevDate = date;
        });
        start += pageSize;
        reportstoRead = reports.length > pageSize;
    }
    db.disconnect();
}

async function findDuplicateData() {
    const pageSize = 1000;
    let start = 0;
    let reportstoRead = true;
    while (reportstoRead) {
        logger.info(start + ' ...');
        const reports = await db.Report.find()
            .sort({ dateutc: 1 })
            .skip(start)
            .limit(pageSize + 1)
            .exec();

        let deleted = false;
        for (let i = 0; i < reports.length; i++) {
            const report = reports[i];
            const sameDateReports = await db.Report.find({ dateutc: report.dateutc }).sort({ dateutc: 1 }).exec();
            if (sameDateReports.length > 1) {
                const sameDateReport = sameDateReports[0];
                logger.info(
                    'deleting 1 of ' +
                        sameDateReports.length +
                        ' at ' +
                        moment(sameDateReport.dateutc).format(DATE_TIME_FORMAT),
                );
                const res = await db.Report.deleteOne({ _id: sameDateReport._id });
                console.log(res);
                deleted = deleted || res.deletedCount > 0;
            }
        }

        if (!deleted) {
            start += pageSize;
        }
        reportstoRead = reports.length > pageSize;
    }
    db.disconnect();
}

// find reports more than 10 minutes apart and log them
findMissingData();

// delete data from same date, happened during development without unique index
// findDuplicateData();
