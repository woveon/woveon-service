
const Logger = require('woveon-logger');
const C      = require('./config');
const Pg     = require('pg').Client;


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
   */
  constructor(_wovdbname) {
    this.name = _wovdbname;
  }

  /**
   * Creates the connection to the database.
   */
  async connect() { Logger.g().throwError(`connect not implemented in class`); }

  /**
   * Disconnects with the server.
   */
  async disconnect() { Logger.g().throwError(`disconnect not implemented in class`); }

  /**
   * Asks if connected.
   * @return {WovReturn} -
   */
  async isConnected() { Logger.g().throwError(`isConnected not implemented in class`); }

};


/**
 * Postgres client.
 */
class WovDBPostgres extends WovDB {

  /**
   * Creates the database client, but does not connect it.
   * @param {String} _wovdbname - the WovDatabase name
   */
  constructor(_wovdbname) {
    super(_wovdbname);

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
    return await new Promise( (async function(res, rej)  {

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

module.exports = { WovDB, WovDBPostgres };
