const axios = require('axios');
const GoogleHandler = require('./GoogleHandler');

const data = {
  iss: 'https://accounts.google.com',
  azp: '395623626332-7slje72gkemor29kt3nms99jiotostr5.apps.googleusercontent.com',
  aud: '395623626332-7slje72gkemor29kt3nms99jiotostr5.apps.googleusercontent.com',
  sub: '109962217572698330136',
  email: 'tminh1103@gmail.com',
};

describe('jwt handler test', () => {
  it('should validate the information', async () => {
    const resp = await axios.get('http://localhost:3000/google/tokens');
    const { id_token: idToken } = resp.data;
    const googleHandler = new GoogleHandler({ idToken });
    const response = await googleHandler.validate({ clientId: data.aud, verifierId: data.email });
    expect(response.valid).toBeTruthy();
  });

  it('should validate fail the information', async () => {
    const resp = await axios.get('http://localhost:3000/google/tokens');
    const { id_token: idToken } = resp.data;
    const googleHandler = new GoogleHandler({ idToken });
    const response = await googleHandler.validate({ clientId: 'http://localhost:3000', verifierId: data.email });
    expect(response.valid).toBeFalsy();
  });
});
