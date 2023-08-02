const JWTHandler = require('./JWTHandler');
class GoogleHandler {
  static Issuer = 'https://accounts.google.com';
  jwtHandler;
  baseUrl;
  idToken;

  constructor({ baseUrl, idToken }) {
    this.baseUrl = baseUrl || 'https://www.googleapis.com/';
    this.idToken = idToken;
    this.jwtHandler = new JWTHandler({ iss: GoogleHandler.Issuer, baseUrl: this.baseUrl, idToken: this.idToken });
  }

  async validate({ clientId, verifierId }) {
    return this.jwtHandler.validate(
      { clientId, verifierId },
      {
        method: 'get',
        url: 'oauth2/v3/tokeninfo',
        params: {
          id_token: this.idToken,
        },
      }
    );
  }
}
module.exports = GoogleHandler;
