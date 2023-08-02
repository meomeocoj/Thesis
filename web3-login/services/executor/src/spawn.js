const { spawn } = require('child_process');

const nodeIndex = new Array(5).fill();

for (let i = 1; i <= nodeIndex.length; i++) {
  const ls = spawn('nodemon', ['src/index.js'], {
    env: Object.assign(process.env, { ADDRESS_INDEX: i, NODE_ENV: 'development', PORT: 9000 + i }),
    cwd: process.cwd(),
  });

  ls.stdout.on('data', (data) => {
    console.log(`node ${i} stdout: ${data}`);
  });
  ls.stderr.on('data', (data) => {
    console.error(`node ${i} stderr: ${data}`);
  });
}
