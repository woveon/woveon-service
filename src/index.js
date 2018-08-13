
// let wtf = require('wtfnode'); // debugging code for not cleanly shutting down

const autoBind      = require('auto-bind-inheritance');
const CryptoJS      = require('crypto-js');
const os            = require('os');
const uuidv4        = require('uuid/v4');
const Listener      = require('./listener');
const Requester     = require('./requester');

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
  async onShutdown() {
  };


  /**
   * For now, just return true.
   * @return {bool} - true, since still running
   */
  async onHealth() {
    return this.listener.retSuccess(true);
  };

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
  constructor(_name, _options = {name : '', port : 80, logger : null,  staticdir : null, baseroute : null}) {
    autoBind(this);

    this._options = _options;
    this.name     = this._options.name || _name;
    delete this._options.name; // only one location for name
    this.internal_address = null;
    this.external_address = null;

    this.logger = this._options.logger || new Logger(this.name, {}, {'service' : {'color' : 'blue'}, 'showname' : true});
    this.logger.aspect('service', '---------------------------------------------------------------------');
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', ' Woveon Service');
    this.logger.aspect('service', `  :: ${this.name}`);
    this.logger.aspect('service', '--------------------------------------------------------------------');
    this.logger.aspect('service', `  options: ${JSON.stringify(this._options)}`);
    this.logger.aspect('service', '---------------------------------------------------------------------');

    // default route is /service/ver, when baseroute is null
    // this.logger.info('Base route is :', this._options.baseroute, _options);
    if ( this._options.baseroute == null ) {
      this._options.baseroute = `/${this.name.toLowerCase()}/${this._options.ver}`;
    }

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
      this.logger.aspect('service-levels', '  ... service startup');
      await this.listener.listen();

      this.logger.verbose('  ...startup: service listening on: ', JSON.stringify(this.listener.server.address()));
      this.internal_address = this.listener.server.address(); // port and family
      // this.family  = this.listener.server.address().family;
      // this.port    = this.listener.server.address().port;

      // request ip calls the microservice that will call it, to verify this MS's ip address
      // this.logger.info('requestip : ', this._options.requestip, ' but skipping! for now, using network interface.');
      // get ip address from network interfaces (will return a local ip, so switching to asking WL)
      let ifacess = os.networkInterfaces();
      let ifaces = ifacess['eth0'] || ifacess['en0'] || ifacess['lo0']; // os.networkInterfaces()['eth0'];
      if ( ifaces== null ) {
        this.logger.error('interfaces:', os.networkInterfaces());
        this.logger.throwError(`Can't find network interface 'eth0', 'en0' or 'lo0'.`);
      }

      let that = this;
      ifaces.forEach(function(iface) {
        if (that.internal_address.family !== iface.family || iface.internal !== false) { // 'IPv4' most likely
          // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
          return;
        }
        that.external_address = iface.address; // this.listener.server.address().address;
        that.logger.verbose('address from iface is:', iface.address);
      });
      this.logger.verbose('service listening on internal IP address address: ', this.internal_address);
      this.logger.verbose('service listening on non-internal IP address address: ', this.external_address);

      await this.onStartup();
      await this.onPostStartup();

    } catch (err) {this.logger.error(err); throw new Error(`run failed`);};
  };


  /**
   * Turns off the service by closing the listener.
   * NOTE: Make sure your service already shut down anything it was managing in onShutdown.
   */
  async shutdown() {
    this.logger.aspect('service-levels', '  ... service shutdown');
    await this.onShutdown();
    if ( this.db ) await this.db.close();
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
  static generateToken() { return uuidv4(); }


  /**
   * Used to generate tokens. Uses upperalpha/number chars.
   * @param {int} length - defaults to 20 if empty
   * @return {string} - random length string
   */
  static generateRandomString(length = 20) {
    return CryptoJS.randomBytes(length).toString('hex');
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
module.exports.Requester   = Requester;
module.exports.Logger      = Logger;
module.exports.ModelLoader = ModelLoader;