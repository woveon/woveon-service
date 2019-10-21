
/**
 * @typedef WoveonLogger
 * @typedef WovRemoteServiceClient
 * @typedef integer
 */

const entity = require('./entity');
const WR     = require('./wovreturn');
const util   = require('util');
const Requester = require('./requester');

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
module.exports = class WovRemoteModel extends entity.WovEntityModel {

  // static cl = null; // WovRemoteServiceClient

  /**
   * Creates the remote service.
   *
   * @param {object} _options -
   */
  constructor(_options) {
    super();
    if ( this.constructor.isInited() == false ) { throw Error(`Creating object of non-inited class ${this.constructor.name}.`); }
    this._options = _options;
  }


  /**
   * Simple check if `init` has been called on this class definition.
   *
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
    Object.getPrototypeOf(this).init(_logger, _wovrservclient);
    // this.l = _logger;
    // this.cl= _wovrservclient;
  };


  /**
   * Returns the data.
   *
   * @param {integer} _id -
   * @return {object} -
   */
  static async getByID(_id) { throw Error(`getByID on ${this.name} needs to be impleemnted`); }


  /**
   * Overlysimple GraphQL call.
   *
   * @param {string} _qtype - ex. query or mutation
   * @param {string} _qname - name of the GraphQL query
   * @param {object} _din   - data in, passed to the one assumed 'input' param; if only a numbr, then assume id query
   * @param {string} _dout  - attributes returned
   * @return {WR} - attributes returned in data
   */
  static async callGraphQL(_qtype, _qname, _din, _dout) {
    let q = null;
    if ( (typeof _din) == 'number' ) { q = `${_qtype} { get${_qname}(id : ${_din}) { ${_dout} } }`; }
    else q = `${_qtype} { ${_qname}(input : ${_din}) { ${_dout} } }`;

    // let q = `${_qtype} { ${_qname}(input : ${JSON.stringify(_din)}) { ${_dout} }`;
    this.l.info('q: ', q);
    let retval = await this.cl.ms.post('/graphql', null, {query : q});
    this.l.info('retval: ', JSON.stringify(retval, null, 2) );

    /*
    if ( r.statusCode != 200 ) {
      retval = WR.retError({qname : _qname, qin : _din}, `Failed GraphQL call "${_qtype}:${_qname}"`);
    }
    else { retval = WR.retSuccess(r.data.data[qname]); }
    */
    return retval;
  }

};

