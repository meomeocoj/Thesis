const jwt = require('jsonwebtoken');

const JWTHandler = require('./JWTHandler');

const privateKey = 'cffc6c7bb1cdc303f47e19ce4230946f18be2ef0d2614baa2af5c9db4a3f7859b194127d6de552030cce3dc8e15ac495';

const data = {
  iss: 'http://localhost:3000/',
  email: 'tminh1103@gmail.com',
  aud: 'http://localhost:3000/',
  exp: Math.floor(Date.now() / 1000) + 60 * 60,
};

describe('jwt handler test', () => {
  it('should validate the information', async () => {
    const idToken = jwt.sign(data, privateKey);
    const jwtHandler = new JWTHandler({ iss: data.iss, baseUrl: 'http://localhost:3000/', idToken });
    const response = await jwtHandler.validate({ clientId: data.iss, verifierId: data.email });
    console.log(response?.error);
    expect(response.valid).toBeTruthy();
  });
  it('should validate fail the information', async () => {
    const privateKey = 'Yx8SI8nC31cQmLXA6WqcX9pdBJie0wiM1WqI5qV7D+NeGUkFvGcPgriM94vnc3Vb';
    const idToken = jwt.sign(data, privateKey);
    const jwtHandler = new JWTHandler({ iss: data.iss, baseUrl: 'http://localhost:3000/', idToken });
    const response = await jwtHandler.validate({ clientId: data.iss, verifierId: data.email, cacheTTL: 60 });
    expect(response.valid).toBeFalsy();
  });
});
