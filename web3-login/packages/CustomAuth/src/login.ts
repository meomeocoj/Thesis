import Torus, { JRPCResponse, KeyAssignCommitmentRequestResult, Some } from "@oraichain/torus.js";
import { generateJsonRPCObject, post } from "@toruslabs/http-helpers";
import jwtDecode from "jwt-decode";
import { keccak256 } from "web3-utils";

import createHandler from "./handlers/HandlerFactory";
import {
  Auth0UserInfo,
  CustomAuthArgs,
  ExtraParams,
  ILoginHandler,
  InitParams,
  LoginWindowResponse,
  SingleLoginParams,
  TorusGenericObject,
  TorusKey,
  TorusLoginResponse,
  TorusVerifierResponse,
} from "./handlers/interfaces";
import { registerServiceWorker } from "./registerServiceWorker";
import { INetworkConfig, Member, Network, NetworkConfig, query } from "./utils/blockchain";
import { LOGIN, UX_MODE, UX_MODE_TYPE } from "./utils/enums";
import { handleRedirectParameters, isFirefox, padUrlString, wait } from "./utils/helpers";
import log from "./utils/loglevel";

class CustomAuth {
  isInitialized: boolean;

  config: {
    baseUrl: string;
    redirectToOpener: boolean;
    redirect_uri: string;
    uxMode: UX_MODE_TYPE;
    locationReplaceOnRedirect: boolean;
    popupFeatures: string;
  };

  torus: Torus;

  networkConfig: INetworkConfig;

  constructor({
    baseUrl,
    network = Network.MAINNET,
    enableLogging = true,
    enableOneKey = false,
    redirectToOpener = false,
    redirectPathName = "redirect",
    uxMode = UX_MODE.POPUP,
    locationReplaceOnRedirect = false,
    popupFeatures,
    metadataUrl = "https://metadata.social-login.orai.io",
    blsdkg,
  }: CustomAuthArgs) {
    this.isInitialized = false;
    const baseUri = new URL(baseUrl);
    this.config = {
      baseUrl: padUrlString(baseUri),
      get redirect_uri() {
        return `${this.baseUrl}${redirectPathName}`;
      },
      redirectToOpener,
      uxMode,
      locationReplaceOnRedirect,
      popupFeatures,
    };
    const torus = new Torus({
      enableOneKey,
      metadataHost: metadataUrl,
      network,
      blsdkg,
    });
    this.torus = torus;
    this.networkConfig = NetworkConfig[network];

    if (enableLogging) log.enableAll();
    else log.disableAll();
  }

  async init({ skipSw = false, skipInit = false, skipPrefetch = false }: InitParams = {}): Promise<void> {
    if (skipInit) {
      this.isInitialized = true;
      return;
    }
    if (!skipSw) {
      const fetchSwResponse = await fetch(`${this.config.baseUrl}sw.js`, { cache: "reload" });
      if (fetchSwResponse.ok) {
        try {
          await registerServiceWorker(this.config.baseUrl);
          this.isInitialized = true;
          return;
        } catch (error) {
          log.warn(error);
        }
      } else {
        throw new Error("Service worker is not being served. Please serve it");
      }
    }
    if (!skipPrefetch) {
      // Skip the redirect check for firefox
      if (isFirefox()) {
        this.isInitialized = true;
        return;
      }
      await this.handlePrefetchRedirectUri();
      return;
    }
    this.isInitialized = true;
  }

  async triggerLogin(args: SingleLoginParams): Promise<TorusLoginResponse> {
    const { idToken, accessToken, verifier, typeOfLogin, jwtParams } = args;

    let loginParams: LoginWindowResponse, userInfo: TorusVerifierResponse, extraParams: ExtraParams;

    if (!idToken) {
      ({ loginParams, userInfo } = await this.login(args));
    } else {
      loginParams = { idToken, accessToken, state: {} };
      const { name, email, picture } = jwtDecode<Auth0UserInfo>(idToken);
      userInfo = { profileImage: picture, name, email, verifierId: email, typeOfLogin };
    }

    if (typeOfLogin == LOGIN.JWT)
      extraParams = {
        authorizeOptions: {
          authorizeUrl: `${jwtParams?.domain}tokeninfo`,
          iss: jwtParams?.domain,
        },
      };
    extraParams = {
      ...extraParams,
      ...userInfo.extraVerifierParams,
    };

    const torusKey = await this.getTorusKey(
      typeOfLogin,
      { verifier_id: userInfo.verifierId, verifier },
      loginParams.idToken || loginParams.accessToken,
      extraParams
    );

    return {
      ...torusKey,
      userInfo: {
        ...userInfo,
        ...loginParams,
      },
    };
  }

