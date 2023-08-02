import { get } from "@toruslabs/http-helpers";

export interface INetworkConfig {
  rpc: string;
  lcd: string;
  chainId: string;
  contract: string;
}

export enum Network {
  TESTNET = "testnet",
  MAINNET = "mainnet",
}

export const NetworkConfig = {
  [Network.TESTNET]: {
    rpc: "https://rpc.testnet.orai.io",
    lcd: "https://lcd.testnet.orai.io",
    chainId: "Oraichain-testnet",
    contract: "orai1v5hwd3w4dx3628suz3lrhd9hr8ktdgjytu95kfsa0vxxmxj42rtsxv4sdn",
  },
  [Network.MAINNET]: {
    rpc: "https://rpc.orai.io",
    lcd: "https://lcd.orai.io",
    chainId: "Oraichain",
    contract: "orai1v5hwd3w4dx3628suz3lrhd9hr8ktdgjytu95kfsa0vxxmxj42rtsxv4sdn",
  },
};

export interface Member {
  address: string;
  pub_key: string;
  end_point: string;
  index?: number;
}

export const query = async (config: INetworkConfig, input: any) => {
  const param = Buffer.from(JSON.stringify(input)).toString("base64");
  const resp = await get<{ data: any }>(`${config.lcd}/cosmwasm/wasm/v1/contract/${config.contract}/smart/${param}`);
  return resp?.data;
};
