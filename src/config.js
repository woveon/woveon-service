/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const Logger = require('woveon-logger');
/**
 * Config is a single object managing configuration information pulled from the environment.
 *
 * It reads in environment variables, ensures they are set, and serves as a single point of
 * these during runtime. This means you get environment variable simplicity, and can manage
 * these in one location, as opposed to having env vars scattered throughout your code.
 *
 *
 * Usage:
 *
 * - Defining:
 *
 *      // Don't pass in variables, as they should be the same for runtime each time
 *      class MyConfig extends Config {
 *        constructor(_logger) {
 *          super(_logger, [ 'ENV_VAR_1', 'ENV_VAR_2' ], [ 'SECRET_VAR_1', 'SECRET_VAR_2' ] );
 *        }
 *      }
 *
 *   - Creation:
 *
 *      // Just create and forget. You only call static methods.
 *      new MyConfig(new Logger());
 *
 *
 * Useful functionality (static):
 *
 *   - The get/sget methods return the variables.
 *       MyConfig.get('ENV_VAR_1');
 *       MyConfig.sget('SECRET_VAR_1');
 *
 *   - The genK8S[ConfigMap|Secrets] dump the variables in a format for Kubernetes configuration.
 *       ex. MyConfig.genK8SConfigMap()
 *       ENV_VAR_1=X
 *       ENV_VAR_2=Y
 *
 *   - The isInited is a test if the config has been created (probably only need in special cases).
 *
 *   - The displayMe prints the config at runtime for human viewing.
 *
 *
 * Gotchas:
 *  - Variables are deleted in this shell once read in to avoid using the process.env version
 *    in your code and being sloppy (unless you set the option "blankenvvars" to false).
 *  - It should be overloaded via inheritance and not just created with variables passed
 *    to it. This enables the static methods for generating K8s config to work properly.
 *  - There is only one config object ever created, so you need to create the object
 *    once and call static methods on it. This enables the variable to be accessed across
 *    all files, in whatever form it is instantiated as (i.e. overloaded via inheritance).
 *
 *
 */

/**
 * @typedef Promise
 * @typedef class
 */

