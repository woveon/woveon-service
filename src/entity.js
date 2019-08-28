
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

  /**
   * Client.
   */
  constructor() {
  }
};


module.exports = {WovEntityClient, WovEntityModel};
