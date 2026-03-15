import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { fetchReportsSince, fetchWeatherDay, loginWeb, mapWeatherResponseToReports } from '../../src/ecowitt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = __dirname;

/**
 * @typedef {import('../../src/ecowitt.js').EcowittRequestOptions} EcowittRequestOptions
 * @typedef {import('../../src/ecowitt.js').EcowittResponse} EcowittResponse
 */

/**
 * @param {any} json
 * @param {{ ok?: boolean, status?: number, cookies?: string[] }} [options]
 * @returns {EcowittResponse}
 */
function createJsonResponse(json, { ok = true, status = 200, cookies = [] } = {}) {
    return /** @type {EcowittResponse} */ ({
        ok,
        status,
        headers: {
            raw() {
                return {
                    'set-cookie': cookies,
                };
            },
        },
        async json() {
            return json;
        },
    });
}

async function loadFixture(fileName) {
    const content = await readFile(path.join(fixtureDir, fileName), 'utf8');
    return JSON.parse(content);
}

function countValidTemperatures(weatherFixture) {
    return weatherFixture.list.tempf.list.tempf.filter((value) => value && value !== '-').length;
}

describe('ecowitt', function () {
    let weatherDayOneFixture;
    let weatherDayTwoFixture;

    before(async function () {
        [weatherDayOneFixture, weatherDayTwoFixture] = await Promise.all([
            loadFixture('weather-day-2026-03-13.json'),
            loadFixture('weather-day-2026-03-14.json'),
        ]);
    });

    describe('loginWeb', function () {
        it('returns combined cookies from the login response', async function () {
            let capturedUrl;
            /** @type {EcowittRequestOptions | undefined} */
            let capturedOptions;

            const cookies = await loginWeb({
                account: 'demo@example.com',
                password: 'secret',
                fetchImpl: async (url, options) => {
                    capturedUrl = url;
                    capturedOptions = options;
                    return createJsonResponse(
                        {
                            errcode: '0',
                            errmsg: 'Login success!',
                        },
                        {
                            cookies: ['session=abc; Path=/; HttpOnly', 'uid=123; Path=/'],
                        },
                    );
                },
            });

            expect(cookies).to.equal('session=abc;uid=123');
            expect(capturedUrl).to.equal('https://www.ecowitt.net/user/site/login');
            expect(capturedOptions).to.not.equal(undefined);
            expect(capturedOptions.method).to.equal('POST');
            expect(capturedOptions.body.toString()).to.equal('account=demo%40example.com&password=secret');
        });

        it('throws when Ecowitt returns a login error', async function () {
            const failingFixture = {
                errcode: '1001',
                errmsg: 'invalid login',
            };

            let error;

            try {
                await loginWeb({
                    account: 'demo@example.com',
                    password: 'wrong',
                    fetchImpl: async () => createJsonResponse(failingFixture),
                });
            } catch (err) {
                error = err;
            }

            expect(error).to.be.instanceOf(Error);
            expect(error.message).to.equal('Ecowitt login failed with errcode 1001');
        });
    });

    describe('fetchWeatherDay', function () {
        it('posts the expected params and cookie header for a day request', async function () {
            let capturedUrl;
            /** @type {EcowittRequestOptions | undefined} */
            let capturedOptions;

            const dayFixture = await fetchWeatherDay({
                deviceId: 78908,
                day: new Date('2026-03-13T12:00:00Z'),
                cookies: 'session=abc',
                fetchImpl: async (url, options) => {
                    capturedUrl = url;
                    capturedOptions = options;
                    return createJsonResponse(weatherDayOneFixture);
                },
            });

            expect(dayFixture).to.deep.equal(weatherDayOneFixture);
            expect(capturedUrl).to.equal('https://www.ecowitt.net/index/get_data');
            expect(capturedOptions).to.not.equal(undefined);
            expect(capturedOptions.method).to.equal('POST');
            expect(capturedOptions.headers.cookie).to.equal('session=abc');
            expect(capturedOptions.body.toString()).to.equal(
                'device_id=78908&is_list=0&mode=0&sdate=2026-03-13+00%3A00&edate=2026-03-13+23%3A59&page=1',
            );
        });
    });

    describe('mapWeatherResponseToReports', function () {
        it('maps a real Ecowitt fixture into ReportData rows', function () {
            const reports = mapWeatherResponseToReports(78908, weatherDayOneFixture);
            const firstValidIndex = weatherDayOneFixture.list.tempf.list.tempf.findIndex(
                (value) => value && value !== '-',
            );
            const gustIndex = weatherDayOneFixture.list.wind_speed.list.windgustmph.findIndex(
                (value) => value && value !== '0.0',
            );
            const gustTime = weatherDayOneFixture.times[gustIndex];
            const gustReport = reports.find((report) => report.dateutc.getTime() === new Date(gustTime).getTime());

            expect(reports).to.have.lengthOf(countValidTemperatures(weatherDayOneFixture));
            expect(reports[0]).to.include({
                deviceId: 78908,
                temp: Number(weatherDayOneFixture.list.tempf.list.tempf[firstValidIndex]),
                humidity: Number(weatherDayOneFixture.list.humidity.list.humidity[firstValidIndex]),
                wind_unit: 'km/h',
                rainrate_unit: 'mm/hr',
            });
            expect(reports[0].dateutc.getTime()).to.equal(
                new Date(weatherDayOneFixture.times[firstValidIndex]).getTime(),
            );
            expect(gustReport.windgust).to.equal(
                Number(weatherDayOneFixture.list.wind_speed.list.windgustmph[gustIndex]),
            );
        });

        it('skips rows where the outdoor temperature is missing', function () {
            const mutatedFixture = structuredClone(weatherDayOneFixture);
            const firstValidIndex = mutatedFixture.list.tempf.list.tempf.findIndex((value) => value && value !== '-');
            mutatedFixture.list.tempf.list.tempf[firstValidIndex] = '-';

            const reports = mapWeatherResponseToReports(78908, mutatedFixture);

            expect(reports).to.have.lengthOf(countValidTemperatures(weatherDayOneFixture) - 1);
            expect(
                reports.some(
                    (report) => report.dateutc.getTime() === new Date(mutatedFixture.times[firstValidIndex]).getTime(),
                ),
            ).to.equal(false);
        });
    });

    describe('fetchReportsSince', function () {
        it('logs in once and aggregates report rows across multiple days', async function () {
            const responses = [
                createJsonResponse(
                    {
                        errcode: '0',
                        errmsg: 'Login success!',
                    },
                    { cookies: ['session=abc; Path=/'] },
                ),
                createJsonResponse(weatherDayOneFixture),
                createJsonResponse(weatherDayTwoFixture),
            ];
            const calls = [];

            const reports = await fetchReportsSince({
                account: 'demo@example.com',
                password: 'secret',
                deviceId: 78908,
                startDate: new Date('2026-03-13T00:00:00Z'),
                now: new Date('2026-03-15T00:00:00Z'),
                fetchImpl: async (url, options) => {
                    calls.push({ url, options });
                    return responses.shift() ?? createJsonResponse({}, { ok: false, status: 500 });
                },
            });

            expect(calls).to.have.lengthOf(3);
            expect(calls[0].url).to.equal('https://www.ecowitt.net/user/site/login');
            expect(calls[1].url).to.equal('https://www.ecowitt.net/index/get_data');
            expect(calls[2].url).to.equal('https://www.ecowitt.net/index/get_data');
            expect(calls[1].options.headers.cookie).to.equal('session=abc');
            expect(reports).to.have.lengthOf(
                countValidTemperatures(weatherDayOneFixture) + countValidTemperatures(weatherDayTwoFixture),
            );
        });
    });
});
