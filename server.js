'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;
const helmet = require('helmet');
const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner');

const app = express();

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'"],
    connectSrc: ["'self'"]
  }
}))

app.use('/public', express.static(process.cwd() + '/public'));

app.use(cors({ origin: '*' })); //For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// For FCC testing purposes
fccTestingRoutes(app);

const CONNECTION_STRING = process.env.MONGO_URI;
MongoClient.connect(CONNECTION_STRING)
  .then(client => {
    console.log('Connected to Database');
    const db = client.db('stockPriceDB');
    const stockLikesCollection = db.collection('stockLikes');

    //Routing for API
    apiRoutes(app, stockLikesCollection);

    //404 Not Found Middleware
    app.use(function (req, res, next) {
      res.status(404)
        .type('text')
        .send('Not Found');
    });

    // Start our server and tests!
    const listener = app.listen(process.env.PORT || 3000, function () {
      console.log('Your app is listening on port ' + listener.address().port);
      if (process.env.NODE_ENV === 'test') {
        console.log('Running Tests...');
        setTimeout(function () {
          try {
            runner.run();
          } catch (e) {
            console.log('Tests are not valid:');
            console.error(e);
          }
        }, 3500);
      }
    });
  })
  .catch(error => {
    console.error('Failed to connect to the database:', error);
  });

module.exports = app; //for testing
