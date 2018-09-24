
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
      // console.log('v: ', v, ' ', v === undefined, ' ', v == undefined, ' ', v == 'undefined');
      if ( v == 'undefined') { this.emsg.push(`env variable ${vn} is not defined`); }
      else {
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
      if ( v == 'undefined' ) { this.emsg.push(`secure env variable ${vn} is not defined`); }
      else {
        if ( v == null || v == '' ) { this.wmsg.push(`secure env variable ${vn} is '${v}'`); }
        this.logger.aspect('config', vn + ' (s): '+ v);
        this.sconf[vn] = v;
        if ( blankenvvars ) process.env[vn] = undefined;
      }
    }

    // console.log('emsg: ', this.emsg);
    if ( this.emsg.length != 0 ) { this.logger.throwError('Config Error: ', this.emsg); }
    if ( this.wmsg.length != 0 ) { this.logger.warn('Config Warning: ', this.wmsg); }
  }

  get(_v) { 
    let retval = this.conf[_v];
    if ( retval === undefined ) {
      if ( this.sconf[_v] !== undefined ) 
        this.logger.throwError(`Undefined config '${_v}': but it is in sconf. Try 'sget("${_v}")'`);
      else if ( process.env[_v] !== undefined ) 
        this.logger.throwError(`Undefined config '${_v}': but it is an environment variable. Add '${_v}' to config constructor.`);
      else this.logger.throwError(`Undefined config '${_v}': set the environment variable and add to instantiation of Config`);
    }
    return retval;
  }
  sget(_v) { 
    let retval = this.sconf[_v];
    if ( retval === undefined ) {
      if ( this.conf[_v] !== undefined ) 
        this.logger.throwError(`Undefined secure config '${_v}': but it is in conf. Try 'get("${_v}")'`);
      else if ( process.env[_v] !== undefined ) 
        this.logger.throwError(`Undefined secure config '${_v}': but it is an environment variable. Add '${_v}' to secure config constructor.`);
      else this.logger.throwError(`Undefined secure config '${_v}': add to instantiation of Config`);
    }
    return retval;
  }

  genK8SConfigMap() {
    let retval = `# generated from ${this.constructor.name}\n`;
    for (let p in this.conf) { if (this.conf.hasOwnProperty(p)) retval += `${p}=${this.conf[p]}\n`; }
    return retval;
  }

  genK8SSecrets() {
    let retval = `# generated from ${this.constructor.name}\n`;
    for (let p in this.sconf) { if (this.sconf.hasOwnProperty(p)) retval += `${p}=${this.sconf[p]}\n`; }
    return retval;
  }

  toString() {
    let retval = `${this.constructor.name} {`;
    retval += ` conf : ${JSON.stringify(this.conf, null, null)},`;
    retval += ` sconf : ${JSON.stringify(this.sconf, null, null)},`;
    retval += '}';
    return retval;
  }

};
