const axios = require("axios");

class JWTHandler {
  iss;

  baseUrl;

  idToken;

  http;

  constructor({ iss, idToken, baseUrl }) {
    Object.assign(this, { iss, idToken, baseUrl });
    // Get all the property names of the class prototype
    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
    this.http = axios.create({
      baseURL: this.baseUrl,
    });

    // Bind all the methods to `this`
    for (const propertyName of propertyNames) {
      const propertyValue = this[propertyName];

      // Check if the property is a function and not a constructor
      if (typeof propertyValue === "function" && propertyName !== "constructor") {
        this[propertyName] = propertyValue.bind(this);
      }
    }
  }

  async validate({ clientId, verifierId }, requestOption) {
    const httpOptions = requestOption || {
      method: "get",
      url: "/tokeninfo",
      params: {
        id_token: this.idToken,
      },
    };
    try {
      const resp = await this.http(httpOptions);
      const { email, aud, iss, exp } = resp.data;
      if (Math.floor(Date.now() / 1000) > parseInt(exp)) {
        return { valid: false, error: `Token is expired` };
      }

      if (aud !== clientId || email !== verifierId || !this.iss.includes(iss)) {
        return {
          valid: false,
          error: "Validate fail",
        };
      }
      return {
        valid: true,
      };
    } catch (error) {
      console.log(error)
      return {
        valid: false,
        error: error?.response?.data?.message,
      };
    }
  }
}

module.exports = JWTHandler;
