import http from 'node:http';
import https from 'node:https';
import moment from 'moment';
import fetch from 'node-fetch';

const DATE_FORMAT = 'YYYY-MM-DD';
export const BASE_URL_WEB = 'https://www.ecowitt.net/';

const httpAgent = new http.Agent({
    keepAlive: true,
});
const httpsAgent = new https.Agent({
    keepAlive: true,
});

const noopLogger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
};

/**
 * @typedef {Object} EcowittLogger
 * @property {(...args: any[]) => void} debug
 * @property {(...args: any[]) => void} info
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} error
 */

/**
 * @typedef {{ raw?: () => { 'set-cookie'?: string[] } }} EcowittHeaders
 */

/**
 * @typedef {Object} EcowittResponse
 * @property {boolean} ok
 * @property {number} status
 * @property {EcowittHeaders} headers
 * @property {() => Promise<any>} json
 */

/**
 * @typedef {Object} EcowittRequestOptions
 * @property {string} [method]
 * @property {Record<string, string>} [headers]
 * @property {URLSearchParams} [body]
 * @property {(parsedUrl: URL) => http.Agent | https.Agent} [agent]
 */

/**
 * @typedef {(url: URL | RequestInfo, init?: EcowittRequestOptions) => Promise<EcowittResponse>} EcowittFetch
 */

/**
 * @typedef {Object} EcowittApiResult
 * @property {string} errcode
 */

/**
 * @typedef {Object} ReportData
 * @property {number} deviceId
 * @property {Date} dateutc
 * @property {number} temp
 * @property {number} sendible_temp
 * @property {number} drew_temp
 * @property {string} temp_unit
 * @property {number} humidity
 * @property {string} humidity_unit
 * @property {number} tempin
 * @property {string} tempin_unit
 * @property {number} humidityin
 * @property {string} humidityin_unit
 * @property {number} rainrate
 * @property {string} rainrate_unit
 * @property {number} dailyrain
 * @property {number} weeklyrain
 * @property {number} monthlyrain
 * @property {number} yearlyrain
 * @property {string} rain_unit
 * @property {number} windspeed
 * @property {number} windgust
 * @property {string} wind_unit
 * @property {number} winddir
 * @property {string} winddir_unit
 * @property {number} pressurerel
 * @property {number} pressureabs
 * @property {string} pressure_unit
 * @property {number} battery
 */

/**
 * @typedef {Date | import('moment').Moment} EcowittDay
 */

/**
 * @param {EcowittLogger | undefined} logger
 * @returns {EcowittLogger}
 */
function getLogger(logger) {
    return logger ?? noopLogger;
}

/**
 * @param {URL} parsedUrl
 */
function createAgent(parsedUrl) {
    return parsedUrl.protocol === 'http:' ? httpAgent : httpsAgent;
}

/**
 * @param {EcowittRequestOptions} [options]
 * @returns {EcowittRequestOptions}
 */
function createRequestOptions({ method = 'GET', headers = {}, body } = {}) {
    return {
        method,
        headers,
        body,
        agent: createAgent,
    };
}

/**
 * @param {EcowittResponse} response
 */
function parseCookies(response) {
    const rawHeaders = response.headers?.raw?.();
    const setCookie = rawHeaders?.['set-cookie'];

    if (!Array.isArray(setCookie) || setCookie.length === 0) {
        throw new Error('Ecowitt login did not return cookies');
    }

    return setCookie
        .map((entry) => {
            const parts = entry.split(';');
            return parts[0];
        })
        .join(';');
}

function toNumber(value, defaultValue = Number.NaN) {
    if (typeof value === 'number') {
        return value;
    }

    if (value === undefined || value === null || value === '' || value === '-') {
        return defaultValue;
    }

    return Number(value);
}

function getMetricValue(list, key, index) {
    return list?.[key]?.[index];
}

function getUnit(value) {
    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
}

export function listDaysToFetch(startDate, now = new Date()) {
    if (!startDate) {
        return [];
    }

    const today = moment(now);
    const days = [];

    for (let day = moment(startDate); day.isBefore(today); day.add(1, 'days')) {
        days.push(day.clone());
    }

    return days;
}

/**
 * @param {number|string} deviceId
 * @param {EcowittDay} day
 */
export function buildDailyParams(deviceId, day) {
    const currentDay = moment(day);
    const params = new URLSearchParams();

    params.append('device_id', String(deviceId));
    params.append('is_list', '0');
    params.append('mode', '0');
    params.append('sdate', currentDay.format(DATE_FORMAT) + ' 00:00');
    params.append('edate', currentDay.format(DATE_FORMAT) + ' 23:59');
    params.append('page', '1');

    return params;
}

/**
 * @param {EcowittResponse} response
 * @returns {Promise<EcowittApiResult & any>}
 */
async function parseJsonResponse(response) {
    return /** @type {Promise<EcowittApiResult & any>} */ (response.json());
}

/**
 * @param {{ account: string, password: string, fetchImpl?: EcowittFetch, logger?: EcowittLogger, baseUrl?: string }} options
 */
export async function loginWeb({
    account,
    password,
    fetchImpl = /** @type {EcowittFetch} */ (fetch),
    logger,
    baseUrl = BASE_URL_WEB,
}) {
    const activeLogger = getLogger(logger);

    if (!account || !password) {
        throw new Error('Ecowitt account and password are required');
    }

    const params = new URLSearchParams();
    params.append('account', account);
    params.append('password', password);

    const loginUrl = new URL('user/site/login', baseUrl).toString();
    activeLogger.debug('calling ' + loginUrl + ' for ' + account);

    const response = await fetchImpl(loginUrl, createRequestOptions({ method: 'POST', body: params }));
    if (!response.ok) {
        throw new Error('Ecowitt login failed with status ' + response.status);
    }

    const data = await parseJsonResponse(response);
    if (data.errcode !== '0') {
        activeLogger.error(data.errcode, data);
        throw new Error('Ecowitt login failed with errcode ' + data.errcode);
    }

    return parseCookies(response);
}