module.exports = class Config {


  /**
   * Generic function to add array of vars to the config.
   *
   * @param {Logger} _l -
   * @param {Array<string>} _vars - variables to add
   * @param {object} _dest - object that stores variables
   * @param {string} _emsg - error message
   * @param {string} _wmsg - warning message
   * @param {string} _extra - additional message on error/warning
   * @param {Array<string>} _blankenvvars - variables to undefine in the array
   * @return {undefined} -
   */
  static _addInVars(_l, _vars, _dest, _emsg, _wmsg, _extra, _blankenvvars) {
    _l.aspect('config', `  _addInVars : _blankenvvars ${_blankenvvars} : `, _vars);

    for (let i=0; i<_vars.length; i++) {
      let vn = _vars[i];
      let v = process.env[vn];
      // console.log('v: un', v, ' ', v === undefined, ' ', v == undefined, ' ', v == 'undefined');
      // console.log('v: nu', v, ' ', v === null, ' ', v == null, ' ', v == 'null');
      // console.log('v : ', v, _extra, v == 'undefined');
      if ( v == 'undefined') { _emsg.push(`${_extra}env variable ${vn} is not defined`); v = undefined; }
      else {
        if ( v == 'null' ) v = null;
        if ( v == null || v == '' ) { _wmsg.push(`${_extra}env variable ${vn} is '${v}'`); }
        _l.aspect('config', vn + ': '+ v);
        _dest[vn] = v;
        if ( _blankenvvars ) {
          process.env[vn] = undefined;
          // console.log(`**** blank env var ${vn}.`);
        }
      }
    }
  }


  /**
   * Print results and such.
   *
   * @param {Logger} _l - woveon logger
   * @param {Array} _wmsg - array of warnings
   * @param {Array} _emsg - array of errors
   * @return {undefined} -
   */
  static _reviewResults(_l, _wmsg, _emsg) {
    if ( _emsg.length != 0 ) { _l.throwError('Config Error: ', _emsg); }
    if ( _wmsg.length != 0 ) {
      _l.warn('Config Warning: (', _wmsg.length, ')');
      for (let i=0; i<_wmsg.length; i++) { _l.warn(i+1, ') ', _wmsg[i]); }
    }
  }


  /**
   * Constructor.
   *
   * @param {Logger} _logger - will create one if null
   * @param {Array<string>} _conf - environment variables this microservice uses (for K8s ConfigMap)
   * @param {Array<string>} _sconf - private/secure environment variables this microservice uses (for K8s Secrets)
   * @param {object} _options -
   * - blankenvvars - by default, sets all env vars to undefined, so your program MUST pull from config
   * - wovtools - add in WovTools variables if true
   */
  constructor(_logger, _conf, _sconf, _options = null) {
    let options = Object.assign({}, {blankenvvars : true, wovtools : true}, _options);

    this.l = _logger ||  new Logger('config',
      {showName : true, debug : true, level : 'verbose'},
      {'listener' : true, 'requester' : true, 'listener.route' : true});

    // this.l.info('options : ', options, _options);
    // this.l.info('conf : ', _conf);
    // this.l.info('sconf : ', _sconf);
    // this.l.info('***Config constructor called');
    // this.l.printStack();

    if ( module.exports.staticconfig != 1 ) { this.l.throwError('Calling Config constructor multiple times'); }
    module.exports.staticconfig = this;

    if ( _conf == null )  this.l.throwError(`Config constructor requires an array for '_conf'.`);
    if ( _sconf == null ) this.l.throwError(`Config constructor requires an array for '_sconf'.`);

    this.conf  = {};
    this.sconf = {};
    this._data  = {};

    this.emsg = [];
    this.wmsg = [];

    // all WovTools configs should have this:
    //   - WOV_PROJECT - the name of the project
    //   - WOV_STAGE - the curret stage the microservice is running in
    //   - WOV_ME    - who the developer is (which may be the stagename)
    if ( options.wovtools ) {
      // console.log(`ading in 'WOV_STAGE', 'WOV_ME', 'WOV_PROJECT'`);
      _conf.push('WOV_STAGE', 'WOV_ME', 'WOV_PROJECT');
    }

    // Apply each in _conf and _sconf
    module.exports._addInVars(this.l, _conf,  this.conf,  this.emsg, this.wmsg, '',        options.blankenvvars);
    module.exports._addInVars(this.l, _sconf, this.sconf, this.emsg, this.wmsg, 'secure ', options.blankenvvars);

    /*
    for (let i=0; i<_conf.length; i++) {
      let vn = _conf[i];
      let v = process.env[vn];
      // console.log('v: un', v, ' ', v === undefined, ' ', v == undefined, ' ', v == 'undefined');
      // console.log('v: nu', v, ' ', v === null, ' ', v == null, ' ', v == 'null');
      if ( v == 'undefined') { this.emsg.push(`env variable ${vn} is not defined`); v = undefined; }
      else {
        if ( v == 'null' ) v = null;
        if ( v == null || v == '' ) { this.wmsg.push(`env variable ${vn} is '${v}'`); }
        this.l.aspect('config', vn + ': '+ v);
        this.conf[vn] = v;
        if ( blankenvvars ) process.env[vn] = undefined;
      }
    }

    for (let i=0; i<_sconf.length; i++) {
      let vn = _sconf[i];
      let v = process.env[vn];
      // console.log('v: ', v);
      if ( v == 'undefined' ) { this.emsg.push(`secure env variable ${vn} is not defined`); v = undefined; }
      else {
        if ( v == 'null' ) v = null;
        if ( v == null || v == '' ) { this.wmsg.push(`secure env variable ${vn} is '${v}'`); }
        this.l.aspect('config', vn + ' (s): '+ v);
        this.sconf[vn] = v;
        if ( blankenvvars ) process.env[vn] = undefined;
      }
    }
    */

    // console.log('emsg: ', this.emsg);
    module.exports._reviewResults(this.l, this.wmsg, this.emsg);
    /*
    if ( this.emsg.length != 0 ) { this.l.throwError('Config Error: ', this.emsg); }
    if ( this.wmsg.length != 0 ) {
      this.l.warn('Config Warning: (', this.wmsg.length, ')');
      for (let i=0; i<this.wmsg.length; i++) { this.l.warn(i+1, ') ', this.wmsg[i]); }
    }
    */

    module.exports.blockForInit(); // call to make sure next function exists
    // console.error('setting static promise resolve', module.exports.staticpromiseresolve);
    module.exports.staticpromiseresolve(this);
  }


  /**
   * Returns a config variable.
   *
   * @param {string} _k - environment variable
   * @return {string} - value for the key
   */
  static get(_k) {
    if ( module.exports.staticconfig == 1 ) throw new Error(`Config not inited: get("${_k}")`);
    let retval = module.exports.staticconfig.conf[_k];
    if ( retval === undefined ) {
      if ( module.exports.staticconfig.sconf[_k] !== undefined ) {
        module.exports.staticconfig.l.throwError(`Undefined config '${_k}': but it is in sconf. Try 'sget("${_k}")'`);
      }
      else if ( process.env[_k] !== undefined ) {
        module.exports.staticconfig.l.throwError(`Undefined config '${_k}': but it is an environment variable. Add '${_k}' to config constructor.`);
      }
      else module.exports.staticconfig.l.throwError(`Undefined config '${_k}': set the environment variable and add to instantiation of Config`);
    }
    return retval;
  }


  /**
   * Returns secret variable. Same as sget, but gET is same number of characters as 'get'.
   *
   * @param {string} _k - environment variable
   * @return {string} - value for the key
   */
  static gET(_k) { return this.sget(_k); }


  /**
   * Returns secret variable. Same as gET.
   *
   * @param {string} _k - environment variable
   * @return {string} - value for the key
   */
  static sget(_k) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    let retval = module.exports.staticconfig.sconf[_k];
    if ( retval === undefined ) {
      if ( module.exports.staticconfig.conf[_k] !== undefined ) {
        module.exports.staticconfig.l.throwError(`Undefined secure config '${_k}': but it is in conf. Try 'get("${_k}")'`);
      }
      else if ( process.env[_k] !== undefined ) {
        module.exports.staticconfig.l.throwError(`Undefined secure config '${_k}': but it is an environment variable. Add '${_k}' to secure config constructor.`);
      }
      else module.exports.staticconfig.l.throwError(`Undefined secure config '${_k}': add to instantiation of Config`);
    }
    return retval;
  }

  /**
   * Do (re)Set a value later.
   *
   * @param {string} _k - key
   * @param {string} _v - value
   * @return {undefined} -
   */
  static set(_k, _v) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports.staticconfig.conf[_k] = _v;
  }


  /**
   * Do (re)sSet a value later.
   *
   * @param {string} _k - key
   * @param {string} _v - value
   * @return {undefined} -
   */
  static sset(_k, _v) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports.staticconfig.sconf[_k] = _v;
  }


  /**
   * Add a value later.
   *
   * @param {string} _k - key
   * @param {boolean} _blankenvvars - if true, deletes the env var from the current environment
   * @return {undefined} -
   */
  static add(_k, _blankenvvars = true) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports._addInVars(module.exports.staticconfig.l, [_k], module.exports.staticconfig.conf, module.exports.staticconfig.emsg, module.exports.staticconfig.wmsg, '', _blankenvvars);
    module.exports._reviewResults(module.exports.staticconfig.l, module.exports.staticconfig.wmsg, module.exports.staticconfig.emsg);
  }


  /**
   * Secure add a value later.
   *
   * @param {string} _k - key
   * @param {boolean} _blankenvvars - if true, deletes the env var from the current environment
   * @return {undefined} -
   */
  static sadd(_k, _blankenvvars = true) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports._addInVars(module.exports.staticconfig.l, [_k], module.exports.staticconfig.sconf, module.exports.staticconfig.emsg, module.exports.staticconfig.wmsg, 'secure ', _blankenvvars);
    module.exports._reviewResults(this.l, this.wmsg, this.emsg);
  }


  /**
   * Outputs a Kubernetes ConfigMap from these vars.
   *
   * @return {string} -
   */
  _genK8SConfigMap() {
    let retval = '';
    for (let p in this.conf) { if (this.conf.hasOwnProperty(p)) retval += `${p}=${this.conf[p]}\n`; }
    return retval;
  }


  /**
   * Outputs a Kubernetes ConfigMap from these vars.
   *
   * @return {string} -
   */
  static genK8SConfigMap() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig._genK8SConfigMap();
  }


  /**
   * Outputs a Kubernetes Secrets file from these vars.
   *
   * @return {string} -
   */
  _genK8SSecrets() {
    let retval = '';
    for (let p in this.sconf) { if (this.sconf.hasOwnProperty(p)) retval += `${p}=${this.sconf[p]}\n`; }
    return retval;
  }


  /**
   * Outputs a Kubernetes Secrets file from these vars.
   *
   * @return {string} -
   */
  static genK8SSecrets() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig._genK8SSecrets();
  }


  /**
   * Converts this config object to string.
   *
   * @param {boolean} _pretty - add spacers to make it pretty
   * @return {string} -
   */
  toString(_pretty = false) {
    let spacer = null;
    if ( _pretty ) spacer = '  ';
    let retval = `${this.constructor.name} {`;
    retval += ` conf : ${JSON.stringify(this.conf, null, spacer)},`;
    retval += ` sconf : ${JSON.stringify(this.sconf, null, spacer)},`;
    retval += ` data : ${JSON.stringify(Object.keys(this._data), null, spacer)},`;
    if ( this.wmsg.length > 0 ) { retval += ` wmsg: ${JSON.stringify(this.wmsg, null, spacer)},`; }
    if ( this.emsg.length > 0 ) { retval += ` emsg: ${JSON.stringify(this.emsg, null, spacer)},`; }
    retval += `}`;
    return retval;
  }


  /**
   * Set data on the Config for later use.
   *   ex. Not  'get("A")' but C.A.
   *
   * @param {string} _key - the key for the data
   * @param {object} _val - data attached to config
   * @return {undefined} -
   */
  static setData(_key, _val) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports.staticconfig._data[_key] = _val;
  }


  /**
   * Return the data.
   *
   * @param {string} _key - the key for the data
   * @return {object} - returns data
   */
  static data(_key) {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig._data[_key];
  }


  /**
   * Checks if a static config object exists.
   *
   * @return {boolean} - true/false
   */
  static isInited() {
    if ( module.exports.staticconfig == 1 ) return false;
    return true;
  }


  /**
   * Display.
   *
   * @return {undefined} -
   */
  static displayMe() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports.staticconfig.l.info(module.exports.staticconfig.toString(true));
  }


  /**
   * Returns the static Config object logger.
   *
   * @return {Logger/Error} - Error if not inited yet
   */
  static getLogger() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig.l;
  }


  /**
   * Blocks for Config to be created. If _class and _logger are passed, will create it here.
   *
   * @param {class} _class - the child class of this, which will create a Config
   * @param {Logger} _logger - the logger to use
   * @param {boolean} _displayOnCreation - if true, will display the config when it is created
   * @return {Promise} -
   */
  static async blockForInit(_class, _logger, _displayOnCreation = false) {
    // console.error('blockForInit : called ', __filename);
    if ( module.exports.staticpromise == 1 ) {
      // console.error('blockForInit : pre setting resolve func');
      // javascript witchcraft. this creates an external resolve function to the promise that everything is waiting on
      module.exports.staticpromise = new Promise((res, rej)=>{
        // console.error('blockForInit : setting resolve func: ', res);
        module.exports.staticpromiseresolve = res;
      });
      // console.error('blockForInit : post setting resolve func');

      if ( _displayOnCreation) { module.exports.staticpromise.then( () => { Config.displayMe(); }); }
    }
    if ( _class != null ) {
      if ( !_class.isInited() ) {
        // _logger.info(`Initing ${_class.constructor.name}.`);
        new _class(_logger);
        // _logger.info(`post Initing ${_class.constructor.name}.`);
        // if ( _displayOnCreation) { _class.displayMe(); }
      }
    }
    return module.exports.staticpromise;
  }

};


module.exports.staticconfig  = 1;
module.exports.staticpromise = 1;
