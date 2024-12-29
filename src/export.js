import process from 'node:process';
import moment from 'moment';
import fetch from 'node-fetch';
import http from 'http';
import https from 'https';
import querystring from 'querystring';
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
    transports: [new winston.transports.Console()],
    exitOnError: false,
});

import * as db from './db.js';

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
const BASE_URL_WEB = 'https://www.ecowitt.net/';

/**
 * @typedef {Object} LoginResponse
 * @property {string} errcode - Error code.
 * @property {string} errmsg - Error message.
 * @property {string} uid - User ID.
 * @property {string} session_key - Session key.
 * @property {number} expires_in - Expiration time in seconds.
 * @property {string} version - Version information.
 * @property {Object} action - Action details.
 * @property {string} action.to - Destination of the action.
 * @property {number} action.deviceid - Device ID.
 */

/**
 * @typedef {Object} WeatherData
 * @property {string} errcode - The error code.
 * @property {string} errmsg - The error message.
 * @property {Object} list - Object containing weather data.
 * @property {Object} list.tempinf - Information about indoor temperature.
 * @property {number} list.tempinf.dash - Dash value for indoor temperature.
 * @property {string} list.tempinf.title - Title for indoor temperature.
 * @property {Object} list.tempinf.list - List of indoor temperature values.
 * @property {string[]} list.tempinf.list.tempinf - Array of indoor temperature values.
 * @property {string[]} list.tempinf.title_arr - Title array for indoor temperature.
 * @property {string} list.tempinf.units - Units for indoor temperature.
 * @property {Object} list.tempinf.ysize - Y-size for indoor temperature.
 * @property {number} list.tempinf.ysize.min - Minimum value for y-size of indoor temperature.
 * @property {number} list.tempinf.ysize.max - Maximum value for y-size of indoor temperature.
 * @property {string} list.tempinf.ysize.intval - Interval value for y-size of indoor temperature.
 * @property {Object} list.humidityin - Information about indoor humidity.
 * @property {number} list.humidityin.dash - Dash value for indoor humidity.
 * @property {string} list.humidityin.title - Title for indoor humidity.
 * @property {Object} list.humidityin.list - List of indoor humidity values.
 * @property {number[]} list.humidityin.list.humidityin - Array of indoor humidity values.
 * @property {string[]} list.humidityin.title_arr - Title array for indoor humidity.
 * @property {string} list.humidityin.units - Units for indoor humidity.
 * @property {Object} list.humidityin.ysize - Y-size for indoor humidity.
 * @property {number} list.humidityin.ysize.min - Minimum value for y-size of indoor humidity.
 * @property {number} list.humidityin.ysize.max - Maximum value for y-size of indoor humidity.
 * @property {number} list.humidityin.ysize.intval - Interval value for y-size of indoor humidity.
 * @property {Object} list.pressure - Information about pressure.
 * @property {number} list.pressure.dash - Dash value for pressure.
 * @property {string} list.pressure.title - Title for pressure.
 * @property {Object} list.pressure.list - List of pressure values.
 * @property {string[]} list.pressure.list.baromrelin - Array of relative pressure values.
 * @property {string[]} list.pressure.list.baromabsin - Array of absolute pressure values.
 * @property {string[]} list.pressure.title_arr - Title array for pressure.
 * @property {string} list.pressure.units - Units for pressure.
 * @property {Object} list.pressure.ysize - Y-size for pressure.
 * @property {number} list.pressure.ysize.min - Minimum value for y-size of pressure.
 * @property {number} list.pressure.ysize.max - Maximum value for y-size of pressure.
 * @property {string} list.pressure.ysize.intval - Interval value for y-size of pressure.
 * @property {Object} list.tempf - Information about outdoor temperature.
 * @property {number} list.tempf.dash - Dash value for outdoor temperature.
 * @property {string} list.tempf.title - Title for outdoor temperature.
 * @property {Object} list.tempf.list - List of outdoor temperature values.
 * @property {string[]} list.tempf.list.tempf - Array of outdoor temperature values.
 * @property {string[]} list.tempf.list.sendible_temp - Array of feels like temperature values.
 * @property {string[]} list.tempf.list.drew_temp - Array of dew point temperature values.
 * @property {string[]} list.tempf.title_arr - Title array for outdoor temperature.
 * @property {string} list.tempf.units - Units for outdoor temperature.
 * @property {Object} list.tempf.ysize - Y-size for outdoor temperature.
 * @property {number} list.tempf.ysize.min - Minimum value for y-size of outdoor temperature.
 * @property {number} list.tempf.ysize.max - Maximum value for y-size of outdoor temperature.
 * @property {string} list.tempf.ysize.intval - Interval value for y-size of outdoor temperature.
 * @property {Object} list.humidity - Information about outdoor humidity.
 * @property {number} list.humidity.dash - Dash value for outdoor humidity.
 * @property {string} list.humidity.title - Title for outdoor humidity.
 * @property {Object} list.humidity.list - List of outdoor humidity values.
 * @property {number[]} list.humidity.list.humidity - Array of outdoor humidity values.
 * @property {string[]} list.humidity.title_arr - Title array for outdoor humidity.
 * @property {string} list.humidity.units - Units for outdoor humidity.
 * @property {Object} list.humidity.ysize - Y-size for outdoor humidity.
 * @property {number} list.humidity.ysize.min - Minimum value for y-size of outdoor humidity.
 * @property {number} list.humidity.ysize.max - Maximum value for y-size of outdoor humidity.
 * @property {number} list.humidity.ysize.intval - Interval value for y-size of outdoor humidity.
 * @property {Object} list.wind_speed - Information about wind speed.
 * @property {number} list.wind_speed.dash - Dash value for wind speed.
 * @property {string} list.wind_speed.title - Title for wind speed.
 * @property {Object} list.wind_speed.list - List of wind speed values.
 * @property {string[]} list.wind_speed.list.windspeedmph - Array of wind speed values.
 * @property {string[]} list.wind_speed.list.windgustmph - Array of wind gust values.
 * @property {string[]} list.wind_speed.title_arr - Title array for wind speed.
 * @property {string} list.wind_speed.units - Units for wind speed.
 * @property {Object} list.wind_speed.ysize - Y-size for wind speed.
 * @property {number} list.wind_speed.ysize.min - Minimum value for y-size of wind speed.
 * @property {number} list.wind_speed.ysize.max - Maximum value for y-size of wind speed.
 * @property {string} list.wind_speed.ysize.intval - Interval value for y-size of wind speed.
 * @property {Object} list.winddir - Information about wind direction.
 * @property {number} list.winddir.dash - Dash value for wind direction.
 * @property {string} list.winddir.title - Title for wind direction.
 * @property {Object} list.winddir.list - List of wind direction values.
 * @property {number[]} list.winddir.list.winddir - Array of wind direction values.
 * @property {string[]} list.winddir.title_arr - Title array for wind direction.
 * @property {string} list.winddir.units - Units for wind direction.
 * @property {Object} list.winddir.ysize - Y-size for wind direction.
 * @property {number} list.winddir.ysize.min - Minimum value for y-size of wind direction.
 * @property {number} list.winddir.ysize.max - Maximum value for y-size of wind direction.
 * @property {number} list.winddir.ysize.intval - Interval value for y-size of wind direction.
 * @property {Object} list.rain - Information about rainfall.
 * @property {number} list.rain.dash - Dash value for rainfall.
 * @property {string} list.rain.title - Title for rainfall.
 * @property {Object} list.rain.list - List of rainfall values.
 * @property {string[]} list.rain.list.rainratein - Array of rain rate values.
 * @property {string[]} list.rain.list.dailyrainin - Array of daily rainfall values.
 * @property {string[]} list.rain.title_arr - Title array for rainfall.
 * @property {string} list.rain.units - Units for rainfall.
 * @property {Object} list.rain.ysize - Y-size for rainfall.
 * @property {number} list.rain.ysize.min - Minimum value for y-size of rainfall.
 * @property {number} list.rain.ysize.max - Maximum value for y-size of rainfall.
 * @property {string} list.rain.ysize.intval - Interval value for y-size of rainfall.
 * @property {Object} list.rain_statistcs - Information about rainfall statistics.
 * @property {number} list.rain_statistcs.dash - Dash value for rainfall statistics.
 * @property {string} list.rain_statistcs.title - Title for rainfall statistics.
 * @property {Object} list.rain_statistcs.list - List of rainfall statistics values.
 * @property {string[]} list.rain_statistcs.list.weeklyrainin - Array of weekly rainfall values.
 * @property {string[]} list.rain_statistcs.list.monthlyrainin - Array of monthly rainfall values.
 * @property {string[]} list.rain_statistcs.list.yearlyrainin - Array of yearly rainfall values.
 * @property {string[]} list.rain_statistcs.title_arr - Title array for rainfall statistics.
 * @property {string} list.rain_statistcs.units - Units for rainfall statistics.
 * @property {Object} list.rain_statistcs.ysize - Y-size for rainfall statistics.
 * @property {number} list.rain_statistcs.ysize.min - Minimum value for y-size of rainfall statistics.
 * @property {number} list.rain_statistcs.ysize.max - Maximum value for y-size of rainfall statistics.
 * @property {string} list.rain_statistcs.ysize.intval - Interval value for y-size of rainfall statistics.
 * @property {Object} list.ws1900batt_dash - Information about battery.
 * @property {number} list.ws1900batt_dash.dash - Dash value for battery.
 * @property {string} list.ws1900batt_dash.title - Title for battery.
 * @property {Object} list.ws1900batt_dash.list - List of battery values.
 * @property {string[]} list.ws1900batt_dash.list.ws1900batt - Array of battery values.
 * @property {string[]} list.ws1900batt_dash.title_arr - Title array for battery.
 * @property {string} list.ws1900batt_dash.units - Units for battery.
 * @property {Object} list.ws1900batt_dash.ysize - Y-size for battery.
 * @property {number} list.ws1900batt_dash.ysize.min - Minimum value for y-size of battery.
 * @property {number} list.ws1900batt_dash.ysize.max - Maximum value for y-size of battery.
 * @property {number} list.ws1900batt_dash.ysize.intval - Interval value for y-size of battery.
 * @property {string[]} times - Array of timestamps.
 * @property {string} mark_mod - Mark mod value.
 * @property {Object} timeDate - Time and date information.
 * @property {string} timeDate.timeformat_id - Time format ID.
 * @property {string} timeDate.shortdate_id - Short date ID.
 * @property {string} timeDate.longdate_id - Long date ID.
 * @property {string} timeDate.numberformat_id - Number format ID.
 */

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
        /** @type {LoginResponse} */
        // @ts-ignore
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
        } else {
            logger.error(data.errcode, data);
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
        params.append('is_list', '0');
        params.append('mode', '0');
        params.append('sdate', day.format(DATE_FORMAT) + ' 00:00');
        params.append('edate', day.format(DATE_FORMAT) + ' 23:59');
        params.append('page', '1');

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
            /** @type {WeatherData} */
            // @ts-ignore
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

                        if (report.temp === '-') {
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
