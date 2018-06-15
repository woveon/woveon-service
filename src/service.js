
// let wtf = require('wtfnode'); // debugging code for not cleanly shutting down

const autoBind      = require('auto-bind-inheritance');
const CryptoJS      = require('crypto-js');
const os            = require('os');
const uuidv4        = require('uuid/v4');

const Logger        = require('woveon-logger');

const Listener      = require('./listener');
const Requester     = require('./requester');

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
    this.listener.onGet('/shutdown', this.onShutdown, __filename);
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
  async onShutdown() {};


  /**
   * For now, just return true.
   * @return {bool} - true, since still running
   */
  async onHealth() {return true;};

  // ---------------------------------------------------------------------
  // /overrides
  // ---------------------------------------------------------------------


  /**
   * Create the service.
   * @param {string} _name - Name of service
   * @param {object} _options - additional options
   *                     : name - overwrite the _name
   *                     : logger - pass in a logger
   */
  constructor(_name, _options = {name : '', port : 80, logger : null,  staticdir : null}) {
    autoBind(this);

    this._options = _options;
    this.name     = this._options.name || _name;
    delete this._options.name; // only one location for name

    this.logger = this._options.logger || new Logger(this.name, {}, {'service' : {'color' : 'blue'}});
    this.logger.aspect('service', '---------------------------------------------------------------------');
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', ' Woveon Plugin Engine');
    this.logger.aspect('service', `  :: ${this.name}`);
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', `  config: `, JSON.stringify(_config));
    this.logger.aspect('service', '---------------------------------------------------------------------');

    this.listener  = new Listener(this.config, this.logger, this._options.staticdir);
    this.logger.verbose(`...created service ${this.name}`);
  };


  /**
   * Initialize the service. Start adding your listener routes after this.
   */
  async init() {
    this.logger.verbose('  ... start init service');

    /*
    try {
      await this.db.init(this.config.plugin.dburl);
    } catch (err) {
      console.log(err);
      throw new Error('Failed to init datbase');
      process.exit(1);
    }
    */

    this.logger.verbose('  ... init listener');
    await this.listener.init();

    this.logger.verbose('  ... service init complete');
    await this.onInit();
    this.logger.verbose('  ... service onInit complete');
  }

  /**
   * @param {bool} _requestip -
   * Starts the listener listening.
   */
  async startup() {
    try {
      await this.listener.listen();

      this.logger.verbose('  ...startup: service listening on: ', JSON.stringify(this.listener.server.address()));
      this.config.service.family  = this.listener.server.address().family;
      this.config.service.port    = this.listener.server.address().port;

      // request ip calls the microservice that will call it, to verify this MS's ip address
      // this.logger.info('requestip : ', this._options.requestip, ' but skipping! for now, using network interface.');
      // if ( this._options.requestip && this._options.requestip == true ) {
      if ( false ) {
        // get ip address from the WL TODO HERE
        let RQ = new Requester(this.logger);
        let result= await RQ.get(`${this.config.api.url}/api/v1/myip`);
        this.logger.info('myip : ', result);
        if ( result.success == true ) {
          this.config.service.address = result.data;
        } else {
          this.logger.throwError('/myip failed. could not reach WL somehow?');
        }
      } else {

        // get ip address from network interfaces (will return a local ip, so switching to asking WL)
        let ifacess = os.networkInterfaces();
        let ifaces = ifacess['eth0'] || ifacess['en0'] || ifacess['lo0']; // os.networkInterfaces()['eth0'];
        if ( ifaces== null ) {
          this.logger.info('interfaces:', os.networkInterfaces());
          this.logger.throwError(`Can't find network interface 'eth0', 'en0' or 'lo0'.`);
        }

        let that = this;
        ifaces.forEach(function(iface) {
          if (that.config.service.family !== iface.family || iface.internal !== false) { // 'IPv4' most likely
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
          }
          that.config.service.address = iface.address; // this.listener.server.address().address;
        });
      }
      this.logger.verbose('service listening on non-internal IP address address: ', this.config.service.address);

      await this.onStartup();
      await this.onPostStartup();

    } catch (err) {this.logger.error(err); throw new Error(`run failed`);};
  };


  /**
   * Turns off the service by closing the listener.
   * NOTE: Make sure your service already shut down anything it was managing in onShutdown.
   */
  async shutdown() {
    await this.onShutdown();
    await this.db.close();
    await this.listener.close();
    // wtf.dump();
//    setTimeout(()=>{wtf.dump();}, 3000); // log running things
  };


  /**
   * Add a Mongoose schema to this Service. Stores in this.resourceModels, for easy access later.
   * Call this function in onInit, so db is active.
   */
  /*
  addResourceModel(_model) {
    this.logger.info('... adding Resource model: ', _model.collection.name);
    this.resourceModels[_model.collection.name] = _model;
  }
  */

  /**
   * Creates a mongodb for the Resoure type, storing it in plResourceModels.
   * NOTE: call in onInit, so db is not null
   * @param {string} _name - name of the model to be created
   * @param {object} _rsdef - resource definition file, containing Mixin and plSchemaAdditions
   */
  initPluginResourceModel(_name, _rsdef) {
    if ( _rsdef.plSchemaAdditions != null && _rsdef.Mixin != null ) {
      let sch = null;
      let model = null;

      if ( this.db.isConnected() == false ) {
        this.logger.throwError('Calling initPluginResourceModel when db is not connected. '+
          'Call in "onInit" run-level.');
      }

      try {
        sch = new Schema(Object.assign({}, PluginResSchemaBase, _rsdef.plSchemaAdditions), {timestamps : true});
            // timestamps => createdAt, updatedAt
      } catch (err) {
        this.logger.error(err);
        throw new Error(`Failed to create a schema for ${_name}.`);
      }

      // try to grab cached. note, since Mongoose caches them inernally, and not
      // per connection, I am doing this.
      try {
        model = this.db.connection.model(_name);
      } catch (err) {model= this.db.connection.model(_name, sch);}

      this.logger.verbose('... adding Resource model: ', model.collection.name);
      this.logger.verbose('... models :', Object.keys(this.plResourceModels));
      this.plResourceModels[model.collection.name] = model;

    } else {
      this.logger.throwError('Bad values passed to initResourceModel. '+
        '"initResourceModel" should be passed a remote service definition '+
        'for a resource, which has "plSchemaAdditions" and "Mixin" '+
        'attributes.');
    }
  }


  /**
   * @return {string} -
    */
  static generateToken() {
    let retval = uuidv4();
    return retval;
  }

  /**
   * Used to generate tokens. Uses upperalpha/number chars.
   * @param {int} length - defaults to 20 if empty
   * @return {string} - random length string
   */
  static generateRandomString(length = 20) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < length; i += 1) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
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
   * Helper function to encrypt data for storage in database. Uses a key stored in the
   * container's configuration, passed in via environment variables.
   * @param {*} _config -
   * @param {*} _secret - Content string to encrypt
   * @return {string} - _secret decrypted to UTF8 string
   */
  static decrypt(_config, _secret) {
    let decryptedBytes = CryptoJS.AES.decrypt(_secret, _config.plugin.data_secret);
    let plaintext = decryptedBytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  }


  /**
   * Encrypt data with AES, salted and using a plugin-wide secret key, stored in the
   * container's configuration, passed in via environment variables.
   * @param {*} _config -
   * @param {*} _secret - Thing to encrypt. UTF8, bytes, etc. JSON.stringify don't care.
   * @return {object} - call toString() on the object to get the string
   */
  static encrypt(_config, _secret) {
    let retval = null;
    try {
      let result = CryptoJS.AES.encrypt(JSON.stringify(_secret), _config.plugin.data_secret);
      retval = result.toString();
    } catch (e) {console.log(e); throw new Error('Failed to encrypt.');}
    return retval;
  }


  /**
   * Helper function to validate. Really need to have a plan for config and its validation.
   * @param {*} _config
   * @param {*} _logger
   */
  static _validateConfig(_config, _logger) {
//    _logger.info('config: ', _config);
    let confcheck = doConfigCheck(_config);
    if ( confcheck.valid == false ) {
      _logger.error('Config Validation Errors:\n', confcheck.errors);
      _logger.info(_config);
      throw new Error('Bad configuration');
    } else if ( _config.app.url.slice(-1) != '/' ) {
        throw new Error('app.url needs to end in "/"');
    }
  };
};
