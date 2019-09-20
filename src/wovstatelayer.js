
/**
 * @typedef WovModelClient
 * @typedef WovModel
 * @typedef WovRemoteServiceClient
 * @typedef WovEntityClient
 * @typedef WovEntityModel
 * @typedef WovStateLayer
 * @typedef Logger
 */

// const Logger               = require('woveon-logger');
const WovModelClient       = require('./wovmodelclient');
const WovRemoteModelClient = require('./wovremotemodelclient');
const Logger               = require('woveon-logger');


/**
 * The State Layer manages models (which manage Entity CRUD) and connects to remote services
 * to interact with remote Entities.
 */
module.exports = class WovStateLayer {

  l        = null; // the loggr object
  _clients = null; // the array of WovEntity Clients this layer has
  _models  = null; // the hash (by lowercase model name) of WovModels this state layer serves (added from clients)


  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovEntityClient>} _woventityclients -
   */
  constructor(_l, _woventityclients) {
    this.l = _l;
    this._clients = _woventityclients;
    this._models  = {};
    this._inited = false;

    // build models into this
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];

      // add to the state layer and check for a few errors
      for (let k in c.table2model) {
        let m = c.table2model[k];
        if ( m == null ) throw Error(`Model of index 'k' is null?`);
        if ( this._models[m.name.toLowerCase()] != undefined ) {
          throw Error(`Model named '${m.name}' of index '${k}' already exists in state layer.`);
        }
        this._models[m.name.toLowerCase()] = m;
        this[m.name] = m;
      }
    }
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
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];
      // this.l.info('init client ', c);
      if ( c instanceof WovModelClient ) {
        await c.init(this, false, true, true);
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
   * Returns the model of the given name.
   *
   * @param {string} _n - model name
   * @return {WovModel} -
   */
  getModel(_n) {
    let retval = this._models[_n.toLowerCase()];
    // Logger.g().info(`getModel ${_n} of models: `, Object.keys(this._models));
    return retval;
  }


  /**
   * Call on each client.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  getGraphQLModelResolvers() {
    let retval = {modeljs : '', exportsjs : ''};

    for (let i=0; i<this._clients.length; i++) {
      let cl = this._clients[i];
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

    for (let i=0; i<this._clients.length; i++) {
      let cl = this._clients[i];
      let result = cl.getGraphQLSchemas();
      retval += result;
    }

    return retval;
  }

};
