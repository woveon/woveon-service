
const Logger    = require('woveon-logger');
const C         = require('./config');
const Pg        = require('pg').Client;
const WovReturn = require('./wovreturn');

let Mongoose = require('mongoose');
Mongoose.Promise = Promise;
Mongoose.set('useFindAndModify', false); // see https://mongoosejs.com/docs/deprecations.html
require('mongoose-long')(Mongoose);


/**
 * Abstracts databases in WoveonService and is a handy
 * way of passing databases around. Enforces WovTools naming
 * conventions too.
 *
 * The this.client is the actual client.
 *
 * Methods implemented here are for standardize/necessary behavior in WoveonServices.
 */
class WovDB {

  /**
   * Creates the database client, but does not connect it.
   * @param {String} _wovdbname - the WovDatabase name
   * @param {Logger} _logger - a WoveonLogger, stored as this.l
   */
  constructor(_wovdbname, _logger) {
    this.name = _wovdbname;
    this.l    = _logger;

    if ( this.l == null ) throw new Error('WovDB passed null _logger');
  }

  /**
   * Creates the connection to the database.
   */
  async connect() { Logger.g().throwError(`connect not implemented in class`); }

  /**
   * Disconnects with the server. Won't disconnect if there are other connections open.
   */
  async disconnect() { Logger.g().throwError(`disconnect not implemented in class`); }

  /**
   * Asks if connected.
   * @return {WovReturn} -
   */
  async isConnected() { Logger.g().throwError(`isConnected not implemented in class`); }

};


/**
 */
class WovDBMongo extends WovDB {

  /**
   * Creates the database client, but does not connect it.
   * @param {String} _wovdbname - the WovDatabase name
   * @param {Logger} _logger - WoveonLogger
   */
  constructor(_wovdbname, _logger) {
    super(_wovdbname, _logger);

    // for debugging
    this.id = `${Math.floor(Math.random()*1000)}-${new Date().getTime()}`;
    //    this.l.info('New DB id ', this.id);

    this.connection = null;
    if ( Mongoose.wovconnections == null ) Mongoose.wovconnections = {};
  }

  /**
   * Initialize the Mongoose connection to the MongoDB.
   * @return {promise}
   */
  async connect() {

    let dburl = `mongodb://${C.get(`WOV_${this.name}_endpoint`)}/${C.get(`WOV_${this.name}_database`)}`;
    this.l.verbose(`...DB start connection to MongoDB: ${dburl}`);

    // Mongoose is screwy so not going to pretty up this code
    this.l.aspect('WovDBMongo.connect', '---Mongoose connect started: ', dburl);
    this.connection = Mongoose.createConnection(dburl, {useNewUrlParser : true});
    this.l.aspect('WovDBMongo.connect', '---Mongoose connect started: readystate:', this.connection.readyState);

    return new Promise( function(r, j) {
      this.connection.on('error', function(err) {
        this.l.error('---Mongoose error: do you have a mongodb running locally? ');
        this.l.error('\n\n type: `make local-db-start`     to start mongodb\n');
        this.l.error(' or `docker ps -a` and find a stopped mongo container\n\n');
        j(err);
      }.bind(this));
      this.connection.on('open', function() {
        this.l.aspect('WovDBMongo.connect', '---Mongoose open: readystate:', this.connection.readyState, `id(${this.id})`);
        Mongoose.wovconnections[this.id] = dburl;
        r(true);
      }.bind(this));
      this.connection.on('disconnected', function() {
        this.l.verbose(`---Mongoose disconnected: id(${this.id})`);
      }.bind(this));
    }.bind(this));
  }


