## Uber Driver Mileage Scraper

Scraps necessary mileage info from [partners.uber.com](http://partners.uber.com) and then stores it in a CSV file, which can be used as proof of [business mileage](https://www.irs.gov/pub/irs-pdf/p463.pdf) when filing your taxes.

![](https://i.imgur.com/aHc2Ahg.gif)

#### Why Would I Use This?

- when you realize the tax info Uber gives you at the end of the year is not going to be enough to get reimbursement from the IRS

- If you haven't been keeping track of your mileage using an app like [Stride Tax](https://www.stridehealth.com/tax)

- If your phone can't handle simultaneously running a mileage tracking app, Uber, and other gig apps

#### Reliability
At any point, Uber's website devs can update the [partners.uber.com](https://partners.uber.com) website and render this scraper completely inoperable, as was the case for [Uber Data Extractor](https://ummjackson.github.io/uber-data-extractor/). It would be wise to run the scraper as soon as possible especially if you have a lot of trips to document into IRS friendly format. 

## System Requirements

Make sure these are installed on your computer:

- [Google Chrome](https://www.google.com/chrome/)

- [node.js](https://nodejs.org/en/download/) (version 10 or higher)

## Install and Run

1. download this repo

 `git clone https://github.com/lmj0011/uber-driver-mileage-scraper.git`

2. install this project's dependencies

 `npm install`

3. in a separate terminal, start up Google Chrome with remote debugging enabled

 `google-chrome --remote-debugging-port=9222`

4. make a new .env file using example.env as a template

 `cp example.env .env`

 - **important:** be sure to set the value for `WEB_SOCKET_DEBUGGER_URL` in the .env file (see .env file for more context)

5. log into [partners.uber.com](http://partners.uber.com)
 - **important:** this tab should be the only one open, close out any other tabs.

6. download all [statements](https://partners.uber.com/p3/payments/statements) for this year and place the CSV files into the `data-set` directory

7. run the scraper tool

 `node .`

 ![](https://i.imgur.com/BDymblo.gif)


when the scraper tool is finished, mileage data will be stored in a file named `my-trips.csv` (inside this directory).

## Errors

Here are some error messages you may encounter when running the scraper:

`"An invalid webSocketDebuggerUrl may be set in the .env"` - occurs when there's no value set for WEB_SOCKET_DEBUGGER_URL in the .env file, or if it's invalid. The scraper tool will not start if this error is thrown

`"Cannot read property 'innerText' of undefined"` - sometimes occurs when puppeteer was not able to extract an element from the trip page

`"origin or destination address is missing, cannot reverse geocode!"` - occurs when origin or destination address was not able to be extracted from the trip. Only relevant if GMAPS_GEOCODING_API_KEY was set in the .env

`"The date is missing!"` - occurs when the date was not able to be extracted from the trip.

`"The distance value is missing!"` - occurs when the distance was not able to be extracted from the trip.

`"Some geocode results could not be fetched."` - occurs when incomplete results come back from the googleMapsClient. Only relevant if GMAPS_GEOCODING_API_KEY was set in the .env


Any trips the scraper fails on, will be displayed when done running. The failed trip urls are displayed so you may do further inspection if needed.

![](https://i.imgur.com/SIogirI.png)

## AUTHOR

Written by [Landan Jackson](https://github.com/lmj0011)

## REPORTING BUGS

Please file any relevant issues [on Github.](https://github.com/lmj0011/uber-driver-mileage-scraper)

## LICENSE

This work is released under the terms of the Parity Public License, a copyleft license. For more details, see the LICENSE file included with this distribution.
