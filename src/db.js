import * as mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/ecowitt');

export { disconnect } from 'mongoose';

/*
 PASSKEY: '4885BE701185AF2C83886E1E37F74F2D',
  stationtype: 'WS1900A_V1.1.9',
  dateutc: '2022-03-12 20:58:58',
  runtime: '267891',
  tempinf: '57.4',
  humidityin: '53',
  baromrelin: '29.338',
  baromabsin: '29.338',
  tempf: '30.9',
  humidity: '62',
  winddir: '309',
  windspeedmph: '0.00',
  windgustmph: '0.00',
  maxdailygust: '5.82',
  rainratein: '0.000',
  eventrainin: '0.000',
  hourlyrainin: '0.000',
  dailyrainin: '0.000',
  weeklyrainin: '0.000',
  monthlyrainin: '0.000',
  yearlyrainin: '0.000',
  totalrainin: '0.000',
  ws1900batt: '2.87',
  wh65batt: '0',
  freq: '868M',
  model: 'WS1900'
*/
const report = new mongoose.Schema(
    {
        deviceId: {
            type: Number,
            required: true,
        },
        dateutc: {
            type: Date,
            required: true,
        },
        temp: {
            type: Number,
            required: true,
        },
        sendible_temp: {
            type: Number,
            required: true,
        },
        drew_temp: {
            type: Number,
            required: true,
        },
        temp_unit: {
            type: String,
            required: true,
        },
        humidity: {
            type: Number,
            required: true,
        },
        humidity_unit: {
            type: String,
            required: true,
        },
        tempin: {
            type: Number,
            required: true,
        },
        tempin_unit: {
            type: String,
            required: true,
        },
        humidityin: {
            type: Number,
            required: true,
        },
        humidityin_unit: {
            type: String,
            required: true,
        },
        rainrate: {
            type: Number,
            required: true,
        },
        rainrate_unit: {
            type: String,
            required: true,
        },
        dailyrain: {
            type: Number,
            required: true,
        },
        weeklyrain: {
            type: Number,
            required: true,
        },
        monthlyrain: {
            type: Number,
            required: true,
        },
        yearlyrain: {
            type: Number,
            required: true,
        },
        rain_unit: {
            type: String,
            required: true,
        },
        windspeed: {
            type: Number,
            required: true,
        },
        windgust: {
            type: Number,
            required: true,
        },
        wind_unit: {
            type: String,
            required: true,
        },
        winddir: {
            type: Number,
            required: true,
        },
        winddir_unit: {
            type: String,
            required: true,
        },
        pressurerel: {
            type: Number,
            required: true,
        },
        pressureabs: {
            type: Number,
            required: true,
        },
        pressure_unit: {
            type: String,
            required: true,
        },
        battery: {
            type: Number,
            required: true,
        },
    },
    {
        autoCreate: true,
        timestamps: true,
    },
);
report.index({ dateutc: 1 }, { unique: true });
export const Report = mongoose.model('Report', report);
