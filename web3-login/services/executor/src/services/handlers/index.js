const JWTHandler = require("./JWTHandler");
const GoogleHandler = require("./GoogleHandler");

function createHandler(typeOfLogin, idToken, { baseUrl, iss }) {
  switch (typeOfLogin) {
    case TypeOfLogin.JWT:
      return new JWTHandler({ iss, idToken, baseUrl });
    case TypeOfLogin.GOOGLE:
      return new GoogleHandler({ idToken });
  }
}

const TypeOfLogin = {
  GOOGLE: "google",
  JWT: "jwt",
};

module.exports = {
  TypeOfLogin,
  createHandler,
};
