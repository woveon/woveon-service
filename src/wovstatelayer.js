
/**
 * @typedef WovModelClient
 * @typedef WovRemoteServiceClient
 * @typedef WovEntityClient
 * @typedef WovEntityModel
 * @typedef WovStateLayer
 */

const Logger               = require('woveon-logger');
const WovModelClient       = require('./wovmodelclient');
const WovRemoteModelClient = require('./wovremotemodelclient');

/**
 * The State Layer manages models (which manage Entity CRUD) and connects to remote services
 * to interact with remote Entities.
 */
module.exports = class WovStateLayer {

  // the WovEntity Clients this layer has
  clients;

  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovEntityClient>} _woventityclients -
   */
  constructor(_l, _woventityclients) {
    this.l = _l;
    this.clients = _woventityclients;
  };


  /**
   * Simple check if this has been inited.
   *
   * @return {boolean} -
   */
  isInited() { return this._inited; }

  /**
   * Any async calls to set up the layer.
   *
   * @return {WovStateLayer} - returns itself ex. new WovStateLayer(...).init()
   */
  async init() {
    // this.l.info('WovStateLayer init called');
    for (let i=0; i<this.clients.length; i++ ) {
      let c = this.clients[i];
      // this.l.info('init client ', c);
      if ( c instanceof WovModelClient ) {
        await c.init(this, false, false, true);
      }
      else if ( c instanceof WovRemoteModelClient ) {
        await c.init(this);
      }
      else {
        this.l.error('Unknown client to init in state layer : ', c);
      }
    }
    this._inited = true;
    return this;
  }

  /**
   * Call on each client.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  getGraphQLModelResolvers() {
    let retval = {modeljs : '', exportsjs : ''};

    for (let i=0; i<this.clients.length; i++) {
      let cl = this.clients[i];
      let result = cl.getGraphQLModelResolvers();
      retval.modeljs += result.modeljs;
      retval.exportsjs += result.exportsjs;
    }

    return retval;
  }


  /**
   * Call on each client.
   *
   * @return {string} - all schemas
   */
  getGraphQLSchemas() {
    let retval = '';

    for (let i=0; i<this.clients.length; i++) {
      let cl = this.clients[i];
      let result = cl.getGraphQLSchemas();
      retval += result;
    }

    return retval;
  }

};
