'use strict';

const moment = require('moment');
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
    exitOnError: false,
});

const db = require('./db');

const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm:ss';
const DATE_TIME_FORMAT = DATE_FORMAT + ' ' + TIME_FORMAT;

async function findMissingData() {

    const pageSize = 1000;
    let start = 0;
    let reportstoRead = true;
    while (reportstoRead) {
        const reports = await db.Report.find().sort({dateutc: -1}).skip(start).limit(pageSize + 1).exec();

        let prevDate;
        reports.forEach(report => {
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

// find reports more than 10 minutes apart and log them
findMissingData();