  /**
   * Closes this connection to the Mongoose db. However, it leaves the Mongoose db open for other connections.
   */
  async close() {
    this.logger.aspect('WovDBMongo.close', 'close db connection', this.id);
    delete Mongoose.wovconnections[this.id];
    // this.logger.aspect('WovDBMongo.close', '---beforeha promise');
    await new Promise( function(res, rej) {
      // this.logger.aspect('dbdisconnect', '---before connection close');
      this.connection.close(function(e) {
        // this.logger.aspect('dbdisconnect', 'closing connection: ', e);
        if ( e ) rej(e);
        else res(true);
      });
      // this.logger.aspect('dbdisconnect', '---after connection close');
    });
    // this.logger.aspect('dbdisconnect', '---after promise');
  };


  /**
   * Closes this connection and attempts to disconnect Mongoose. If Mongoose has other connections, don't disconnect.
   */
  async disconnect() {
    this.l.aspect('dbdisconnect', 'disconnect Mongoose');
    this.l.aspect('dbdisconnect', '---before disconnect');
    await new Promise( function(res, rej) {
      this.l.aspect('dbdisconnect', '---before disconnect 2');
      module.exports.Mongoose.disconnect(function(e) {
        this.l.aspect('dbdisconnect', '  ---disconnected: ', e);
        if ( e ) rej(e);
        else res(true);
      });
      this.l.aspect('dbdisconnect', '---after connection close');
    });
    this.l.aspect('dbdisconnect', '---after promise');
  }


  /**
   * Returns if Mongoose connection to MongoDB has been established.
   * @return {bool}
   */
  async isConnected() {
    let retval = false;
    if ( this.connection && this.connection.readyState == 1 ) { retval = true; }
    return retval;
  }
};

/**
 * Postgres client.
 */
class WovDBPostgres extends WovDB {

  /**
   * Creates the database client, but does not connect it.
   * @param {String} _wovdbname - the WovDatabase name
   * @param {Logger} _logger - WoveonLogger
   */
  constructor(_wovdbname, _logger) {
    super(_wovdbname, _logger);

    if ( C.get(`WOV_${_wovdbname}_type`) == 'postgres' ) {
      let conf = {
        user     : C.get(`WOV_${_wovdbname}_username`),
        host     : C.get(`WOV_${_wovdbname}_endpoint`),
        database : C.get(`WOV_${_wovdbname}_database`),
        port     : parseInt(C.get(`WOV_${_wovdbname}_port`)),
        password : C.gET(`WOV_${_wovdbname}_password`),
      };
      // Logger.g().info('WovDBPostgres conf: ', conf);
      this.client = new Pg(conf);
    }
    else { Logger.g().throwError(`Passed '${C.get(`WOV_${_wovdbname}_type`)}' database information to Postgres client.`); }

  }

  /**
   * Creates the connection to the database.
   */
  async connect() {
    await this.client.connect()
      .then(() => Logger.g().info(`  ... db ${this.name} connected`))
      .catch( (e) => {
        Logger.g().throwError('  ... connection error, is bastion tunneled into?', e.stack);
      });
  }

  /**
   * Checks connection.
   * @return {WovReturn} -
   */
  async isConnected() {
    return new Promise( (async function(res, rej)  {

      // NOTE: for mongo this.client.isConnected() works

      // allow 3 seconds before timeout
      let t = setTimeout(function() {
        Logger.g().aspect('health', '!!! db connection timeout hit');
        rej(WovReturn.retError(null, 'DB Connection timeout.'));
      }, 3000);
      let q = 'SELECT 1;';
      let d = [];
      Logger.g().aspect('health2', 'q: ', q, '\nd: ', d);
      let r = await this.client.query(q, d);
      Logger.g().aspect('health2', 'r: ', r);
      clearTimeout(t);
      if ( r.rowCount == 1 ) { res(WovReturn.retSuccess(true)); }
      else { rej(WovReturn.retError(r, 'failed db query.')); }
    }).bind(this));
  }

};

WovDBMongo.Mongoose = Mongoose;

// This is the only Mongoose! Otherwise Promises break down....
module.exports = {WovDB, WovDBPostgres, WovDBMongo};

