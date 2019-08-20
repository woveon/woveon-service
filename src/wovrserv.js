
/**
 * @typedef WoveonLogger
 * @typedef WovRemoteServiceClient
 */

/**
 * A remote service is a connection to another service for data and functionality.
 *
 * This is different from a Model, which is a full CRUD control of an Entity. A remote
 * service is a connection to control of that Entity.
 *
 * By capturing as a first class entity, then we can manage these connections:
 * - test that remote exists
 * - test types and parameters of the remote calls
 * - trace connections between microservices
 */
module.exports = class WovRemoteService {

  static cl = null; // WovRemoteServiceClient

  /**
   * Creates the remote service.
   *
   * @param {object} _options -
   */
  constructor(_options) {
    if ( this.constructor.isInited() == false ) { throw Error(`Creating object of non-inited class ${this.constructor.name}.`); }
    this._options = _options;
    // this.l = _options.logger;
  }


  /**
   * Simple check if `init` has been called on this class definition.
   * @return {boolean} - true if it has, false if not
   */
  static isInited() { let retval = false; if ( this.l != null && this.cl != null ) retval = true; return retval; }

  /**
   * Initialize the model with a logger and client.
   *
   * @param {WoveonLogger}           _logger         - woveon logger
   * @param {WovRemoteServiceClient} _wovrservclient -
   * @return {undefined} -
   */
  static init(_logger, _wovrservclient) {
    this.l = _logger;
    this.cl= _wovrservclient;
  };
};

