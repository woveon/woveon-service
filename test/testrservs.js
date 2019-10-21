

// const Logger  = require('woveon-logger');
const Service = require.main.require('src/index');
// const WR      = Service.WovReturn;


module.exports = function() {

  const Store = class Store extends Service.WovRemoteModel {
  };

  const Car = class Car extends Service.WovRemoteModel {
  };

  return {Store, Car};
};
