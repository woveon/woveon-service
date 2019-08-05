
const expect  = require('chai').expect;
const Service = require('../src/index');

describe('>startstop service', async function() {

  it('start and stop', async function() {

    let ws = new Service({
      name   : 'demo',
      port   : 9001,
      logger : new Service.Logger('logger', {debug : true}),
    });

    expect(ws.name).to.equal('demo');
    expect(ws._options.ver).to.equal('v1');
    expect(ws._options.baseroute).to.equal('/demo/v1');

    new Promise(async function(r, j) {
      await ws.init();
      await ws.startup();
      await ws.doShutdown();
    });
  });
});
