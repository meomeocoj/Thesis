const NodeCache = require("node-cache");
const secp256k1 = require("secp256k1");
const keccak256 = require("keccak256");
const Cosmos = require("@oraichain/cosmosjs").default;
const EC = require("elliptic").ec;
const eccrypto = require("@toruslabs/eccrypto");

const Cosmjs = require("../cosmjs");
const config = require("../config/config");
const { getSkShare, delay } = require("../utils");
const validate = require("../middlewares/jrpcValidate");
const {
  commitmentRequestValidation,
  shareRequestValidation,
  assignKeyCommitmentRequest,
  assignKeyRequest,
} = require("../validations/jrpc.validation");
const { invalidParams, internalError } = require("../utils/jrpcError");
const { verifyIdToken, validateNode } = require("../services/jrpc.service");
const appState = require("../state");
const { get_public_key } = require("../../pkg/blsdkg_js");

const ec = new EC("secp256k1");
const cosmos = new Cosmos(config.lcd, config.chainId);
const hdPaths = `m/44'/118'/0'/0/${process.env.ADDRESS_INDEX || 0}`;
cosmos.setBech32MainPrefix("orai");
cosmos.setPath(hdPaths);
const cosmJs = new Cosmjs(config.chainId, config.rpc, config.lcd, config.mnemonic, hdPaths);
const childKey = cosmos.getChildKey(config.mnemonic);

const cache = new NodeCache({ stdTTL: config.cacheTTL });
const privKey = childKey.privateKey.toString("hex");

const key = ec.keyFromPrivate(privKey);
const pubKey = key.getPublic();
const pubKeyX = pubKey.getX().toString("hex");
const pubKeyY = pubKey.getY().toString("hex");
const domainSeparator = keccak256(
  Buffer.from(config.domainSeparator.chainId + config.domainSeparator.contract)
).toString("base64");

const AssignKeyCommitmentRequest = async (params, callback) => {
  try {
    const { error } = validate(assignKeyCommitmentRequest, params);
    if (error) {
      return callback(invalidParams(error));
    }
    const { tokencommitment: tokenCommitment, verifier_id: verifierId, verifier } = params;

    const verifierIdFound = await cosmJs.query(config.contract, {
      verifier_id_info: {
        verifier,
        verifier_id: verifierId,
      },
    });

    if (verifierIdFound) {
      return callback(internalError("Existed email"));
    }

    const data = `${tokenCommitment}|${verifierId}|${verifier}|${domainSeparator}`;
    const hash = keccak256(data);

    const hash1 = keccak256(Buffer.from(domainSeparator + verifier));
    const hash2 = keccak256(Buffer.from(Buffer.from(hash1).toString("base64") + verifierId));

    const { signature } = secp256k1.ecdsaSign(hash, childKey.privateKey);
    const verifierIdSignature = secp256k1.ecdsaSign(hash2, childKey.privateKey).signature;

    callback(null, {
      data,
      nodepubx: pubKeyX,
      nodepuby: pubKeyY,
      signature: Buffer.from(signature).toString("hex"),
      verifierIdSignature: Buffer.from(verifierIdSignature).toString("hex"),
    });
  } catch (error) {
    console.log("AssignKeyCommitmentRequest ~ error:", error);
    callback(internalError(error));
  }
};