  async triggerLoginMobile(
    args: SingleLoginParams
  ): Promise<{ sharesIndexes: Buffer[]; shares: Buffer[]; userInfo: TorusVerifierResponse; thresholdPublicKey: string }> {
    const { verifier, typeOfLogin } = args;
    const { loginParams, userInfo } = await this.login(args);

    const { sharesIndexes, shares, thresholdPublicKey } = await this.getTorusKeyMobile(
      typeOfLogin,
      { verifier_id: userInfo.verifierId, verifier },
      loginParams.idToken || loginParams.accessToken,
      userInfo.extraVerifierParams
    );
    return {
      sharesIndexes,
      shares,
      userInfo,
      thresholdPublicKey,
    };
  }

  async login(args: SingleLoginParams): Promise<{ loginParams: LoginWindowResponse; userInfo: TorusVerifierResponse }> {
    let { typeOfLogin, clientId, jwtParams, hash, queryParameters, customState, idToken, accessToken } = args;
    if (!this.isInitialized) {
      throw new Error("Not initialized yet");
    }

    const loginHandler: ILoginHandler = createHandler({
      typeOfLogin,
      clientId,
      redirect_uri: this.config.redirect_uri,
      redirectToOpener: this.config.redirectToOpener,
      jwtParams,
      uxMode: this.config.uxMode,
      customState,
    });

    let loginParams: LoginWindowResponse;
    if (hash && queryParameters) {
      const { error, hashParameters, instanceParameters } = handleRedirectParameters(hash, queryParameters);
      if (error) throw new Error(error);
      let rest: Partial<TorusGenericObject>;
      ({ access_token: accessToken, id_token: idToken, ...rest } = hashParameters);
      loginParams = { accessToken, idToken, ...rest, state: instanceParameters };
    } else {
      loginParams = await loginHandler.handleLoginWindow({
        locationReplaceOnRedirect: this.config.locationReplaceOnRedirect,
        popupFeatures: this.config.popupFeatures,
      });
    }
    const userInfo = await loginHandler.getUserInfo(loginParams);
    return {
      loginParams,
      userInfo,
    };
  }

  async getTorusKey(
    typeOfLogin: string,
    verifierParams: { verifier_id: string; verifier: string },
    idToken: string,
    additionalParams?: ExtraParams
  ): Promise<TorusKey> {
    const found = await this.lookUpVerifierId(verifierParams.verifier_id, verifierParams.verifier);
    const { members: nodes } = await this.getContractConfig();
    const endpoints = nodes.map((node: Member) => node.end_point);
    const indexes = nodes.map((_node: Member, index: number) => index);

    if (!found) {
      let nodeSignatures = await this.getKeyAssignCommitment(idToken, verifierParams.verifier_id, verifierParams.verifier, endpoints);
      nodeSignatures = nodeSignatures.map((i: any) => i.result);
      await this.assignKey(typeOfLogin, idToken, verifierParams.verifier_id, verifierParams.verifier, endpoints, nodeSignatures, 5);
    }

    const shares = await this.torus.retrieveShares(typeOfLogin, endpoints, indexes, verifierParams, idToken, additionalParams);

    log.debug("torus-direct/getTorusKey", { retrieveShares: shares });

    return {
      privateKey: shares.privKey.toString(),
    };
  }

  async getTorusKeyMobile(
    typeOfLogin: string,
    verifierParams: { verifier_id: string; verifier: string },
    idToken: string,
    additionalParams?: ExtraParams
  ): Promise<{ sharesIndexes: Buffer[]; shares: Buffer[]; thresholdPublicKey: string }> {
    const found = await this.lookUpVerifierId(verifierParams.verifier_id, verifierParams.verifier);
    const { members: nodes } = await this.getContractConfig();
    const endpoints = nodes.map((node: Member) => node.end_point);
    const indexes = nodes.map((_node: Member, index: number) => index);

    if (!found) {
      let nodeSignatures = await this.getKeyAssignCommitment(idToken, verifierParams.verifier_id, verifierParams.verifier, endpoints);
      nodeSignatures = nodeSignatures.map((i: any) => i.result);
      await this.assignKey(typeOfLogin, idToken, verifierParams.verifier_id, verifierParams.verifier, endpoints, nodeSignatures, 5);
    }

    return this.torus.retrieveSharesMobile(typeOfLogin, endpoints, indexes, verifierParams, idToken, additionalParams);
  }

