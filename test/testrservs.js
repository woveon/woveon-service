

// const Logger  = require('woveon-logger');
const Service = require.main.require('src/index');
// const WR      = Service.WovReturn;


module.exports = function() {

  const Store = class Store extends Service.WovRemoteModel {
  };

  return {Store};
};
