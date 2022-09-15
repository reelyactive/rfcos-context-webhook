/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


const http = require('http');
const express = require('express');
const cors = require('cors');
const socketio = require('socket.io');
const Barnowl = require('barnowl');
const BarnowlRfControls = require('barnowl-rfcontrols');
const Barnacles = require('barnacles');
const BarnaclesSocketIO = require('barnacles-socketio');
const BarnaclesWebhook = require('barnacles-webhook');
const Chickadee = require('chickadee');
const Chimps = require('chimps');


const DEFAULT_PORT = process.env.PORT || 3001;
const USE_CORS = process.env.USE_CORS || true;
const SOCKETIO_CORS_OPTIONS = {
    cors: { origin: "*", methods: [ "GET", "POST" ] }
};
const DEFAULT_RFC_OPTIONS = {
    url: "ws://localhost:61613/websockets/messaging",
    username: "admin",
    password: "admin",
    regionIds: [], // Add these as Strings based on your RFC deployment
    isDebug: false
};
const DEFAULT_WEBHOOK_OPTIONS = {
    useHttps: false,
    hostname: 'localhost',
    port: 3002,
    customHeaders: {},
    printErrors: true
};


/**
 * RFCOSContextWebhook Class
 * Enrich RF Controls real-time location data with context and forward via
 * webhook.
 */
class RFCOSContextWebhook {

  /**
   * RFCOSContextWebhook constructor
   * @param {Object} options The configuration options.
   * @constructor
   */
  constructor(options) {
    let self = this;
    options = options || {};
    options.port = options.port || DEFAULT_PORT;
    options.rfc = options.rfc || DEFAULT_RFC_OPTIONS;
    options.webhook = options.webhook || DEFAULT_WEBHOOK_OPTIONS;

    this.app = express();
    this.server = http.createServer(self.app);
    this.io = socketio(self.server, SOCKETIO_CORS_OPTIONS);
    this.barnowl = new Barnowl();
    this.barnacles = new Barnacles({ barnowl: self.barnowl });
    this.chickadee = new Chickadee({ app: self.app, io: self.io,
                                     barnacles: self.barnacles });
    this.chimps = new Chimps({ barnowl: self.barnowl,
                               chickadee: self.chickadee });
    this.barnaclesSocketIO = new BarnaclesSocketIO({ io: self.io });
    this.barnaclesWebhook = new BarnaclesWebhook(options.webhook);

    if(options.simulateRFCOS === true) {
      self.barnowl.addListener(BarnowlRfControls, {},
                               BarnowlRfControls.TestListener, {});
    }
    else {
      self.barnowl.addListener(BarnowlRfControls, {},
                               BarnowlRfControls.WsListener, options.rfc);
    }

    this.barnacles.on('raddec', (raddec) => {
      self.barnaclesSocketIO.handleEvent('raddec', raddec);
      self.barnaclesWebhook.handleEvent('raddec', raddec);
    });

    this.chimps.on('spatem', (spatem) => {
      self.barnaclesSocketIO.handleEvent('spatem', spatem);
      self.barnaclesWebhook.handleEvent('spatem', spatem);
    });

    if(USE_CORS) {
      self.app.use(cors());
    }

    this.server.on('error', (error) => {
      if(error.code === 'EADDRINUSE') {
        console.log('Port', options.port, 'is already in use.',
                    'Is another instance running?');
      }
    });

    this.server.listen(options.port, () => {
      console.log('rfcos-context-webhook by reelyActive is running on port',
                  options.port);
    });
  }

}

module.exports = RFCOSContextWebhook;
