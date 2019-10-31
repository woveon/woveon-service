
// let wtf = require('wtfnode'); // debugging code for not cleanly shutting down
/**
 * @typedef integer
 */

const autoBind       = require('auto-bind-inheritance');
const CryptoJS       = require('crypto-js'); // library with convenient syntax
const crypto         = require('crypto');    // part of nodejs
const Logger         = require('woveon-logger');
const uuidv4         = require('uuid/v4');

const Listener         = require('./listener');
const Requester        = require('./requester');
const WovReturn        = require('./wovreturn');
const Config           = require('./config');
// const ModelLoader      = require('./modelloader');
const WovUtil          = require('./wovutil');
const WovClientLocal   = require('./wovclientlocal');
const WovClientRemote  = require('./wovclientremote');
const WovModel         = require('./wovmodel');
const WovModelMany     = require('./wovmodelmany');
const WovStateLayer    = require('./wovstatelayer');

const {WovDBPostgres, WovDBMongo} = require('./wovdb');
const {DocMethod}                 = Listener;


module.exports = class Service {


  // ---------------------------------------------------------------------
  // overrides
  // ---------------------------------------------------------------------
  //  The following dev functions should be overriden for your services.
  // ---------------------------------------------------------------------

  /**
   * The listener has been created but not started. This is where you
   * add routes.
   *
   * @return {null} -
   */
  async onInit() {
    if ( this.statelayer != null ) { await this.statelayer.init(); }

    this.listener.onGet('/priv/shutdown', new DocMethod({
      summary : 'A route to shut down the server',
      handler : this.doShutdown,
    }), __filename);
    this.listener.onGet('/pub/health', new DocMethod({
      summary   : 'A simple health check',
      handler   : this.onHealth,
      desc      : 'This just returns true. If there is a db, this also makes sure the db connection is good.',
      params    : [],
      responses : {},
    }), __filename);

    // set up the protects routes
    if ( this._options.protect ) this._options.protect.call(this);

    // set up the routes
    if ( this._options.routes ) this._options.routes.call(this);
  };


  /**
   * Listener just started.
   *
   * @return {undefined} -
   */
  async onStartup() {};


  /**
   * Just ended calls to onStartup. So, after last child class's
   * onStartup. Useful for starting a wakeup process.
   *
   * @return {undefined} -
   */
  async onPostStartup() {};


  /**
   * Called after child's onShutdown, when shutdown was started by the service.
   * NOTE: Call child's onShutdown first, since this is a virtual destructor.
   *
   * @return {undefined} -
   */
  async onShutdown() {
    if ( this.listener.islistening) await this.listener.close();
    this.listener = null;
  };


  /**
   * For now, just return true unless this.db exists, then check connection.
   *
   * @return {boolean} - true, since still running
   */
  async onHealth() {
    let retval = null;
    this.logger.aspect('health', 'Woveon-service onHealth hit');

    if ( this.db == null ) { retval = WovReturn.retSuccess(true); }

    else retval = await this.db.isConnected();

    return retval;
  };

  // ---------------------------------------------------------------------
  // /overrides
  // ---------------------------------------------------------------------


  /**
   * Create the service.
   *
   * @param {object} _options - additional options
   * : name - overwrite the _name
   * : port - port this listens on
   * : logger - pass in a logger
   * : staticdir - where static html is served from, null means no staticdir
   * : baseroute - prepended to each endpoint ex. https://host/baseroute/route
   *
   * : controllers - object with controller functions that get bound to this service (called in constructor)
   * : protects    - function that adds routes to the listener (bound to this service when called in onInit)
   * : routes      - function that adds routes to the listener (bound to this service when called in onInit)
   *
   * : applayer    - functionality to apply to this service
   * : statelayer  - access to stateful data
   *
   */
  constructor(_options) {
    autoBind(this);

    this._options = Object.assign({}, {
      port       : 80,
      ver        : 'v1',
      baseroute  : null,
      staticdir  : null,
      protects   : null,
      routes     : null,
      controller : null,
      applayer   : null,
      statelayer : null,
    }, _options);

    // bind Application Layer functions to this and place on this.al
    this.al = {};
    WovUtil.bindObjectFunctionsToObject(_options.applayer, this, this.al);

    // State Layer
    this.statelayer = this._options.statelayer || new WovStateLayer(this.l, []);

    this.name       = _options.name || 'unnamed';
    this.internal_address = null;
    this.external_address = null;

    if ( this._options.baseroute == null ) this._options.baseroute = `/${this.name}/${this._options.ver}`;

    this.logger = _options.logger || new Logger(this.name, {showname : true}, {'service' : {'color' : 'blue'}});
    this.l = this.logger;

    this.logger.aspect('service', '---------------------------------------------------------------------');
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', ` Woveon Service :: ${this.name}`);
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', '---------------------------------------------------------------------');

    this.listener  = new Listener(
      this._options.port,
      this.logger,
      this._options.staticdir,
      this._options.baseroute,
      this.name,
    );

    if ( this._options.controller ) WovUtil.bindObjectFunctionsToObject(this._options.controller, this);

    this.logger.verbose(`...created service ${this.name}`);
  };


  /**
   * Initialize the service. Start adding your listener routes after this.
   *
   * @return {undefined}
   */
  async init() {
    this.logger.aspect('service-levels', '  ... start init service');

    this.logger.verbose('service-levels', '    ... init listener');
    await this.listener.init();

    this.logger.aspect('service-levels', '    ... service init complete');
    await this.onInit();
    this.logger.aspect('service-levels', '    ... service onInit complete');
  }


  /**
   * Starts the listener listening.
   *
   * @return {undefined} -
   */
  async startup() {
    try {
      this.logger.aspect('service-levels', '  ... starting listener');
      await this.listener.listen();

      this.logger.verbose('service listening on: ',
        JSON.stringify(this.listener.server.address()));

      await this.onStartup();
      await this.onPostStartup();

    }
    catch (err) { this.logger.rethrowError(err, `run failed`); };
  };


  /**
   * Turns off the service by closing the listener.
   * NOTE: Make sure your service already shut down anything it was managing in onShutdown.
   *
   * @return {undefined} -
   */
  async doShutdown() {
    this.logger.aspect('service-levels', '  ... service shutdown');
    await this.onShutdown();
  };


  /**
   * Deprecated.
   *
   * @return {string} -
   */
  static generateToken() {
    Logger.g().logDeprecated('generateToken should be called on WovUtil');
    return uuidv4();
  }


  /**
   * Used to generate tokens. Uses upperalpha/number chars.
   *
   * @param {integer} length - defaults to 20 if empty
   * @return {string} - random length string
   */
  static generateRandomString(length = 20) {
    Logger.g().logDeprecated('generateRandomString should be called on WovUtil');
    return crypto.randomBytes(length).toString('hex');
  };


  /**
   * Utility function.
   *
   * @param {integer} length - number of bytes in string returned
   * @return {string} -
   */
  static generateOrderedString(length = 20) {
    Logger.g().logDeprecated('generateOrderedString should be called on WovUtil');
    if ( Service.GOS_last === undefined ) Service.GOS_last = -1;
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let retval= '';
    for (let i = 0; i < length; i += 1) {
      let p = (1+Service.GOS_last)%possible.length;
      retval += possible.charAt( p );
      Service.GOS_last = p;
    }
    return retval;
  }


  /**
   * Resets to start, the orderd generateOrderedString function.
   *
   * @return {undefined} -
   */
  static orderedStringReset() {
    Logger.g().logDeprecated('orderedStringReset should be called on WovUtil');
    Service.GOS_last = -1;
  }


  /**
   * Decrypt data with AES, using a salted key.
   *
   * @param {*} _saltedkey -
   * @param {*} _secret - Content string to encrypt
   * @return {string} - _secret decrypted to UTF8 string
   */
  static decrypt(_saltedkey, _secret) {
    Logger.g().logDeprecated('decrypt should be called on WovUtil');
    let decryptedBytes = CryptoJS.AES.decrypt(_secret, _saltedkey);
    let plaintext = decryptedBytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  }


  /**
   * Encrypt data with AES, using a salted key.
   *
   * @param {*} _saltedkey -
   * @param {*} _secret - Thing to encrypt. UTF8, bytes, etc. JSON.stringify don't care.
   * @return {object} - call toString() on the object to get the string
   */
  static encrypt(_saltedkey, _secret) {
    Logger.g().logDeprecated('encrypt should be called on WovUtil');
    let retval = null;
    try {
      let result = CryptoJS.AES.encrypt(JSON.stringify(_secret), _saltedkey);
      retval = result.toString();
    }
    catch (e) { console.log(e); throw new Error('Failed to encrypt.'); }
    return retval;
  }

};

// Utility
module.exports.Config           = Config;
module.exports.WovReturn        = WovReturn;
module.exports.Logger           = Logger;
module.exports.Util             = WovUtil;

// Interface Layer
module.exports.Listener         = Listener;
module.exports.Requester        = Requester;

// State Layer
module.exports.entity               = require('./entity');
module.exports.WovStateLayer        = WovStateLayer;
module.exports.WovClientLocal       = WovClientLocal;
module.exports.WovClientRemote      = WovClientRemote;
module.exports.WovModel             = WovModel;
module.exports.WovModelMany         = WovModelMany;
// module.exports.WovRemoteModelClient = WovRemoteModelClient;
// module.exports.WovRemoteModel       = WovRemoteModel;
module.exports.WovDBPostgres        = WovDBPostgres;
module.exports.WovDBMongo           = WovDBMongo;
