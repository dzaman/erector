const child_process = require('child_process');

describe('erector-typescript', () => {
  const argv = process.env.npm_config_argv ? JSON.parse(process.env.npm_config_argv) : { remain: [] };
  const test_fn = argv.remain.includes('--ci') ? test : test.skip;

  test_fn('typescript compilation of consumer', () => {
    const result = child_process.spawnSync('node_modules/.bin/tsc', [
      './tests/fixtures/erector-consumer.ts',
      '--noEmit',
      '--esModuleInterop',
    ]);
    expect(result.stdout.toString()).toMatchSnapshot();
  });
});
