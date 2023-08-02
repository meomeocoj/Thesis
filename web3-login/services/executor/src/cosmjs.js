const { SigningCosmWasmClient, CosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { stringToPath } = require('@cosmjs/crypto');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { GasPrice } = require('@cosmjs/stargate');
const Cosmos = require('@oraichain/cosmosjs').default;

class Cosmjs {
  constructor(chainId, rpc, lcd, mnemonic, path = "m/44'/118'/0'/0/0") {
    this.denom = 'orai';
    this.prefix = 'orai';
    this.chainId = chainId;
    this.rpc = rpc;
    this.lcd = lcd;
    this.mnemonic = mnemonic;
    this.path = path;
  }

  getCosmWasmClient = async () => {
    return CosmWasmClient.connect(this.rpc);
  };

  getClientData = async (wallet, gasPrice) => {
    const [firstAccount] = await wallet.getAccounts();

    const client = await SigningCosmWasmClient.connectWithSigner(this.rpc, wallet, {
      gasPrice: GasPrice.fromString(`${gasPrice}${this.denom}`),
      prefix: this.prefix,
    });

    return { account: firstAccount, client };
  };

  collectWallet = async () => {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      hdPaths: [stringToPath(this.path)],
      prefix: this.prefix,
    });
    return wallet;
  };

  execute = async (address, inputData, funds, gas_multiplier = 2.1, gasPrice = 0.003) => {
    const wallet = await this.collectWallet();

    const { account, client } = await this.getClientData(wallet, gasPrice);

    const result = await client.execute(
      account.address,
      address,
      inputData,
      gas_multiplier,
      undefined,
      funds ? funds : undefined
    );
    // LEGACY: backward compatibility for component files => need to return tx_response object
    return { ...result, tx_response: { txhash: result.transactionHash } };
  };

  async query(address, input) {
    const param = Buffer.from(JSON.stringify(input)).toString('base64');
    const { data } = await this.get(`/cosmwasm/wasm/v1/contract/${address}/smart/${param}`);
    return data;
  }

  async get(url) {
    const cosmos = new Cosmos(this.lcd, this.chainId);
    return cosmos.get(url);
  }
}

module.exports = Cosmjs;
