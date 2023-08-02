import ThresholdKey from "@oraichain/default";
import TorusStorageLayer from "@oraichain/storage-layer-torus";
import WebStorageModule from "@oraichain/web-storage";
import { generatePrivate } from "@toruslabs/eccrypto";
import TorusServiceProvider from "@oraichain/service-provider-torus";
import SecurityQuestionsModule from "@oraichain/security-questions";
import init, { interpolate, get_pk } from "@oraichain/blsdkg";
import { Network } from "@oraichain/customauth";
import OnlySocialKey from "@oraichain/only-social-key";

// Configuration of Service Provider
const customAuthArgs = {
  baseUrl: `${window.location.origin}/serviceworker`,
  network: Network.TESTNET, // based on the verifier network.
  blsdkg: { init, get_pk, interpolate },
};
// Configuration of Modules
const webStorageModule = new WebStorageModule();
const securityQuestionsModule = new SecurityQuestionsModule();
const storageLayer = new TorusStorageLayer({
  hostUrl: "https://metadata.social-login-testnet.orai.io",
});

const serviceProvider = new TorusServiceProvider({
  customAuthArgs,
});

// Instantiation of tKey
export const tKey = new ThresholdKey({
  modules: {
    webStorage: webStorageModule,
    securityQuestions: securityQuestionsModule,
  },
  manualSync: false,
  customAuthArgs,
  storageLayer: new TorusStorageLayer({ hostUrl: "https://metadata.social-login-testnet.orai.io" }),
  serviceProvider,
});

export const ReconstructTKey = new ThresholdKey({
  modules: {
    webStorage: webStorageModule,
    securityQuestions: securityQuestionsModule,
  },
  manualSync: false,
  customAuthArgs,
  storageLayer,
  serviceProvider,
});
export const OnlySocialLoginKey = new OnlySocialKey({
  serviceProvider,
  storageLayer,
});
// (window as any).tKey = ReconstructTKey;
(window as any).tKey = OnlySocialKey;
