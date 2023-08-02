const axios = require("axios");
const eccrypto = require("@toruslabs/eccrypto");
const Cosmos = require("@oraichain/cosmosjs").default;
const keccak256 = require("keccak256");
const Cosmjs = require("../src/cosmjs");
const config = require("../src/config/config");
const { generateJsonRPCObject } = require("../src/utils");

/*
 * Before test should setup smartcontract:
 * - Update Verifier
 * - Generate key
 * */
describe("jrpc test", () => {
  let credentials;
  let childKey;
  let address;
  let members;
  let total;
  let dealer;
  let threshold;
  let currentRound;
  let cosmJs;
  let currentMember;
  let contractConfig;
  // declare your verifier and verifier_id
  const verifier = "minh";
  const verifier_id = "tminh1103@gmail.com";

  beforeAll(async () => {
    const hdPaths = `m/44'/118'/0'/0/${process.env.ADDRESS_INDEX || 0}`;
    const cosmos = new Cosmos(config.lcd, config.chainId);
    cosmos.setBech32MainPrefix("orai");
    cosmos.setPath(hdPaths);
    childKey = cosmos.getChildKey(config.mnemonic);
    address = cosmos.getAddress(childKey);
    cosmJs = new Cosmjs(config.chainId, config.rpc, config.lcd, config.mnemonic, hdPaths);

    [contractConfig, currentRound, { data: credentials }] = await Promise.all([
      cosmJs.query(config.contract, {
        config: {},
      }),
      cosmJs.query(config.contract, {
        round_working_info: {},
      }),
      // Get tokens google credentials
      axios.get("http://localhost:3000/tokens"),
    ]);
    members = contractConfig.members;
    total = contractConfig.total;
    dealer = contractConfig.dealer;
    threshold = dealer - 1;
    members = members.map((member, index) => ({ ...member, index }));
    currentMember = members.find((member) => member.address === address);
  });

  test.skip("AssignCommitmentShare", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    const { id_token } = credentials;

    const tokenCommitment = keccak256(id_token).toString("hex");

    const assignKeyCommitmentParams = {
      tokencommitment: tokenCommitment,
      verifier,
      verifier_id,
    };

    const jsonObject = generateJsonRPCObject("AssignKeyCommitmentRequest", assignKeyCommitmentParams);

    let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });

    expect(nodeSignatures.length).toBe(5);
  });

  test.skip("AssignKey", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    const { id_token } = credentials;

    const tokenCommitment = keccak256(id_token).toString("hex");

    const assignKeyCommitmentParams = {
      tokencommitment: tokenCommitment,
      verifier,
      verifier_id,
    };

    let jsonObject = generateJsonRPCObject("AssignKeyCommitmentRequest", assignKeyCommitmentParams);

    let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });

    console.log(nodeSignatures);
    expect(nodeSignatures.length).toBe(5);

    const assignKeyParams = {
      idtoken: id_token,
      nodesignatures: nodeSignatures,
      verifier,
      verifier_id,
    };

    jsonObject = generateJsonRPCObject("AssignKeyRequest", assignKeyParams);

    const response = await axios.post("http://localhost:9001/jrpc", jsonObject);
    console.log(response);
  });

  test.skip("CommitmentRequest", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    const { id_token } = credentials;

    const tmpKey = eccrypto.generatePrivate();
    const pubKey = eccrypto.getPublic(tmpKey).toString("hex");
    const pubKeyX = pubKey.slice(2, 66);
    const pubKeyY = pubKey.slice(66);
    const tokenCommitment = keccak256(id_token).toString("hex");

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

    expect(nodeSignatures.length).toBe(5);
  });

  test.skip("ShareResponse", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
    const { id_token } = credentials;

    const tmpKey = eccrypto.generatePrivate();
    const pubKey = eccrypto.getPublic(tmpKey).toString("hex");
    const pubKeyX = pubKey.slice(2, 66);
    const pubKeyY = pubKey.slice(66);
    const tokenCommitment = keccak256(id_token).toString("hex");

    const commitmentRequestParams = {
      temppubx: pubKeyX,
      temppuby: pubKeyY,
      tokencommitment: tokenCommitment,
    };

    let jsonObject = generateJsonRPCObject("CommitmentRequest", commitmentRequestParams);

    let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });
    expect(nodeSignatures.length).toBe(5);
    const shareRequestParams = {
      idtoken: id_token,
      nodesignatures: nodeSignatures,
      verifier,
      verifier_id,
    };

    jsonObject = generateJsonRPCObject("ShareRequest", shareRequestParams);

    let shares = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
    shares = shares.map((resp) => {
      return resp.data.result || resp.data.error;
    });

    console.log(shares);

    expect(shares.length).toBe(5);
  });
});
