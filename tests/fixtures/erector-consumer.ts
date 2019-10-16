// import * as module from '/lib/erector';
// const { erector } = require('/lib/erector');
// const erector_module = require('/lib/erector');
import * as erector_module from '../../lib/erector';

// test that typescript exports worked out OK
describe('erector', () => {
  test('erector is a function', () => {
    erector_module.erector;
    erector_module.if;
    erector_module.erector.if;
    erector_module.asdfasdf;
  });
});
