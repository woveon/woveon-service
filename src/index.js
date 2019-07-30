
// let wtf = require('wtfnode'); // debugging code for not cleanly shutting down

const autoBind       = require('auto-bind-inheritance');
const CryptoJS       = require('crypto-js'); // library with convenient syntax
const crypto         = require('crypto');    // part of nodejs
const uuidv4         = require('uuid/v4');
const Listener       = require('./listener');
const Requester      = require('./requester');
const WovReturn      = require('./wovreturn');
const Config         = require('./config');

const Logger         = require('woveon-logger');
const ModelLoader    = require('./modelloader');
const WovModelClient = require('./wovmodelclient');
const WovModel       = require('./wovmodel');
const WovDB          = require('./wovdb');

const {DocMethod, DocParam} = Listener;


module.exports = class Service {


  // ---------------------------------------------------------------------
  // overrides
  // ---------------------------------------------------------------------
  //  The following dev functions should be overriden for your services.
  // ---------------------------------------------------------------------

  /**
   * The listener has been created but not started. This is where you
   * add routes.
  */
  async onInit() {
    this.logger.info('onInit woveon-service');
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
  };

  /**
   * Listener just started.
  */
  async onStartup() {};

  /**
   * Just ended calls to onStartup. So, after last child class's
   * onStartup. Useful for starting a wakeup process.
   */
  async onPostStartup() {};

  /**
   * Called after child's onShutdown, when shutdown was started by the service.
   * NOTE: Call child's onShutdown first, since this is a virtual destructor.
  */
  async onShutdown() {
    if ( this.listener.islistening) await this.listener.close();
    this.listener = null;
  };


  /**
   * For now, just return true unless this.db exists, then check connection.
   * @return {bool} - true, since still running
   */
  async onHealth() {
    let retval = null;
    this.logger.aspect('health', 'Woveon-service onHealth hit');

    if ( this.db == null ) { retval = WovReturn.retSuccess(true); }

    else retval = WovReturn.retSuccess(this.db.isConnected());

    return retval;
  };

  // ---------------------------------------------------------------------
  // /overrides
  // ---------------------------------------------------------------------


  /**
   * Create the service.
   * @param {object} _options - additional options
   *     : name - overwrite the _name
   *     : port - port this listens on
   *     : logger - pass in a logger
   *     : staticdir - where static html is served from, null means no staticdir
   *     : baseroute - prepended to each endpoint ex. https://host/baseroute/route
   * NOTE: recently changed arguments to use nodejs defaults... bound to screw this up
   */
  constructor(_options = {}) {
    autoBind(this);

    if ( typeof _options != 'object' ) {
      throw Error(`Woveon-Service service is not being initialized with an object, but a "${typeof _options}", with value: "${_options}".`);
    }

    this._options = Object.assign({}, {
      port      : 80,
      ver       : 'v1',
      staticdir : null,
      baseroute : null,
    }, _options);

    this.name     = _options.name || 'unnamed';
    this.internal_address = null;
    this.external_address = null;

    if ( this._options.baseroute == null ) this._options.baseroute = `/${this.name}/${this._options.ver}`;

    this.logger = _options.logger || new Logger(this.name, {showname : true}, {'service' : {'color' : 'blue'}});
    // this.logger.info(`  options: ${JSON.stringify(this._options)}`);

    // this.logger.info('static dir : ', this._options.staticdir);

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

    this.logger.verbose(`...created service ${this.name}`);
  };


  /**
   * Initialize the service. Start adding your listener routes after this.
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
   * @param {bool} _requestip -
   * Starts the listener listening.
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
   */
  async doShutdown() {
    this.logger.aspect('service-levels', '  ... service shutdown');
    await this.onShutdown();
  };


  /**
   * @return {string} -
    */
  static generateToken() { return uuidv4(); }


  /**
   * Used to generate tokens. Uses upperalpha/number chars.
   * @param {int} length - defaults to 20 if empty
   * @return {string} - random length string
   */
  static generateRandomString(length = 20) {
    return crypto.randomBytes(length).toString('hex');
  };


  /**
   * @param {int} length - number of bytes in string returned
   * @return {string} -
   */
  static generateOrderedString(length = 20) {
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
   */
  static orderedStringReset() { Service.GOS_last = -1; }


  /**
   * Decrypt data with AES, using a salted key.
   * @param {*} _saltedkey -
   * @param {*} _secret - Content string to encrypt
   * @return {string} - _secret decrypted to UTF8 string
   */
  static decrypt(_saltedkey, _secret) {
    let decryptedBytes = CryptoJS.AES.decrypt(_secret, _saltedkey);
    let plaintext = decryptedBytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  }


  /**
   * Encrypt data with AES, using a salted key.
   * @param {*} _saltedkey -
   * @param {*} _secret - Thing to encrypt. UTF8, bytes, etc. JSON.stringify don't care.
   * @return {object} - call toString() on the object to get the string
   */
  static encrypt(_saltedkey, _secret) {
    let retval = null;
    try {
      let result = CryptoJS.AES.encrypt(JSON.stringify(_secret), _saltedkey);
      retval = result.toString();
    }
    catch (e) { console.log(e); throw new Error('Failed to encrypt.'); }
    return retval;
  }

};

module.exports.Listener       = Listener;
module.exports.WovReturn      = WovReturn;
module.exports.Requester      = Requester;
module.exports.Logger         = Logger;
module.exports.ModelLoader    = ModelLoader;
module.exports.WovModelClient = WovModelClient;
module.exports.WovModel       = WovModel;
module.exports.WovDB          = WovDB;
module.exports.Config         = Config;
