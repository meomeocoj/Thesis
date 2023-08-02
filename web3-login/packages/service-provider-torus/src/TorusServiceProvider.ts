import { StringifiedType, TorusServiceProviderArgs } from "@oraichain/common-types";
import CustomAuth, { CustomAuthArgs, InitParams, SubVerifierDetails, TorusLoginResponse, TorusVerifierResponse } from "@oraichain/customauth";
import { ServiceProviderBase } from "@oraichain/service-provider-base";
import BN from "bn.js";

class TorusServiceProvider extends ServiceProviderBase {
  directWeb: CustomAuth;

  singleLoginKey: BN;

  customAuthArgs: CustomAuthArgs;

  constructor({ enableLogging = false, postboxKey, customAuthArgs }: TorusServiceProviderArgs) {
    super({ enableLogging, postboxKey });
    this.customAuthArgs = customAuthArgs;
    this.directWeb = new CustomAuth(customAuthArgs);
    this.serviceProviderName = "TorusServiceProvider";
  }

  static fromJSON(value: StringifiedType): TorusServiceProvider {
    const { enableLogging, postboxKey, customAuthArgs, serviceProviderName } = value;
    if (serviceProviderName !== "TorusServiceProvider") return undefined;

    return new TorusServiceProvider({
      enableLogging,
      postboxKey,
      customAuthArgs,
    });
  }

  async init(params?: InitParams): Promise<void> {
    return this.directWeb.init(params);
  }

  async triggerLogin(params: SubVerifierDetails): Promise<TorusLoginResponse> {
    const obj = await this.directWeb.triggerLogin(params);
    this.setPostboxKey(new BN(obj.privateKey, "hex"));
    return obj;
  }

  async triggerLoginMobile(params: SubVerifierDetails): Promise<{
    sharesIndexes: Buffer[];
    shares: Buffer[];
    userInfo: TorusVerifierResponse;
  }> {
    return this.directWeb.triggerLoginMobile(params);
  }

  setPostboxKey(key: BN) {
    this.postboxKey = key;
  }

  toJSON(): StringifiedType {
    return {
      ...super.toJSON(),
      serviceProviderName: this.serviceProviderName,
      customAuthArgs: this.customAuthArgs,
    };
  }
}

export default TorusServiceProvider;
