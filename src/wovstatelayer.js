
/**
 * @typedef Logger
 * @typedef WovModelClient
 * @typedef WovRemoteServiceClient
 * @typedef WovStateLayer
 */

/**
 * The State Layer manages models (which manage Entity CRUD) and connects to remote services
 * to interact with remote Entities.
 */
module.exports = class WovStateLayer {

  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {WovModelClient} _wovmodelclient -
   * @param {WovRemoteServiceClient} _wovrservclient -
   */
  constructor(_l, _wovmodelclient, _wovrservclient) {
    this.modelcl = _wovmodelclient; // new (require('./model'))(logger, _wovdb);
    this.rservcl = _wovrservclient; // new (require('./rserv'))(logger);
  };


  /**
   */
  isInited() { return this._inited; }

  /**
   * Any async calls to set up the layer.
   *
   * @return {WovStateLayer} - returns itself ex. new WovStateLayer(...).init()
   */
  async init() {
    await this.modelcl.init(false, false, true);
    await this.rservcl.init();
    this._inited = true;
    return this;
  }

};
