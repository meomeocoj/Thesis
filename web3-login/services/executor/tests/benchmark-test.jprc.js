const autocannon = require("autocannon");
const eccrypto = require("@toruslabs/eccrypto");
const keccak256 = require("keccak256");
const { default: axios } = require("axios");
const fs = require("fs");
const { generateJsonRPCObject } = require("../src/utils");

async function CommitmentRequestTestBench(connections = 10) {
  const id_token = Math.random() * 1000;
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
  const result = await autocannon({
    title: "CommitmentRequest",
    url: ["http://localhost:3000"],
    connections, // default
    pipelining: 1, // default
    duration: 10, // default
    headers: {
      "content-type": " application/json",
    },
    requests: [
      {
        method: "POST",
        path: "/jrpc",
        body: JSON.stringify(generateJsonRPCObject("CommitmentRequest", commitmentRequestParams)),
      },
    ],
  });
  return result;
}
async function ShareResponseTestBench(connections) {
  const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
  const id_token = "id_token";
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

  const shareRequestParams = {
    idtoken: id_token,
    nodesignatures: nodeSignatures,
    verifier: "tkey-google",
    verifier_id: "tminh1103@gmail.com",
  };

  const result = await autocannon({
    title: "ShareRsponse",
    url: ["http://localhost:9001"],
    connections,
    pipelining: 1,
    duration: 10,
    headers: {
      "content-type": " application/json",
    },
    requests: [
      {
        method: "POST",
        path: "/jrpc",
        body: JSON.stringify(generateJsonRPCObject("ShareRequest", shareRequestParams)),
      },
    ],
  });
  return result;
}

async function AssignKeyCommitmentTestBench(connections) {
  const id_token = "id_token";

  const tokenCommitment = keccak256(id_token).toString("hex");

  const assignKeyCommitmentParams = {
    tokencommitment: tokenCommitment,
    verifier: "tkey-google",
    verifier_id: "tminh110300@gmail.com",
  };

  const result = await autocannon({
    title: "AssignKeyCommitment",
    url: ["http://localhost:3000"],
    connections,
    pipelining: 1,
    duration: 10,
    headers: {
      "content-type": " application/json",
    },
    requests: [
      {
        method: "POST",
        path: "/jrpc",
        body: JSON.stringify(generateJsonRPCObject("AssignKeyCommitmentRequest", assignKeyCommitmentParams)),
      },
    ],
  });
  return result;
}

async function AssignKeyTestBench(connections) {
  const id_token = "id_token";

  const tokenCommitment = keccak256(id_token).toString("hex");

  const assignKeyCommitmentParams = {
    tokencommitment: tokenCommitment,
    verifier: "tkey-google",
    verifier_id: "tminh110300@gmail.com",
  };

  const jsonObject = generateJsonRPCObject("AssignKeyCommitmentRequest", assignKeyCommitmentParams);

  const arr = Array.from({ length: 5 }, (_, idx) => idx + 1);
  let nodeSignatures = await Promise.all(arr.map((idx) => axios.post(`http://localhost:900${idx}/jrpc`, jsonObject)));
  nodeSignatures = nodeSignatures.map((resp) => {
    return resp.data.result || resp.data.error;
  });

  const assignKeyParams = {
    idtoken: id_token,
    nodesignatures: nodeSignatures,
    verifier: "tkey-google",
    verifier_id: "tminh110300@gmail.com",
  };

  const result = await autocannon({
    title: "AssignKey",
    url: ["http://localhost:3000"],
    connections,
    pipelining: 1,
    duration: 10,
    headers: {
      "content-type": " application/json",
    },
    requests: [
      {
        method: "POST",
        path: "/jrpc",
        body: JSON.stringify(generateJsonRPCObject("AssignKeyRequest", assignKeyParams)),
      },
    ],
  });

  return result;
}

// CommitmentRequestTestBench(8000)
//   .then((result) => {
//     console.log("CommitmentRequestTestBench");
//     console.log(autocannon.printResult(result));
//   })
//   .catch(() => {
//     process.exit(1);
//   });

// ShareResponseTestBench(8000)
//   .then((result) => {
//     console.log("ShareResponseTestBench");
//     console.log(autocannon.printResult(result));
//   })
//   .catch(() => {
//     process.exit(1);
//   });

AssignKeyCommitmentTestBench(8000)
  .then((result) => {
    console.log("AssignKeyCommitmentTestBench");
    console.log(autocannon.printResult(result));
  })
  .catch(() => {
    process.exit(1);
  });

// AssignKeyTestBench(8000)
//   .then((result) => {
//     console.log("AssignKeyTestBench");
//     console.log(autocannon.printResult(result));
//   })
//   .catch(() => {
//     process.exit(1);
//   });
