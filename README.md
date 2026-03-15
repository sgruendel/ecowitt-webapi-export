# ecowitt-webapi-export

Export Ecowitt weather data to MongoDB through the Ecowitt web interface.

## What it does

- Logs in to `https://www.ecowitt.net/`
- Fetches historical weather data by day
- Maps the web response into `ReportData` objects
- Imports those reports into MongoDB

The Ecowitt web client code lives in `src/ecowitt.js`, while `src/export.js` only handles the database import flow.

## Install

```bash
npm install
```

## Run the importer

Copy the template first:

```bash
cp .env.example .env
```

Then fill in your Ecowitt credentials and device details. The scripts load `.env` automatically with `dotenv`.

Set these environment variables before running:

- `ACCOUNT`
- `PASSWORD`
- `DEVICEID`

For the very first import, also set:

- `START_DATE` in a format accepted by JavaScript `Date`, for example `2026-03-01`

Then run:

```bash
node src/export.js
```

## Tests

Unit tests use Mocha + Chai with `c8` coverage and run against the committed Ecowitt sample files in `test/unit/`.

```bash
npm test
```

## CI

GitHub Actions runs the test suite on pushes and pull requests via `.github/workflows/node.js.yml`.
