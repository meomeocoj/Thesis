const axios = require("axios");
const eccrypto = require("@toruslabs/eccrypto");
const keccak256 = require("keccak256");
const { generateJsonRPCObject } = require("../src/utils");

describe("test jwt validate", () => {
  let idToken;
  const data = {
    iss: "http://localhost:3000/",
    email: "tminh0204@gmail.com",
    aud: "http://localhost:3000/",
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  beforeAll(async () => {
    const res = await axios.get("http://localhost:3000/idtoken");
    idToken = res.data.idToken;
  });

  it.skip("should assign key successfully", async () => {
    const tokenCommitment = keccak256(idToken).toString("hex");
    const assignKeyCommitmentParams = {
      tokencommitment: tokenCommitment,
      verifier: "local-jwt",
      verifier_id: data.email,
    };

    const jsonObject = generateJsonRPCObject("AssignKeyCommitmentRequest", assignKeyCommitmentParams);

    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });
    console.log(nodeSignatures);

    const assignKeyParams = {
      typeOfLogin: "jwt",
      idtoken: idToken,
      nodesignatures: nodeSignatures,
      verifier: "local-jwt",
      verifier_id: data.email,
      authorizeOptions: {
        iss: data.iss,
        authorizeUrl: `${data.iss}tokeninfo`,
      },
    };
    const response = await axios.post(
      "http://localhost:9001/jrpc",
      generateJsonRPCObject("AssignKeyRequest", assignKeyParams)
    );
    console.log(response.data);
  });

  it("ShareRequest should return success", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    const tmpKey = eccrypto.generatePrivate();
    const pubKey = eccrypto.getPublic(tmpKey).toString("hex");
    const pubKeyX = pubKey.slice(2, 66);
    const pubKeyY = pubKey.slice(66);
    const tokenCommitment = keccak256(idToken).toString("hex");
    const commitmentRequestParams = {
      temppubx: pubKeyX,
      temppuby: pubKeyY,
      tokencommitment: tokenCommitment,
    };

    const jsonObject = generateJsonRPCObject("CommitmentRequest", commitmentRequestParams);

    let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });

    const shareRequestParams = {
      typeOfLogin: "jwt",
      idtoken: idToken,
      nodesignatures: nodeSignatures,
      verifier: "local-jwt",
      verifier_id: data.email,
      authorizeOptions: {
        iss: data.iss,
        authorizeUrl: `${data.iss}tokeninfo`,
      },
    };

    const response = await axios.post(
      "http://localhost:9001/jrpc",
      generateJsonRPCObject("ShareRequest", shareRequestParams)
    );
    console.log(response.data);
  });
});
