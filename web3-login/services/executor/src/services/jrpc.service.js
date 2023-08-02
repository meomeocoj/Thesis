const axios = require("axios");
const EC = require("elliptic").ec;
const secp256k1 = require("secp256k1");

const ec = new EC("secp256k1");
const { createHandler } = require("./handlers");

const verifyIdToken = async (typeOfLogin, idToken, verifierId, clientId, authorizeOptions) => {
  const { authorizeUrl, iss } = authorizeOptions || {};
  let baseUrl;
  let httpOptions;
  const confirmIdentityUrl = authorizeUrl ? new URL(authorizeUrl) : "";

  if (confirmIdentityUrl) {
    baseUrl = `${confirmIdentityUrl.protocol}//${confirmIdentityUrl.host}`;
    httpOptions = {
      method: "get",
      url: confirmIdentityUrl.pathname,
      params: {
        id_token: idToken,
      },
    };
  }

  const handler = createHandler(typeOfLogin, idToken, { baseUrl, iss });

  try {
    const response = await handler.validate({ clientId, verifierId }, httpOptions);
    return response;
  } catch (err) {
    return {
      valid: false,
      error: `Catch error: ${err.message}`,
    };
  }
};

const validateNode = (members, params) => {
  try {
    const { signature, data, nodepubx, nodepuby } = params;
    members = members.map((member) => {
      const pubKey = ec.keyFromPublic(Buffer.from(member.pub_key, "base64")).getPublic();
      return {
        pubKeyX: pubKey.getX().toString("hex"),
        pubKeyY: pubKey.getY().toString("hex"),
      };
    });
    const found = members.find((el) => el.pubKeyX === nodepubx && el.pubKeyY === nodepuby);
    if (!found) return { error: "Node not found" };
    const publicKey = ec.keyFromPublic({ x: nodepubx, y: nodepuby });
    const valid = secp256k1.ecdsaVerify(
      Buffer.from(signature, "hex"),
      data,
      Buffer.from(publicKey.getPublic().encode("hex"), "hex")
    );
    if (!valid) return { error: "Invalid signature" };
    return { result: found };
  } catch (error) {
    return { error: "validate node failed" };
  }
};

module.exports = { verifyIdToken, validateNode };
