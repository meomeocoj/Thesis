const config = require('../config/config');
const Cosmos = require('@oraichain/cosmosjs').default;
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

dotenv.config();

async function generateSigsSample(verifier, email) {
  const hash = keccak256(Buffer.from('FrklqHTkZwANJgt2JLFCP/aznLccYl1EgQdJy66EBoU=' + verifier + email));

  console.log(hash.toString('base64'));

  const masterNode = ethers.utils.HDNode.fromMnemonic(config.mnemonic);

  const publicKeys = [];
  const sigs = Array.from({ length: 5 }, (_, idx) => idx + 1).map((id) => {
    const childNode = masterNode.derivePath(`m/44'/118'/0'/0/${id}`);
    publicKeys.push(ethers.utils.computePublicKey(childNode.privateKey));
    const privateKeyUint8Array = Uint8Array.from(Buffer.from(childNode.privateKey.replace('0x', ''), 'hex'));
    const u8 = secp256k1.ecdsaSign(hash, privateKeyUint8Array).signature;
    return Buffer.from(u8).toString('base64');
  });

  console.log(sigs);

  console.log(publicKeys.map((pk) => Buffer.from(pk.replace('0x', '')).toString('base64')));
}

generateSigsSample('tkey-google', 'tminh1103@gmail.com');
