const Cosmjs = require("./cosmjs");
const Cosmos = require("@oraichain/cosmosjs").default;
const blsdkgJs = require("../pkg/blsdkg_js");

const { encrypt, delay, getSkShare } = require("./utils");
const appState = require("./state");

const config = require("./config/config");
const logger = require("./config/logger");

const cosmos = new Cosmos(config.lcd, config.chainId);
const hdPaths = `m/44'/118'/0'/0/${process.env.ADDRESS_INDEX || 0}`;
cosmos.setBech32MainPrefix("orai");
cosmos.setPath(hdPaths);

const childKey = cosmos.getChildKey(config.mnemonic);

const cosmJs = new Cosmjs(config.chainId, config.rpc, config.lcd, config.mnemonic, hdPaths);

const address = cosmos.getAddress(childKey);
logger.info(`address: ${address}`);
logger.info(`public key: ${childKey.publicKey.toString("base64")}`);
logger.info(`private ${childKey.privateKey.toString("hex")}`);
logger.info(`contract address ${config.contract}`);

const run = async () => {
  const [configData, workingRoundInfo, _workingRoundIndex, availableKeys, currentBlock] = await Promise.all([
    cosmJs.query(config.contract, {
      config: {},
    }),
    cosmJs.query(config.contract, {
      round_working_info: {},
    }),
    cosmJs.query(config.contract, {
      working_round_index: {},
    }),
    cosmJs.query(config.contract, {
      total_wait_to_assign_rounds: {},
    }),
    getBlock(),
  ]);

  let { members, total, dealer } = configData;

  const threshold = dealer;
  members = members.map((member, index) => ({ ...member, index }));
  const currentMember = members.find((member) => member.address === address);

  appState.setState({
    threshold,
    total,
    dealer,
    members,
    currentMember,
  });

  // if enough unassigned keys
  if (availableKeys >= config.maxKeys) return;

  // TODO: Rewrite status more clear
  if (workingRoundInfo) {
    if (currentBlock > workingRoundInfo.deadline) {
      await resetRound();
      return;
    }
    const { round_status, members_shares } = workingRoundInfo;
    if (round_status === 1) {
      const shared = members_shares.find((share) => share.index === currentMember.index && share.commitments);
      if (!shared) {
        await shareDealers(threshold - 1, total, members, currentMember);
      }
    } else if (round_status === 2) {
      const shared = members_shares.find((share) => share.index === currentMember.index && share.pk_share);
      if (!shared) {
        await shareRows(members, members_shares, currentMember);
      }
    }
  } else {
    await shareDealers(threshold - 1, total, members, currentMember);
  }
};

const shareDealers = async (degree, total, members, currentMember) => {
  try {
    const bivars = blsdkgJs.generate_bivars(degree, total);

    const commits = bivars.get_commits().map(Buffer.from);
    const rows = bivars.get_rows().map(Buffer.from);

    if (members.length !== total) {
      return logger.info("Member length is not full, should not deal shares for others");
    }
    if (!currentMember) {
      return logger.info("Not is a member");
    }
    if (currentMember.pub_key !== childKey.publicKey.toString("base64")) {
      return logger.info("Pubkey is not equal to the member stored on the contract. Cannot be a dealer");
    }

    commits[0] = commits[0].toString("base64");
    for (let i = 0; i < rows.length; ++i) {
      rows[i] = encrypt(
        Buffer.from(members[i].pub_key, "base64"),
        childKey.privateKey,
        commits[i + 1],
        rows[i]
      ).toString("base64");
      commits[i + 1] = commits[i + 1].toString("base64");
    }

    const response = await cosmJs.execute(
      config.contract,
      {
        share_dealer: {
          share: {
            rows,
            commitments: commits,
          },
        },
      },
      undefined,
      config.gasMultiplier,
      config.gasPrice
    );

    logger.info(`share dealers: ${JSON.stringify(response.tx_response)}`);
  } catch (error) {
    logger.info(`share dealers failed:${error}`);
  }
};

const shareRows = async (members, memberShares, currentMember, round) => {
  try {
    if (!currentMember) {
      return logger.info("Not is a member");
    }
    if (currentMember.pub_key !== childKey.publicKey.toString("base64")) {
      return logger.info("Pubkey is not equal to the member stored on the contract. Cannot be a dealer");
    }
    memberShares = memberShares.filter((share) => share.commitments);
    const skShare = await getSkShare(members, memberShares, childKey.privateKey, currentMember);
    const pkShare = Buffer.from(skShare.get_pk()).toString("base64");
    const response = await cosmJs.execute(
      config.contract,
      {
        share_rows: {
          round,
          share: {
            pk_share: pkShare,
          },
        },
      },
      undefined,
      config.gasMultiplier,
      config.gasPrice
    );
    logger.info(`share rows: ${JSON.stringify(response.tx_response)}`);
  } catch (error) {
    logger.info(`Share rows failed: ${error}`);
  }
};

const resetRound = async () => {
  try {
    const response = await cosmJs.execute(
      config.contract,
      {
        reset_current_round: {},
      },
      undefined,
      config.gasMultiplier,
      config.gasPrice
    );
    logger.info(`reset round: ${JSON.stringify(response.tx_response)}`);
  } catch (err) {
    logger.info(`reset round error: ${err}`);
  }
};
// run interval, default is 5000ms block confirmed
const runInterval = async (interval = 7000) => {
  while (true) {
    try {
      await run();
    } catch (error) {
      logger.info(`error while handling: ${error}`);
    }
    await delay(interval);
  }
};

const getBlock = async () => {
  const client = await cosmJs.getCosmWasmClient();
  const height = await client.getHeight();
  return height;
};

exports.runInterval = runInterval;

console.log("Oraichain social login, version 1.0.0");
