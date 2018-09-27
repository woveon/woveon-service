
/**
 * A single object that reads in environment variables, ensures they are set, and serves as a single point of these during running. This means you get environment variable simplicity, and can manage it in one location. As well, this divides them into non-secure/secure, and can export them, useful for creating Kubernetes ConfigMaps and Secure files.
 */
module.exports = class Config {


  /**
   * @param {array} _conf - environment variables this microservice uses (for K8s ConfigMap) 
   * @param {array} _sconf - private/secure environment variables this microservice uses (for K8s Secrets) 
   * @param {boolean} blankenvvars - by default, sets all env vars to undefined, so your program MUST pull from config
   */
  constructor(_logger, _conf, _sconf, {blankenvvars} = {blankenvvars : true}) {

    if ( module.exports.staticconfig != 1 ) { _logger.throwError('Calling Config constructor multiple times'); }
    module.exports.staticconfig = this;

    this.conf = {};
    this.sconf = {};
    this.logger = _logger;

//    console.log('blankenvvars: ', blankenvvars);
//    console.log('conf : ', _conf);
//    console.log('sconf: ', _sconf);

    this.emsg = [];
    this.wmsg = [];

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
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
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

  static genK8SConfigMap() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    let retval = '';
    for (let p in module.exports.staticconfig.conf) { if (module.exports.staticconfig.conf.hasOwnProperty(p)) retval += `${p}=${module.exports.staticconfig.conf[p]}\n`; }
    return retval;
  }

  static genK8SSecrets() {
    if ( module.exports.staticconfig == 1 ) throw new Error('Config not inited');
    let retval = '';
    for (let p in module.exports.staticconfig.sconf) { if (module.exports.staticconfig.sconf.hasOwnProperty(p)) retval += `${p}=${module.exports.staticconfig.sconf[p]}\n`; }
    return retval;
  }

  toString() {
    let retval = `${this.constructor.name} {`;
    retval += ` conf : ${JSON.stringify(this.conf, null, null)},`;
    retval += ` sconf : ${JSON.stringify(this.sconf, null, null)},`;
    if ( this.wmsg.length > 0 ) { retval += ` wmsg: ${JSON.stringify(this.wmsg, null, null)},`; }
    if ( this.emsg.length > 0 ) { retval += ` emsg: ${JSON.stringify(this.emsg, null, null)},`; }
    retval += `}`;
    return retval;
  }

};

module.exports.staticconfig = 1;
