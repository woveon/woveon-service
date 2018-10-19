
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
 *   - Defining:
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
module.exports = class Config {


  /**
   * @param {Logger} _logger - will create one if null
   * @param {array} _conf - environment variables this microservice uses (for K8s ConfigMap)
   * @param {array} _sconf - private/secure environment variables this microservice uses (for K8s Secrets)
   * @param {boolean} blankenvvars - by default, sets all env vars to undefined, so your program MUST pull from config
   */
  constructor(_logger, _conf, _sconf, {blankenvvars} = {blankenvvars : true}) {

    if ( module.exports.staticconfig != 1 ) { _logger.throwError('Calling Config constructor multiple times'); }
    module.exports.staticconfig = this;

    this.conf = {};
    this.sconf = {};
    this.logger = _logger ||  new Logger('config',
      {showName : true, debug : true, level : 'verbose'},
      {'listener' : true, 'requester' : true, 'listener.route' : true});

    this.emsg = [];
    this.wmsg = [];

    // all should have this:
    //   - WOV_STAGE - the curret stage the microservice is running in
    //   - WOV_ME    - who the developer is (which may be the stagename)
    _conf.push('WOV_STAGE', 'WOV_ME');

    // Apply each in _conf and _sconf 
    for (let i=0; i<_conf.length; i++) {
      let vn = _conf[i];
      let v = process.env[vn];
      // console.log('v: un', v, ' ', v === undefined, ' ', v == undefined, ' ', v == 'undefined');
      // console.log('v: nu', v, ' ', v === null, ' ', v == null, ' ', v == 'null');
      if ( v == 'undefined') { this.emsg.push(`env variable ${vn} is not defined`); v = undefined; }
      else {
        if ( v == 'null' ) v = null;
        if ( v == null || v == '' ) { this.wmsg.push(`env variable ${vn} is '${v}'`); }
        this.logger.aspect('config', vn + ': '+ v);
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
        this.logger.aspect('config', vn + ' (s): '+ v);
        this.sconf[vn] = v;
        if ( blankenvvars ) process.env[vn] = undefined;
      }
    }

    // console.log('emsg: ', this.emsg);
    if ( this.emsg.length != 0 ) { this.logger.throwError('Config Error: ', this.emsg); }
    if ( this.wmsg.length != 0 ) {
      this.logger.warn('Config Warning: (', this.wmsg.length, ')'); 
      for(let i=0; i<this.wmsg.length; i++) { this.logger.warn(i+1, ') ', this.wmsg[i]); }
    }

  }

  static get(_v) { 
    if ( module.exports.staticconfig == 1 ) throw new Error(`Config not inited: get("${_v}")`);
    let retval = module.exports.staticconfig.conf[_v];
    if ( retval === undefined ) {
      if ( module.exports.staticconfig.sconf[_v] !== undefined ) 
        module.exports.staticconfig.logger.throwError(`Undefined config '${_v}': but it is in sconf. Try 'sget("${_v}")'`);
      else if ( process.env[_v] !== undefined ) 
        module.exports.staticconfig.logger.throwError(`Undefined config '${_v}': but it is an environment variable. Add '${_v}' to config constructor.`);
      else module.exports.staticconfig.logger.throwError(`Undefined config '${_v}': set the environment variable and add to instantiation of Config`);
    }
    return retval;
  }
  static sget(_v) { 
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    let retval = module.exports.staticconfig.sconf[_v];
    if ( retval === undefined ) {
      if ( module.exports.staticconfig.conf[_v] !== undefined ) 
        module.exports.staticconfig.logger.throwError(`Undefined secure config '${_v}': but it is in conf. Try 'get("${_v}")'`);
      else if ( process.env[_v] !== undefined ) 
        module.exports.staticconfig.logger.throwError(`Undefined secure config '${_v}': but it is an environment variable. Add '${_v}' to secure config constructor.`);
      else module.exports.staticconfig.logger.throwError(`Undefined secure config '${_v}': add to instantiation of Config`);
    }
    return retval;
  }

  _genK8SConfigMap() {
    let retval = '';
    for (let p in this.conf) { if (this.conf.hasOwnProperty(p)) retval += `${p}=${this.conf[p]}\n`; }
    return retval;
  }

  static genK8SConfigMap() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig._genK8SConfigMap();
  }

  _genK8SSecrets() {
    let retval = '';
    for (let p in this.sconf) { if (this.sconf.hasOwnProperty(p)) retval += `${p}=${this.sconf[p]}\n`; }
    return retval;
  }

  static genK8SSecrets() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    return module.exports.staticconfig._genK8SSecrets();
  }

  toString(_pretty = false) {
    let spacer = null;
    if ( _pretty ) spacer = '  ';
    let retval = `${this.constructor.name} {`;
    retval += ` conf : ${JSON.stringify(this.conf, null, spacer)},`;
    retval += ` sconf : ${JSON.stringify(this.sconf, null, spacer)},`;
    if ( this.wmsg.length > 0 ) { retval += ` wmsg: ${JSON.stringify(this.wmsg, null, spacer)},`; }
    if ( this.emsg.length > 0 ) { retval += ` emsg: ${JSON.stringify(this.emsg, null, spacer)},`; }
    retval += `}`;
    return retval;
  }

  static isInited() {
    if ( module.exports.staticconfig == 1 ) return false;
    return true;
  }

  static displayMe() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    module.exports.staticconfig.logger.info(module.exports.staticconfig.toString(true));
  }

};

module.exports.staticconfig = 1;
