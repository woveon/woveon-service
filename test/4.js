const Service = require('../src/index');
const ML      = require('../src/modelloader');
const expect  = require('chai').expect;

let logger    = new Service.Logger('logger', {debug : true});

// console.log('LOGGER: ', logger.toString());

let c = null;

function setEnvs() {
  Service.Config.staticconfig = 1; // avoid error
  process.env.A = 'A';
  process.env.B = 'B';
  process.env.C = 'C';
  process.env.X  = null;
  process.env.sX = null;
  process.env.Y  = '';
  process.env.sY = '';
  process.env.Z  = undefined;
  process.env.sZ = undefined;
}


// catch errors of undefined env variables
setEnvs();
try {
  new Service.Config(logger, ['A', 'B', 'Z'], ['C', 'sZ'], {wovtools : false});
  expect(1 == 0 ).to.be.true; // should never reach this
} catch (err) {
  console.log(err.message);
  expect(err.message.includes('env variable Z is not defined,secure env variable sZ is not defined')).to.be.true;
}

// catch null
setEnvs();
new Service.Config(logger, ['A', 'B', 'X'], ['C', 'sX'], {wovtools : false});
// logger.info('config: ', Service.Config.staticconfig);//.toString());
expect(Service.Config.staticconfig.wmsg.length).to.equal(2);

// catch ''
setEnvs();
new Service.Config(logger, ['A', 'B', 'Y'], ['C', 'sY'], {wovtools : false});
expect(Service.Config.staticconfig.wmsg.length).to.equal(2);

setEnvs();
expect(process.env.A == 'A').to.be.true;
new Service.Config(logger, ['A', 'B'], ['C'], {blankenvvars : false, wovtools : false});
/*
c = Service.Config;
// logger.info('c: ', c.toString());
logger.info('A: ', c.get('A'), process.env.A);
logger.info('B: ', c.get('B'));
try { logger.info('C: ', c.get('C')); } catch (e) { logger.info('C: <error> ', undefined); }
logger.info('C s: ', c.sget('C'));
*/

expect(process.env.A == 'A').to.be.true;
expect(process.env.B == 'B').to.be.true;
expect(process.env.C == 'C').to.be.true;
expect(process.env.Y == '').to.be.true;
expect(Service.Config.get('A')).to.equal(process.env.A);
expect(Service.Config.get('B')).to.equal(process.env.B);
try {
  Service.Config.get('C');
  expect(1).to.equal(2); // should never reach here because get C throws error as it is undefined.
}
catch (e) {
  // strip terminal escape codes
  let m = e.message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  expect(m.endsWith('Undefined config \'C\': but it is in sconf. Try \'sget("C")\'')).to.be.true;
}
try {
  Service.Config.sget('A');
  expect(1).to.equal(2);
}
catch (e) {
  // strip terminal escape codes
  let m = e.message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  expect(m.endsWith('Undefined secure config \'A\': but it is in conf. Try \'get("A")\'')).to.be.true;
}
expect(Service.Config.sget('C')).to.equal(process.env.C);


setEnvs();
new Service.Config(logger, ['A', 'B'], ['C'], {blankenvvars : false, wovtools : false});
let cm = Service.Config.genK8SConfigMap();
logger.info('cm: ', cm);
expect(cm.includes('A=A')).to.be.true;
expect(cm.includes('B=B')).to.be.true;
expect(cm.includes('C=C')).to.be.false;
let se = Service.Config.genK8SSecrets();
logger.info('se: ', se);
expect(se.includes('A=A')).to.be.false;
expect(se.includes('B=B')).to.be.false;
expect(se.includes('C=C')).to.be.true;

