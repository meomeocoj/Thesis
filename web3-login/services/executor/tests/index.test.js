const Cosmos = require("@oraichain/cosmosjs").default;
const assert = require("assert");
const axios = require("axios");
const secp256k1 = require("secp256k1");
const keccak256 = require("keccak256");
const eccrypto = require("@toruslabs/eccrypto");
const EC = require("elliptic").ec;
const { sha256 } = require("js-sha256");
const Cosmjs = require("../src/cosmjs");
const blsdkgJs = require("../pkg/blsdkg_js");

const { encrypt, decrypt, generateJsonRPCObject, getSkShare } = require("../src/utils");
const config = require("../src/config/config");
const { get_public_key, get_pk } = require("../pkg/blsdkg_js");
const { validateNode } = require("../src/services/jrpc.service");

const ec = new EC("secp256k1");

// node src/spawn.js to start nodes
describe("Full flow", () => {
  let childKey;
  let address;
  let members;
  let total;
  let dealer;
  let threshold;
  let currentRound;
  let cosmJs;
  let currentMember;

  beforeAll(async () => {
    const hdPaths = `m/44'/118'/0'/0/${process.env.ADDRESS_INDEX || 0}`;
    const cosmos = new Cosmos(config.lcd, config.chainId);
    cosmos.setBech32MainPrefix("orai");
    cosmos.setPath(hdPaths);
    childKey = cosmos.getChildKey(config.mnemonic);
    address = cosmos.getAddress(childKey);
    cosmJs = new Cosmjs(config.chainId, config.rpc, config.lcd, config.mnemonic, hdPaths);
    const contractConfig = await cosmJs.query(config.contract, {
      config: {},
    });
    currentRound = await cosmJs.query(config.contract, {
      round_working_info: {},
    });
    members = contractConfig.members;
    total = contractConfig.total;
    dealer = contractConfig.dealer;
    threshold = dealer - 1;
    members = members.map((member, index) => ({ ...member, index }));
    currentMember = members.find((member) => member.address === address);
  });

  // test('share dealers', async () => {
  //   const bivars = blsdkgJs.generate_bivars(threshold, total);

  //   const commits = bivars.get_commits().map(Buffer.from);
  //   const rows = bivars.get_rows().map(Buffer.from);

  //   assert.equal(members.length, total, 'Member length is not full, should not deal shares for others');

  //   assert(currentMember, 'Not is a member');
  //   assert.equal(
  //     currentMember.pub_key,
  //     childKey.publicKey.toString('base64'),
  //     'Pubkey is not equal to the member stored on the contract. Cannot be a dealer'
  //   );
  //   commits[0] = commits[0].toString('base64');
  //   for (let i = 0; i < rows.length; ++i) {
  //     console.log(members[i]);
  //     rows[i] = encrypt(Buffer.from(members[i].pub_key, 'base64'), childKey.privateKey, commits[i + 1], rows[i]).toString(
  //       'base64'
  //     );
  //     commits[i + 1] = commits[i + 1].toString('base64');
  //   }

  //   const response = await cosmJs.execute(
  //     config.contract,
  //     {
  //       share_dealer: {
  //         round: '5',
  //         share: {
  //           rows,
  //           commitments: commits,
  //         },
  //       },
  //     },
  //     undefined,
  //     config.gas_multiplier,
  //     config.gas_price
  //   );
  //   console.log(response);
  // }, 60000);

  // test('share rows', async () => {
  //   assert.equal(currentRound.round_status, 2, 'invalid status');
  //   assert(currentRound.members_shares, 'undefind members shares');
  //   const roundInfo = await cosmJs.query(config.contract, {
  //     round_info: {
  //       round: '5',
  //     },
  //   });
  //   console.log(roundInfo);
  //   const memberShares = currentRound.members_shares.filter((share) => share.commitments);
  //   const skShare = await getSkShare(members, memberShares, childKey.privateKey, currentMember);
  //   const pkShare = Buffer.from(skShare.get_pk()).toString('base64');
  //   const response = await cosmJs.execute(
  //     config.contract,
  //     {
  //       share_rows: {
  //         round: '5',
  //         share: {
  //           pk_share: pkShare,
  //         },
  //       },
  //     },
  //     undefined,
  //     config.gas_multiplier,
  //     config.gas_price
  //   );
  //   console.log(response);
  // }, 60000);

  // test('get assign key commitment', async () => {
  //   const idToken =
  //     'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFjZGEzNjBmYjM2Y2QxNWZmODNhZjgzZTE3M2Y0N2ZmYzM2ZDExMWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIzNDkxMzc1Mzg4MTEtOHQ3czc1ODRhcHA2YW01ajA5YTJrZ2xvOGRnMzllcW4uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIzNDkxMzc1Mzg4MTEtOHQ3czc1ODRhcHA2YW01ajA5YTJrZ2xvOGRnMzllcW4uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDA0MjA5OTE4ODc0NzE0MDM3OTgiLCJlbWFpbCI6ImR1b25neXQxOTk4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiMUR1WlREUmYxMjc0SDN3N0ZadUJmQSIsIm5vbmNlIjoicmxpZXdhd29zOWkiLCJuYW1lIjoiTmd1eeG7hW4gVMO5bmcgRMawxqFuZyIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BR05teXhiR0c1WGlybldvQVBBZExVYVUxOGtkaFgxMkRMVXFXY1BPT0plRD1zOTYtYyIsImdpdmVuX25hbWUiOiJOZ3V54buFbiBUw7luZyIsImZhbWlseV9uYW1lIjoiRMawxqFuZyIsImxvY2FsZSI6ImVuIiwiaWF0IjoxNjgxMTAxMDAyLCJleHAiOjE2ODExMDQ2MDIsImp0aSI6IjY0N2NmMjE4OGEwNjliZDQ5YjJlNzdiMTVjNTYxYzM2ZTgzMDViNjQifQ.lIdfFHMEY4T0moR6USmkGhY1tgWru1BMsrcD_8HPgBA01DkSxbTD1XJxilq7hDjRrb3hoHgeJpozJxH_BekljoXkAVIbJDz5citljqtqJfMOQBGi0AKbivrkMz44XnuF_z3X9BFEgR0MK5b-YZ3vOlEJ-TjvqTF8SM5Sg0xVPeUGB53NBYN5rHk2TDJqiJlDK7_nxM-kOcEoyB2BKLGo1uLdF_JEHCj35ltyVaqmJMnh1Z5ct-yt_w1ALmZGWGQgHNxNLljdfCZ1l7TYwHuwOgnw-5fXFCdKxin5uEe1rZ2-qm93yPBbMz_DsK55UFxuIQr-p41GWwuNqlNs75xXOA';
  //   const email = 'duongyt1998@gmail.com';
  //   const pubKeyX = 'b40c0d3ac3c67b42a115e67cfc8e04400bfc738ceba07fc9cb830cf794ad26a9';
  //   const pubKeyY = 'e40d58371f9a1d7d96fc14a1e589b19a107e4d3642166ea26b33acdf324eb9a9';
  //   const tokenCommitment = keccak256(idToken).toString('hex');
  //   const info = await cosmJs.query(config.contract, {
  //     email: {
  //       email,
  //     },
  //   });
  //   if (info) {
  //     console.log('existed email');
  //     return;
  //   }
  //   const data = pubKeyX + '|' + pubKeyY + '|' + email + '|' + tokenCommitment;
  //   const hash = keccak256(data);
  //   const signature = secp256k1.ecdsaSign(hash, childKey.privateKey).signature;
  //   const emailSignature = secp256k1.ecdsaSign(keccak256(email), childKey.privateKey).signature;
  //   const privKey = childKey.privateKey.toString('hex');

  //   const key = ec.keyFromPrivate(privKey);
  //   const pubKey = key.getPublic();
  //   const nodepubx = pubKey.getX().toString('hex');
  //   const nodepuby = pubKey.getY().toString('hex');
  //   console.log('data ', data);
  //   console.log('nodepubx ', nodepubx);
  //   console.log('nodepuby ', nodepuby);
  //   console.log(Buffer.from(signature).toString('hex'));
  //   console.log(Buffer.from(emailSignature).toString('hex'));
  // }, 60000);

  // const sigs = [
  //   '4gV8ENVy0BfeV0ak/29Qu3QTjKhZJpqSvsy9CkBzbCkvARhe/2O3Z29bN+fIx7FhfzzhcIniw+k4wKM81cCOrA==',
  //   '9Rg2BBxh29PfsIOR1wsowe2KfHLTrCD8tV6EjFk3LPsBp2C8ukUQdmkHNF40jMXe9WZGN5P/N1cETWq3Ov8F5g==',
  //   'y/zD3zpCoXUWGbpDmyLsqMjE6p7xHp7Xh8vqpaitzQdJWjtn5zakQQfRJQYapsk1Bt9kFQtfHy5uUukmCDoO3Q==',
  // ];

  // test('get assign key sig', async () => {
  //   const email = 'email';
  //
  //   const hash = keccak256(email);
  //   console.log(hash);
  // const emailSignature = secp256k1.ecdsaSign(hash, childKey.privateKey).signature;
  //   console.log('🚀 ~ file: index.test.js:164 ~ test ~ emailSignature:', Buffer.from(emailSignature).toString('base64'));
  //   return;
  //   const response = await cosmJs.query(config.contract, {
  //     verify_member: {
  //       email,
  //       sigs,
  //     },
  //   });
  //
  //   const response = await cosmJs.execute(
  //     config.contract,
  //     {
  //       assign_key: {
  //         email,
  //         sigs,
  //       },
  //     },
  //     undefined,
  //     config.gas_multiplier,
  //     config.gas_price
  //   );
  //   console.log('response: ', response);
  // }, 60000);
  //
  // test('get skShare', async () => {
  //   const roundInfo = await cosmJs.query(config.contract, {
  //     round_info: {
  //       round: '2',
  //     },
  //   });
  //   assert(roundInfo.members_shares, 'undefind members shares');
  //   const membersShares = roundInfo.members_shares;
  //   const dealers = membersShares.filter((share) => share.commitments);
  //   const skShare = await getSkShare(members, dealers, childKey.privateKey, currentMember);
  //   const pkShare = Buffer.from(skShare.get_pk()).toString('base64');
  //   const publicKeyShare = membersShares.find((i) => i.index === currentMember.index && i.pk_share).pk_share;
  //   assert.equal(pkShare, publicKeyShare, 'pkShare not same with contract');
  // });

  // test('interpolate', async () => {
  //   const skShares = [
  //     'EbWngyOCeD6TQ1UbNyeb8gNC6zXHrG764wVFBFYalgE=',
  //     'C1XgXkufPYo1/4suxNsFg/0IZXew5tnRXEtFbnKoZNw=',
  //     'AmuTq5lvNhRxZcwaiQ7t5yVaqBRYnZqfFOysxo7MEE4=',
  //     // 'auRovjaP3yV4r+/mjWUtIM/3Vw6+zw1jDOl7C6qFmFg=',
  //     // 'XOUQ78/GPizlakaCvpoTJlVjKmDjfnofREGwP8XU/Pg=',
  //   ];

  //   const commit0s = [
  //     'lJ+K63U9zg2LVYwJwVEyzkNO80uUtATa2q1KuFqVPMhbwL03J/vQNT3Djpupro+DgzscplsU+xq2P8AjCY8Woic5Je6nyDPZk8SEqVBf9NxmByAnrGC3EP0wfu04fDA+h4kuR9xiQBAxixbxUJBSQGaCwn07Sr+CXbdpwIPR9knnTfE80RO6uXhokJPS4Swp',
  //     'l+IzcNq9I3IioM54ZLFu7QMgfFKkAqIwvQA1ZkJRM0V7VzUzhSr1IoFz766gpHcLrnY0JTEGv6kp4BRF5/lfHT6hGbrpDwPgM2Shvnx8ITqD1cV8BdFzxq6Trc/GdHwxib+dxNImWSgvM1903f9eg9zENepru2W1rpEnznpjChNFhNGc/JTNgyfBg96wRi/i',
  //     'lv+ToenE3F/CkQyLR3lyf7/s+qI57tXBPWtNVTQau+io1O4LhfhdJa2DsleH8gLylylhvw9fjLUwagGF7m36ywVDESyGNAK/2LtCS3/kfFmS6nEP/Bpg7pF3a18v3jMbmNtUFKoaMylR6QTz3LgBO2GTLl8jEMCmlPYx2D5Cj3PAuxlCKM4jkSq6FQIK19s3',
  //   ];

  //   const pubKey = Buffer.from(get_public_key(commit0s.map((i) => Buffer.from(i, 'base64'))));
  //   const indexes = ['01', '02', '03'].map((i) => Buffer.from(i, 'hex'));
  //   const shares = skShares.map((share) => Buffer.from(share, 'base64'));
  //   const privateKey = blsdkgJs.interpolate(indexes, shares);
  //   const pk = Buffer.from(get_pk(privateKey));
  //   assert.equal(pubKey.toString('hex'), pk.toString('hex'));
  // });

  // test('generate bivars', async () => {
  //   let childKeys = [];
  //   for (let i = 1; i < 6; i++) {
  //     const cosmos = new Cosmos(config.lcd, config.chainId);
  //     const hdPaths = `m/44'/118'/0'/0/${i}`;
  //     cosmos.setBech32MainPrefix('orai');
  //     cosmos.setPath(hdPaths);
  //     const childKey = cosmos.getChildKey(config.mnemonic);
  //     childKeys.push(childKey);
  //   }
  //   const total = 5;
  //   const threshold = 2;
  //   const dealer = 3;
  //   const share_dealers = [];
  //   const skShares = [];
  //   const commit0s = [];
  //   for (let i = 0; i < dealer; i++) {
  //     const bivars = blsdkgJs.generate_bivars(threshold, total);
  //     const commits = bivars.get_commits().map(Buffer.from);
  //     commit0s.push(commits[0]);
  //     const rows = bivars.get_rows().map(Buffer.from);
  //     for (let j = 0; j < rows.length; ++j) {
  //       rows[j] = encrypt(childKeys[j].publicKey, childKeys[i].privateKey, commits[j + 1], rows[j]).toString('base64');
  //       rows[j] = decrypt(childKeys[j].privateKey, childKeys[i].publicKey, commits[j + 1], Buffer.from(rows[j], 'base64'));
  //       commits[j + 1] = commits[j + 1].toString('base64');
  //       commits[j + 1] = Buffer.from(commits[j + 1], 'base64');
  //     }
  //     share_dealers.push({
  //       commits,
  //       rows,
  //     });
  //   }
  //   for (let i = 0; i < total; i++) {
  //     const commits = [];
  //     const rows = [];
  //     share_dealers.forEach((share_dealer) => {
  //       commits.push(share_dealer.commits[i + 1]);
  //       rows.push(share_dealer.rows[i]);
  //     });
  //     const skShare = blsdkgJs.get_sk_share(rows, commits);
  //     skShares.push(skShare);
  //   }
  //   const pubKey = Buffer.from(get_public_key(commit0s));
  //   const indexes = ['01', '02', '03'].map((i) => Buffer.from(i, 'hex'));
  //   const shares = skShares.slice(0, 3).map((share) => share.to_bytes());
  //   const privateKey = blsdkgJs.interpolate(indexes, shares);
  //   const pk = Buffer.from(get_pk(privateKey));
  //   assert.equal(pubKey.toString('hex'), pk.toString('hex'));
  // });

  test("should returns valid shares", async () => {
    const arr = Array.from({ length: 5 }, (_, idx) => idx);
    const idToken =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6ImM5YWZkYTM2ODJlYmYwOWViMzA1NWMxYzRiZDM5Yjc1MWZiZjgxOTUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIzNDkxMzc1Mzg4MTEtOHQ3czc1ODRhcHA2YW01ajA5YTJrZ2xvOGRnMzllcW4uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIzNDkxMzc1Mzg4MTEtOHQ3czc1ODRhcHA2YW01ajA5YTJrZ2xvOGRnMzllcW4uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDk5NjIyMTc1NzI2OTgzMzAxMzYiLCJlbWFpbCI6InRtaW5oMTEwM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXRfaGFzaCI6InZ0bXFnanp5djBxQ1A2ejBEdGV1Y0EiLCJub25jZSI6Imh3czRvZnk3amttIiwibmFtZSI6Ik1pbmggUGx1cyIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BR05teXhZS3ExY2JaUld4NmdoOThOV25zN1VQaUJGeTY3NjQzX21Ya29iMz1zOTYtYyIsImdpdmVuX25hbWUiOiJNaW5oIiwiZmFtaWx5X25hbWUiOiJQbHVzIiwibG9jYWxlIjoidmkiLCJpYXQiOjE2ODI2NjU3NTcsImV4cCI6MTY4MjY2OTM1NywianRpIjoiZWRlNWNjMDYxYzYzZGM0MjYzYTFlMGNjNGQxODZiZTY5OTU0Njc5YiJ9.RdcpzRz2XxyOmMAE1S5u6zy2QCacWHFU-M-Vvvv1RjY71EspkVBCT1_NfLhBqxcDgF46XoC9ZmCBD1TRFW4xhPheufx2itOQV5jyeV4LzrY8arLdyazANFAsg5La4GmrrZc9Nu7XIf0muQvKwDlhIiSkhnIgAqjYDiDPoY7Cxv6rOrsKeFsPHyKR7v9MrOAd6StI3Ar_16WMsGmJ3lWxMQdyXXpcJNS4-bdA-GYmzEed0j9Rstv-T3M2gPYYMlMxSFelUo7dBuaWuogcdTCpDuKUeqri3N2SLWl5PwnrJKqVsGKxZpRBD2w-oLYiiMs0qn-7kgTc-Yt_D84efgi4yw";

    const tmpKey = eccrypto.generatePrivate();
    const pubKey = eccrypto.getPublic(tmpKey).toString("hex");
    const pubKeyX = pubKey.slice(2, 66);
    const pubKeyY = pubKey.slice(66);
    const tokenCommitment = keccak256(idToken).toString("hex");

    const commitmentRequestParam = {
      tokencommitment: tokenCommitment,
      temppubx: pubKeyX,
      temppuby: pubKeyY,
    };

    let jsonObject = generateJsonRPCObject("CommitmentRequest", commitmentRequestParam);

    let nodeSignatures = await Promise.all(
      arr.map((idx) => axios.post(`http://localhost:900${idx + 1}/jrpc`, jsonObject))
    );
    nodeSignatures = nodeSignatures.map((resp) => {
      return resp.data.result || resp.data.error;
    });
    console.log("🚀 ~ file: index.test.js:39 ~ test ~ nodeSignatures:", nodeSignatures);

    const shareRequestParam = {
      idtoken: idToken,
      nodesignatures: nodeSignatures,
      verifier: "owallet",
      verifier_id: "tminh1103@gmail.com",
    };

    jsonObject = generateJsonRPCObject("ShareRequest", shareRequestParam);

    let shareRequestResults = await Promise.all(
      arr.map((idx) => axios.post(`http://localhost:900${idx + 1}/jrpc`, jsonObject))
    );
    shareRequestResults = shareRequestResults.map((resp) => {
      return resp.data.result || resp.data.error;
    });
    console.log("🚀 ~ file: index.test.js:53 ~ test ~ sharerequestresults:", sharerequestresults);
  });
});