const AssignKeyRequest = async (params, callback) => {
  try {
    const { error } = validate(assignKeyRequest, params);
    if (error) {
      return callback(invalidParams(error));
    }
    const {
      typeOfLogin,
      idtoken: idToken,
      nodesignatures: nodeSignatures,
      verifier_id: verifierId,
      verifier,
      authorizeOptions,
    } = params;

    let clientID;
    try {
      clientID = await cosmJs.query(config.contract, {
        client_id: {
          verifier,
        },
      });
    } catch (error) {
      return callback(internalError(`Get clientID fail: ${error.message}`));
    }

    if (!clientID) {
      return callback(internalError("Verifier not found"));
    }

    const { valid, error: verifyError } = await verifyIdToken(
      typeOfLogin,
      idToken,
      verifierId,
      clientID,
      authorizeOptions
    );

    if (!valid) {
      return callback(internalError(verifyError));
    }

    // message signature hash
    const hash1 = keccak256(Buffer.from(domainSeparator + verifier));
    const hash2 = keccak256(Buffer.from(Buffer.from(hash1).toString("base64") + verifierId));

    const validSignatures = [];
    nodeSignatures.forEach((signature) => {
      const { error: validateError, result } = validateNode(appState.members, {
        ...signature,
        data: keccak256(signature.data),
        signature: signature.signature,
      });
      const { error: validateVerifierError } = validateNode(appState.members, {
        ...signature,
        data: hash2,
        signature: signature.verifierIdSignature,
      });
      if (validateError) {
        console.log(`Could not validate signatures ${validateError}`);
      } else if (validateVerifierError) {
        console.log(`Could not validate verifier signatures ${validateVerifierError}`);
      } else if (signature.data.split("|")[1] !== verifierId) {
        console.log(`verifierId not same with data`);
      } else if (signature.data.split("|")[2] !== verifier) {
        console.log(`verifier not same with data`);
      } else {
        validSignatures.push({
          signature,
          index: result.index,
        });
      }
    });
    if (validSignatures.length < appState.threshold) {
      return callback(
        internalError(`Not enough valid signatures. Only ${validSignatures.length} valid signatures found.`)
      );
    }

    const commonDataMap = {};
    validSignatures.forEach((signature) => {
      if (!commonDataMap[signature.signature.data]) commonDataMap[signature.signature.data] = 1;
      else commonDataMap[signature.signature.data] += 1;
    });

    let commonDataString;
    Object.keys(commonDataMap).forEach((dataString) => {
      if (!commonDataString) commonDataString = dataString;
      else if (commonDataMap[dataString] > commonDataMap[commonDataString]) {
        commonDataString = dataString;
      }
    });

    if (commonDataMap[commonDataString] < appState.threshold) {
      return callback(
        internalError(
          `Not enough valid signatures on the same data, ${commonDataMap[commonDataString]} valid signatures`
        )
      );
    }

    const commonData = commonDataString.split("|");
    const [commitment] = commonData;
    if (commitment !== keccak256(idToken).toString("hex")) {
      return callback(internalError("Token commitment and token are not compatible"));
    }

    const pubKeys = validSignatures.map((signature) => {
      const key = ec.keyFromPublic({ x: signature.signature.nodepubx, y: signature.signature.nodepuby });
      return Buffer.from(key.getPublic().encodeCompressed()).toString("base64");
    });

    const tx = await cosmJs.execute(
      config.contract,
      {
        assign_key: {
          verifier_id: verifierId,
          verifier,
          pub_keys: pubKeys,
          sigs: validSignatures.map((signature) =>
            Buffer.from(signature.signature.verifierIdSignature, "hex").toString("base64")
          ),
        },
      },
      undefined,
      config.gasMultiplier,
      config.gasPrice
    );

    callback(null, {
      status: "success",
      tx: tx.transactionHash,
    });
  } catch (error) {
    console.log("AssignKeyRequest ~ error:", error);
    if (error.message.includes("account sequence mismatch")) {
      return callback(internalError("account sequence mismatch"));
    }
    callback(internalError(error.message));
  }
};

const CommitmentRequest = (params, callback) => {
  try {
    const { error } = validate(commitmentRequestValidation, params);
    if (error) {
      return callback(invalidParams(error));
    }
    const { temppubx: tempPubX, temppuby: tempPubY, tokencommitment: tokenCommitment } = params;

    const found = cache.get(tokenCommitment);
    if (found) {
      console.log("found");
      return callback(internalError("Duplicate token found")); // front-runner attack
    }
    cache.set(tokenCommitment, true);

    const data = `${tempPubX}|${tempPubY}|${tokenCommitment}|${domainSeparator}`;
    const hash = keccak256(data);
    const { signature } = secp256k1.ecdsaSign(hash, childKey.privateKey);
    callback(null, {
      data,
      nodepubx: pubKeyX,
      nodepuby: pubKeyY,
      signature: Buffer.from(signature).toString("hex"),
    });
  } catch (error) {
    console.log("CommitmentRequest ~ error:", error);
    callback(internalError(error));
  }
};

