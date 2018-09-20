
// let wtf = require('wtfnode'); // debugging code for not cleanly shutting down

const autoBind      = require('auto-bind-inheritance');
const CryptoJS      = require('crypto-js'); // library with convenient syntax
const crypto        = require('crypto');    // part of nodejs
const os            = require('os');
const uuidv4        = require('uuid/v4');
const Listener      = require('./listener');
const Requester     = require('./requester');
const WovReturn     = require('./wovreturn');

const Logger        = require('woveon-logger');
const ModelLoader   = require('./modelloader');


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
    this.listener.onGet('/shutdown', this.doShutdown, __filename);
    this.listener.onGet('/health', this.onHealth, __filename);
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
    await this.listener.close();
    this.listener = null;
  } 


  /**
   * For now, just return true.
   * @return {bool} - true, since still running
   */
  async onHealth() {
    this.logger.info('woveon-service onHealth hit');
    return WovReturn.retSuccess(true);
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
  constructor({name = 'unnamed', port = 80, logger = null, staticdir = null, baseroute = null, ver = 'v1'}) {
    autoBind(this);

    this._options = {
      port      : port,
      staticdir : staticdir,
      baseroute : baseroute || `/${ver}`,
      ver       : ver,
    };

    this.name     = name;
    this.internal_address = null;
    this.external_address = null;

    this.logger = logger || new Logger(this.name, {}, {'service' : {'color' : 'blue'}, 'showname' : true});
    this.logger.info(`  options: ${JSON.stringify(this._options)}`);

    this.logger.aspect('service', '---------------------------------------------------------------------');
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', ` Woveon Service :: ${this.name}`);
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', `  options: ${JSON.stringify(this._options)}`);
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

    } catch (err) {this.logger.error(err); throw new Error(`run failed`);};
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
  static generateToken() {return uuidv4();}


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
  static orderedStringReset() {Service.GOS_last = -1;}


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
    } catch (e) {console.log(e); throw new Error('Failed to encrypt.');}
    return retval;
  }

};

module.exports.Listener    = Listener;
module.exports.WovReturn   = WovReturn;
module.exports.Requester   = Requester;
module.exports.Logger      = Logger;
module.exports.ModelLoader = ModelLoader;
