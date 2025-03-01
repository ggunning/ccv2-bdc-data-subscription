import axios from 'axios';
import cp from 'child_process';
import fs from 'fs';

new Promise((resolve, reject) => {
    const env = Object.create(process.env);
    env.NODE_OPTIONS = '--max-old-space-size=8192';
    const args = [
        './node_modules/.bin/jest',
        '--config',
        './jest.config.json'
    ];
    const cmd = fs.existsSync('/nodejs/bin/node') ? '/nodejs/bin/node' : 'node';
    const res = cp.spawn(cmd, args, { env });
    res.stdout.on('data', (data: any) => console.log(`${data}`));
    res.stderr.on('data', (data: any) => console.error(`${data}`));
    res.on('close', resolve).on('err', reject);
})
    .then(code => console.log('Child process exited successfully with code:', code))
    .catch((error: unknown) => console.error('Child process failed:', error))
    .finally(() => {
        axios.post('http://127.0.0.1:15000/quitquitquit')
            .then(() => console.log('Shutdown request to istio-proxy finished'))
            .catch((error: unknown) => console.error('Shutdown request to istio-proxy failed:', error));
    });