const ShareRequest = async (params, callback) => {
  try {
    const { error } = validate(shareRequestValidation, params);
    if (error) {
      return callback(invalidParams(error));
    }
    const {
      typeOfLogin,
      idtoken: idToken,
      nodesignatures: nodeSignatures,
      verifier_id: verifierId,
      verifier,
      authorizeOptions,
    } = params;

    let clientID;
    let key;
    try {
      [clientID, key] = await Promise.all([
        cosmJs.query(config.contract, {
          client_id: {
            verifier,
          },
        }),
        cosmJs.query(config.contract, {
          verifier_id_info: {
            verifier_id: verifierId,
            verifier,
          },
        }),
      ]);
    } catch (error) {
      return callback(internalError(error));
    }

    if (!clientID) {
      return callback(internalError("Verifier not found"));
    }

    if (!key) {
      return callback(internalError("Verifier ID isn't exist"));
    }

    // const { valid, error: verifyError } = await verifyIdToken(
    //   typeOfLogin,
    //   idToken,
    //   verifierId,
    //   clientID,
    //   authorizeOptions
    // );
    // if (!valid) {
    //   return callback(internalError(verifyError));
    // }
    const validSignatures = [];
    nodeSignatures.forEach((signature) => {
      const { error: validateError, result } = validateNode(appState.members, {
        ...signature,
        data: keccak256(signature.data),
      });
      if (validateError) {
        console.log(`Could not validate signatures ${validateError}`);
      } else {
        validSignatures.push({
          signature,
          index: result.index,
        });
      }
    });
    if (validSignatures.length < appState.threshold) {
      return callback(
        internalError(`Not enough valid signatures. Only ${validSignatures.length} valid signatures found.`)
      );
    }

    const commonDataMap = {};
    validSignatures.forEach((signature) => {
      if (!commonDataMap[signature.signature.data]) commonDataMap[signature.signature.data] = 1;
      else commonDataMap[signature.signature.data] += 1;
    });

    let commonDataString;
    Object.keys(commonDataMap).forEach((dataString) => {
      if (!commonDataString) commonDataString = dataString;
      else if (commonDataMap[dataString] > commonDataMap[commonDataString]) {
        commonDataString = dataString;
      }
    });

    if (commonDataMap[commonDataString] < appState.threshold) {
      return callback(
        internalError(
          `Not enough valid signatures on the same data, ${commonDataMap[commonDataString]} valid signatures`
        )
      );
    }

    const commonData = commonDataString.split("|");
    const [tmpPubX, tmpPubY, commitment] = commonData;
    if (commitment !== keccak256(idToken).toString("hex")) {
      return callback(internalError("Token commitment and token are not compatible"));
    }

    const memberShares = key.members_shares.filter((share) => share.rows);
    let skShare = await getSkShare(appState.members, memberShares, childKey.privateKey, appState.currentMember);
    const retrievedPkShare = Buffer.from(skShare.get_pk()).toString("base64");
    const pkShare = key.members_shares.find((share) => share.index === appState.currentMember.index).pk_share;
    if (retrievedPkShare !== pkShare) {
      return callback(internalError("pk_share isn't same with contract"));
    }
    skShare = Buffer.from(skShare.to_bytes());
    const tmpPubKey = ec.keyFromPublic({ x: tmpPubX, y: tmpPubY }).getPublic().encode("hex");
    const encrypted = await eccrypto.encrypt(Buffer.from(tmpPubKey, "hex"), skShare);
    const metadata = {
      ephemPublicKey: encrypted.ephemPublicKey.toString("hex"),
      iv: encrypted.iv.toString("hex"),
      mac: encrypted.mac.toString("hex"),
    };

    const commit0s = key.members_shares
      .filter((share) => share.commitments)
      .map((share) => Buffer.from(share.commitments[0], "base64"));
    const publicKey = get_public_key(commit0s);
    callback(null, {
      Metadata: metadata,
      Share: encrypted.ciphertext.toString("base64"),
      PublicKey: Buffer.from(publicKey).toString("hex"),
    });
  } catch (error) {
    console.log("shareRequest ~ error:", error);
    callback(internalError(error.message));
  }
};

module.exports = { AssignKeyCommitmentRequest, AssignKeyRequest, CommitmentRequest, ShareRequest };