/**
 * @param {{ deviceId: number|string, day: EcowittDay, cookies: string, fetchImpl?: EcowittFetch, logger?: EcowittLogger, baseUrl?: string }} options
 */
export async function fetchWeatherDay({
    deviceId,
    day,
    cookies,
    fetchImpl = /** @type {EcowittFetch} */ (fetch),
    logger,
    baseUrl = BASE_URL_WEB,
}) {
    const activeLogger = getLogger(logger);

    if (!deviceId) {
        throw new Error('Ecowitt deviceId is required');
    }
    if (!cookies) {
        throw new Error('Ecowitt cookies are required');
    }

    const params = buildDailyParams(deviceId, day);
    const getDataUrl = new URL('index/get_data', baseUrl).toString();
    activeLogger.debug('calling ' + getDataUrl + ' / ' + params.toString());

    const response = await fetchImpl(
        getDataUrl,
        createRequestOptions({
            method: 'POST',
            headers: {
                cookie: cookies,
            },
            body: params,
        }),
    );

    if (!response.ok) {
        throw new Error('Ecowitt day fetch failed with status ' + response.status);
    }

    const data = await parseJsonResponse(response);
    if (data.errcode !== '0') {
        activeLogger.error(data.errcode, data);
        throw new Error('Ecowitt day fetch failed with errcode ' + data.errcode);
    }

    return data;
}

/**
 * @param {number|string} deviceId
 * @param {any} weatherData
 * @returns {ReportData[]}
 */
export function mapWeatherResponseToReports(deviceId, weatherData) {
    const reports = [];
    const times = weatherData?.times ?? [];
    const list = weatherData?.list ?? {};

    for (let index = 0; index < times.length; index += 1) {
        const temp = getMetricValue(list.tempf?.list, 'tempf', index);
        if (!temp || temp === '-') {
            continue;
        }

        reports.push({
            deviceId: toNumber(deviceId),
            dateutc: new Date(times[index]),
            temp: toNumber(temp),
            sendible_temp: toNumber(getMetricValue(list.tempf?.list, 'sendible_temp', index)),
            drew_temp: toNumber(getMetricValue(list.tempf?.list, 'drew_temp', index)),
            temp_unit: getUnit(list.tempf?.units),
            humidity: toNumber(getMetricValue(list.humidity?.list, 'humidity', index)),
            humidity_unit: getUnit(list.humidity?.units),
            tempin: toNumber(getMetricValue(list.tempinf?.list, 'tempinf', index)),
            tempin_unit: getUnit(list.tempinf?.units),
            humidityin: toNumber(getMetricValue(list.humidityin?.list, 'humidityin', index)),
            humidityin_unit: getUnit(list.humidityin?.units),
            rainrate: toNumber(getMetricValue(list.rain?.list, 'rainratein', index)),
            rainrate_unit: getUnit(list.rain?.units),
            dailyrain: toNumber(getMetricValue(list.rain?.list, 'dailyrainin', index)),
            weeklyrain: toNumber(getMetricValue(list.rain_statistcs?.list, 'weeklyrainin', index)),
            monthlyrain: toNumber(getMetricValue(list.rain_statistcs?.list, 'monthlyrainin', index)),
            yearlyrain: toNumber(getMetricValue(list.rain_statistcs?.list, 'yearlyrainin', index)),
            rain_unit: getUnit(list.rain_statistcs?.units),
            windspeed: toNumber(getMetricValue(list.wind_speed?.list, 'windspeedmph', index), 0),
            windgust: toNumber(getMetricValue(list.wind_speed?.list, 'windgustmph', index), 0),
            wind_unit: getUnit(list.wind_speed?.units),
            winddir: toNumber(getMetricValue(list.winddir?.list, 'winddir', index), 0),
            winddir_unit: getUnit(list.winddir?.units),
            pressurerel: toNumber(getMetricValue(list.pressure?.list, 'baromrelin', index)),
            pressureabs: toNumber(getMetricValue(list.pressure?.list, 'baromabsin', index)),
            pressure_unit: getUnit(list.pressure?.units),
            battery: toNumber(getMetricValue(list.ws1900batt_dash?.list, 'ws1900batt', index), 0),
        });
    }

    return reports;
}

/**
 * @param {{ account: string, password: string, deviceId: number|string, startDate: Date, now?: Date, fetchImpl?: EcowittFetch, logger?: EcowittLogger, baseUrl?: string }} options
 */
export async function fetchReportsSince({
    account,
    password,
    deviceId,
    startDate,
    now = new Date(),
    fetchImpl = /** @type {EcowittFetch} */ (fetch),
    logger,
    baseUrl = BASE_URL_WEB,
}) {
    const cookies = await loginWeb({ account, password, fetchImpl, logger, baseUrl });
    const days = listDaysToFetch(startDate, now);
    const reports = [];

    for (const day of days) {
        const weatherData = await fetchWeatherDay({
            deviceId,
            day,
            cookies,
            fetchImpl,
            logger,
            baseUrl,
        });
        reports.push(...mapWeatherResponseToReports(deviceId, weatherData));
    }

    return reports;
}
