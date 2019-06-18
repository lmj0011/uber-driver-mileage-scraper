require('dotenv').config();
const appDebugMode = parseInt(process.env.APP_DEBUG_MODE);
const geocodingEnabled = process.env.GMAPS_GEOCODING_API_KEY ? true : false;
const fs = require('fs');
const chalk = require('chalk');
const { DateTime } = require("luxon");
const csv = require('fast-csv');
const puppeteer = require('puppeteer');
const fg = require('fast-glob');
const googleMaps = require('@google/maps');
const wsChromeEndpointurl = process.env.WEB_SOCKET_DEBUGGER_URL;

const googleMapsClient = googleMaps.createClient({
  key: process.env.GMAPS_GEOCODING_API_KEY,
  Promise: Promise
});

// using xpaths to avoid dealing with unpredictable class names generated by <insert JS framework here>
const tripsPO = {
  "date": '//*[@id="root"]/div/div/div/div[2]/div/div/div[2]/div/div[2]/div/div/div[2]/div[2]/div',
  "distance": '//*[@id="root"]/div/div/div/div[2]/div/div/div[3]/div[2]/div/div/div[2]/div/div[1]/div[2]/div/div/div[2]/div[2]',
  "origin": '//*[@id="root"]/div/div/div/div[2]/div/div/div[3]/div[2]/div/div/div[2]/div/div[1]/div[1]/div/div[2]/div[1]/div[2]',
  "destination": '//*[@id="root"]/div/div/div/div[2]/div/div/div[3]/div[2]/div/div/div[2]/div/div[1]/div[1]/div/div[2]/div[2]/div[2]',
  "requestVehicle": '//*[@id="root"]/div/div/div/div[2]/div/div/div[3]/div[2]/div/div/div[2]/div/div[1]/div[3]/div[2]',
  "staticMapImg": '//*[@id="root"]/div/div/div/div[2]/div/div/div[3]/div[2]/div/div/div[2]/div/div[1]/img',
};

function extractLongLatFromUrl (url) {
  const regexp = /(-?[0-9]+[.][0-9]+%2C{1}-?[0-9]+[.][0-9]+)/gm;

  const array = url.match(regexp);

  // array[0] will be the pickup match
  // array[1] will be the dropoff match

  try {
    const pickupLong = array[0].split("%2C")[0];
    const pickupLat = array[0].split("%2C")[1];

    return {
      "pickUp": {
        "lat": array[0].split("%2C")[0],
        "lng": array[0].split("%2C")[1],
      },
      "dropOff": {
        "lat": array[1].split("%2C")[0],
        "lng": array[1].split("%2C")[1],
      }
    }
  } catch (e) {
    throw new Error('origin or destination address is missing, cannot reverse geocode!');
  }
}

(async() => {

  const entries = await fg(['./data-set/**/*.csv']);

  const tripIds = [];
  const failedTrips = [];
  let rowParsed = 0;

  for (const entry of entries) {
    await new Promise((resolve, reject) => {
     fs.createReadStream(entry)
     .pipe(csv.parse({ headers: true }))
     .on('error', error => reject(error))
     .on('data', row => tripIds.push(row["Trip ID"]))
     .on('end', rowCount => {
       rowParsed = rowParsed + rowCount;
       resolve();
     });
   });
  }

  console.log(`Proceeding to fetch info from ${rowParsed} trips`);

  let browser;

  try {
    browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointurl,
    });
  } catch (e) {
    throw new Error(chalk.bgRed.bold('An invalid webSocketDebuggerUrl may be set in the .env'));
  }

 const pages = await browser.pages();

 const outStream = csv.format({headers: true});

 outStream.pipe(fs.createWriteStream('./my-trips.csv'))
 outStream.pipe(process.stdout);

 for (const tripId of tripIds) {
   try {
     console.log("\n\n---");
     console.log("scraping info on trip: " + chalk.blue(`https://partners.uber.com/p3/payments/trips/${tripId}`));

     await pages[0].goto(`https://partners.uber.com/p3/payments/trips/${tripId}`, {waitUntil: 'networkidle0'});

     const date = await pages[0].evaluate(el => el.innerText, (await pages[0].$x(tripsPO.date))[0]);
     const d = DateTime.fromFormat(date, 'EEE, MMMM d, h:mm a');

     const distance = `${parseFloat(await pages[0].evaluate(el => el.innerText, (await pages[0].$x(tripsPO.distance))[0]))}`;
     let origin = await pages[0].evaluate(el => el.innerText, (await pages[0].$x(tripsPO.origin))[0]);
     let destination = await pages[0].evaluate(el => el.innerText, (await pages[0].$x(tripsPO.destination))[0]);
     const staticMapSrc = await pages[0].evaluate(el => el.src, (await pages[0].$x(tripsPO.staticMapImg))[0]);

     const coordinates = geocodingEnabled ? extractLongLatFromUrl(staticMapSrc) : null;
     const pickUpResp = geocodingEnabled ? await googleMapsClient.reverseGeocode({ latlng: coordinates.pickUp }).asPromise() : null;
     const dropOffResp = geocodingEnabled ? await googleMapsClient.reverseGeocode({ latlng: coordinates.dropOff }).asPromise() : null;

     if (!date) {
       throw new Error('The date is missing!');
     }

     if (!distance) {
       throw new Error('The distance value is missing!');
     }

     if (!geocodingEnabled && (!origin || !destination)) {
       throw new Error('origin or destination address is missing!');
     }

     if (geocodingEnabled && (!pickUpResp.json.results.length || !dropOffResp.json.results.length)) {
       throw new Error('Some geocode results could not be fetched.');
     }

     if (geocodingEnabled) {
       origin = pickUpResp.json.results[0].formatted_address;
       destination = dropOffResp.json.results[0].formatted_address;
     }

     const outputToCsvObj = {
       "Date": d.toFormat("LL'/'dd'/'yy"),
       "Distance": distance,
       "Job": await pages[0].evaluate(el => el.innerText, (await pages[0].$x(tripsPO.requestVehicle))[0]),
       "Origin": origin,
       "Destination": destination,
     }

     outStream.write(outputToCsvObj);

     if (appDebugMode) {
       console.log('\n\n');
       console.log('--DEBUG DUMP--');

       if (geocodingEnabled) {
         console.log(`${pickUpResp.json.results[0].formatted_address} | ${JSON.stringify(coordinates.pickUp)}`);
         console.log(`${dropOffResp.json.results[0].formatted_address} | ${JSON.stringify(coordinates.dropOff)}`);
       }
     }
   } catch (e) {
     let obj = {};

     obj.errorMessage = e.message ? e.message : "";
     obj.tripId = tripId;

     failedTrips.push(obj);
     console.log(e);
   }
 }


  outStream.end();

  if (failedTrips.length) {
    console.log(chalk.bgRed.bold('\n\nfailed to scrap info on the following trips:'));

    failedTrips.forEach(ft => {
      console.log(ft.errorMessage);
      console.log(chalk.blue(`https://partners.uber.com/p3/payments/trips/${ft.tripId}`));
      console.log("---");
    })
  }

  console.log("\n\n---");
  console.log('generated mileage log named my-trips.csv');
  console.log('\n\n\ndone!');

  await browser.close();

})();
