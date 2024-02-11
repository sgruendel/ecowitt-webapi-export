'use strict';

const moment = require('moment');
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
    exitOnError: false,
});

const db = require('./db');

const httpAgent = new http.Agent({
    keepAlive: true,
});
const httpsAgent = new https.Agent({
    keepAlive: true,
});

const DATE_FORMAT = 'YYYY-MM-DD';

const APPLICATION_KEY = 'B74AF19568B841B142D4D6649D5FDCA2';
const API_KEY = '8019c365-ec36-479a-9732-a7b7ae670218';
const MAC = '88:4A:18:5B:79:1D';
const BASE_URL_API = 'https://cdnapi.ecowitt.net/api/v3/';
const BASE_URL_WEB = 'https://webapi.www.ecowitt.net/';

function convertTempToF(t, unit) {
    if (unit === '℃') {
        return (t * 9) / 5 + 32;
    } else {
        throw Error('unsupported unit: ' + unit);
    }
}

async function exportDataRealApi(deviceId) {
    const options = {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        },
        agent: (_parsedURL) => {
            return _parsedURL.protocol === 'http:' ? httpAgent : httpsAgent;
        },
    };
    const qs = {
        application_key: APPLICATION_KEY,
        api_key: API_KEY,
        mac: MAC,
        start_date: '2023-02-26 00:00:00',
        end_date: '2023-02-26 23:59:59',
        cycle_type: 'auto',
        call_back: 'outdoor,indoor',
    };
    logger.debug('calling ' + querystring.stringify(qs));
    const response = await fetch(BASE_URL_API + 'device/history?' + querystring.stringify(qs), options);
    return response.json();
}

async function loginWeb(account, password) {
    const params = new URLSearchParams();
    params.append('account', account);
    params.append('password', password);

    const options = {
        method: 'POST',
        body: params,
        agent: (_parsedURL) => {
            return _parsedURL.protocol === 'http:' ? httpAgent : httpsAgent;
        },
    };
    const loginUrl = BASE_URL_WEB + 'user/site/login';
    logger.debug('calling ' + loginUrl + ' for ' + account);
    const response = await fetch(loginUrl, options);
    if (response.ok) {
        const data = await response.json();
        if (data.errcode === '0') {
            const setCookie = response.headers.raw()['set-cookie'];
            logger.debug(setCookie);

            return setCookie
                .map((entry) => {
                    const parts = entry.split(';');
                    const cookiePart = parts[0];
                    return cookiePart;
                })
                .join(';');
        }
    }
}

async function exportDataWeb(account, password, deviceId) {
    const cookies = await loginWeb(account, password);

    const latestReport = (await db.Report.find({}).sort({ dateutc: -1 }).limit(1))[0];
    logger.info('latest report ' + latestReport.dateutc);
    let allPromises = [];

    let today = moment();
    for (let day = moment(latestReport.dateutc); day.isBefore(today); day.add(1, 'days')) {
        const params = new URLSearchParams();
        params.append('device_id', deviceId);
        params.append('is_list', 0);
        params.append('mode', 0);
        params.append('sdate', day.format(DATE_FORMAT) + ' 00:00');
        params.append('edate', day.format(DATE_FORMAT) + ' 23:59');
        params.append('page', 1);

        const options = {
            headers: {
                cookie: cookies,
            },
            method: 'POST',
            body: params,
            agent: (_parsedURL) => {
                return _parsedURL.protocol === 'http:' ? httpAgent : httpsAgent;
            },
        };
        const getDataUrl = BASE_URL_WEB + 'index/get_data';
        logger.debug('calling ' + getDataUrl + ' / ' + options.body);
        const response = await fetch(getDataUrl, options);
        if (response.ok) {
            const data = await response.json();
            if (data.errcode === '0') {
                for (let i = 0; i < data.times.length; i++) {
                    if (data.list.tempf.list.tempf[i]) {
                        if (data.list.wind_speed.list.windgustmph[i]) {
                            data.list.wind_speed.list.windgustmph[i] = '0.0';
                        }
                        const report = {
                            deviceId: deviceId,
                            dateutc: data.times[i],
                            temp: data.list.tempf.list.tempf[i],
                            sendible_temp: data.list.tempf.list.sendible_temp[i],
                            drew_temp: data.list.tempf.list.drew_temp[i],
                            temp_unit: data.list.tempf.units,
                            humidity: data.list.humidity.list.humidity[i],
                            humidity_unit: data.list.humidity.units,
                            tempin: data.list.tempinf.list.tempinf[i],
                            tempin_unit: data.list.tempinf.units,
                            humidityin: data.list.humidityin.list.humidityin[i],
                            humidityin_unit: data.list.humidityin.units,
                            rainrate: data.list.rain.list.rainratein[i],
                            rainrate_unit: data.list.rain.units,
                            dailyrain: data.list.rain.list.dailyrainin[i],
                            weeklyrain: data.list.rain_statistcs.list.weeklyrainin[i],
                            monthlyrain: data.list.rain_statistcs.list.monthlyrainin[i],
                            yearlyrain: data.list.rain_statistcs.list.yearlyrainin[i],
                            rain_unit: data.list.rain_statistcs.units,
                            windspeed: data.list.wind_speed.list.windspeedmph[i],
                            windgust: data.list.wind_speed.list.windgustmph[i],
                            wind_unit: data.list.wind_speed.units,
                            winddir: data.list.winddir.list.winddir[i],
                            winddir_unit: data.list.winddir.units,
                            pressurerel: data.list.pressure.list.baromrelin[i],
                            pressureabs: data.list.pressure.list.baromabsin[i],
                            pressure_unit: data.list.pressure.units,
                            battery: data.list.ws1900batt_dash.list.ws1900batt[i],
                        };

                        if (isNaN(report.temp)) {
                            logger.info('skipping ' + i, report);
                        } else {
                            const promise = db.Report.create(report)
                                .then((doc) => logger.debug('inserted ' + doc.dateutc))
                                .catch((err) => {
                                    if (err.code === 11000) {
                                        // logger.error('duplicate report for ' + report.dateutc);
                                    } else {
                                        logger.error('error writing report', err);
                                        logger.error('report', report);
                                        throw err;
                                    }
                                });
                            allPromises.push(promise);
                        }
                    }
                }
            } else {
                logger.error(data.errcode, data);
            }
        }
    }

    logger.debug('all promises: ' + allPromises.length);
    return await Promise.all(allPromises);
}

exportDataWeb(process.env.ACCOUNT, process.env.PASSWORD, process.env.DEVICEID).then(() => {
    logger.info('done, waiting to finish ...');
    db.disconnect();
});
