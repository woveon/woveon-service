

// const Logger  = require('woveon-logger');
const Service = require.main.require('src/index');
// const WR      = Service.WovReturn;


module.exports = function() {

  const Store = class Store extends Service.WovModel {
    static tablename = 'store';
  };

  const Vehicle = class Vehicle extends Service.WovModel { static tablename = 'vehicle'; };
  Vehicle.setSchema({schema : {numtires : 'integer'}});

  const Car = class Car extends Vehicle { static tablename = 'car'; };
  Car.setSchema({
    schema : {
      nameplate : 'text',
      make      : 'text',
      license   : 'text',
      state     : 'text',
      combo     : 'text',
    },
    trans     : {},
    erels     : {},
    sensitive : ['combo'],
  });

  return {Store, Vehicle, Car};
};
