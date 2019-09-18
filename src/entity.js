
/**
 * @typedef WoveonLogger
 */


/**
 */
class WovEntityClient {

  /**
   * Client.
   *
   * @param {WoveonLogger} _l -
   */
  constructor(_l) {
    this.l = _l;
  }

  /**
   * Generate the javascript code to resolve the schema for this client. Override as needed.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  getGraphQLModelResolvers() {
    return {
      modeljs   : '',
      exportsjs : '',
    };
  }

  /**
   * Generates graphql schemas for the client. Override as needed.
   *
   * @return {string} -
   */
  getGraphQLSchemas() { return ''; }
};


/**
 */
class WovEntityModel {

  static cl = null; // WovRemoteClient or WovClient. Set in init()


  /**
   * Client.
   */
  constructor() {
  }


  /**
   * Setup the client (remote or local) and logger.
   *
   * @param {WoveonLogger} _l -
   * @param {WovEntityClient} _woventityclient -
   * @return {undefined} -
   */
  static init(_l, _woventityclient) {
    this.l = _l;
    this.cl = _woventityclient;
  }
};


module.exports = {WovEntityClient, WovEntityModel};
