

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

  const Tire = class Tire extends Service.WovModel { static tablename = 'tire'; };
  Tire.setSchema({
    schema : {brand : 'text', model : 'text', position : 'text', _car_ref : 'integer'}, //  wear : 'float', NO WEAR!!!
    erels  : {car : 'many'},
  });

  const Wheel = class Wheel extends Service.WovModel { static tablename = 'wheel'; };
  Wheel.setSchema({
    schema : {style : 'text', _tire_ref : 'integer'},
    erels  : {tire : 'one'},
  });

  return {Store, Vehicle, Car, Tire, Wheel};
};