  async getKeyAssignCommitment(
    idToken: string,
    verifierId: string,
    verifier: string,
    endpoints: string[]
  ): Promise<(void | JRPCResponse<KeyAssignCommitmentRequestResult>)[]> {
    const commitment = keccak256(idToken).slice(2);
    const promiseArr = [];

    for (let i = 0; i < endpoints.length; i += 1) {
      const p = post<JRPCResponse<KeyAssignCommitmentRequestResult>>(
        endpoints[i],
        generateJsonRPCObject("AssignKeyCommitmentRequest", {
          tokencommitment: commitment,
          verifier_id: verifierId,
          verifier,
        })
      ).catch((err) => {
        log.error("🚀 ~ file: login.ts:196 ~ CustomAuth ~ getKeyAssignCommitment ~ err:", err);
        log.error("AssignKeyCommitmentRequest", err);
      });
      promiseArr.push(p);
    }

    return Some<void | JRPCResponse<KeyAssignCommitmentRequestResult>, (void | JRPCResponse<KeyAssignCommitmentRequestResult>)[]>(
      promiseArr,
      (resultArr: (void | JRPCResponse<KeyAssignCommitmentRequestResult>)[]) => {
        const completedRequests = resultArr.filter((x) => {
          if (!x || typeof x !== "object") {
            return false;
          }
          if (x.error) {
            return false;
          }
          return true;
        });
        if (completedRequests.length >= ~~(endpoints.length / 2) + 1) {
          return Promise.resolve(completedRequests);
        }
        return Promise.reject(new Error(`invalid ${JSON.stringify(resultArr)}`));
      }
    );
  }

  async assignKey(
    typeOfLogin: string,
    idToken: string,
    verifierId: string,
    verifier: string,
    endpoints: string[],
    nodeSignatures: (void | JRPCResponse<KeyAssignCommitmentRequestResult>)[],
    retries = 5
  ) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const response = await post<JRPCResponse<{ status: string }>>(
      endpoint,
      generateJsonRPCObject("AssignKeyRequest", {
        typeOfLogin,
        idtoken: idToken,
        verifier_id: verifierId,
        verifier,
        nodesignatures: nodeSignatures,
      })
    );
    if (!response || typeof response !== "object") {
      throw new Error("assign key fail");
    }
    if (response.error) {
      if (response.error?.data === "account sequence mismatch" && retries > 0) {
        await wait(5);
        await this.assignKey(typeOfLogin, idToken, verifierId, verifier, endpoints, nodeSignatures, retries - 1);
        return;
      }
      throw new Error(JSON.stringify(response.error));
    }
  }

  async lookUpVerifierId(verifierId: string, verifier: string) {
    try {
      const resp = await query(this.networkConfig, {
        verifier_id_info: {
          verifier_id: verifierId,
          verifier,
        },
      });
      return resp;
    } catch (error) {
      log.error(error);
    }
  }

  async getContractConfig() {
    return query(this.networkConfig, {
      config: {},
    });
  }

  getPostboxKeyFrom1OutOf1(privKey: string, nonce: string): string {
    return this.torus.getPostboxKeyFrom1OutOf1(privKey, nonce);
  }

  private async handlePrefetchRedirectUri(): Promise<void> {
    if (!document) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const redirectHtml = document.createElement("link");
      redirectHtml.href = this.config.redirect_uri;
      if (window.location.origin !== new URL(this.config.redirect_uri).origin) redirectHtml.crossOrigin = "anonymous";
      redirectHtml.type = "text/html";
      redirectHtml.rel = "prefetch";
      const resolveFn = () => {
        this.isInitialized = true;
        resolve();
      };
      try {
        if (redirectHtml.relList && redirectHtml.relList.supports) {
          if (redirectHtml.relList.supports("prefetch")) {
            redirectHtml.onload = resolveFn;
            redirectHtml.onerror = () => {
              reject(new Error(`Please serve redirect.html present in serviceworker folder of this package on ${this.config.redirect_uri}`));
            };
            document.head.appendChild(redirectHtml);
          } else {
            // Link prefetch is not supported. pass through
            resolveFn();
          }
        } else {
          // Link prefetch is not detectable. pass through
          resolveFn();
        }
      } catch (err) {
        resolveFn();
      }
    });
  }
}

export default CustomAuth;
