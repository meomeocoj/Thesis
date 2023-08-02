import { useEffect, useState } from "react";
import { bech32 } from "bech32";
import elliptic from "elliptic";
// @ts-ignore
import crypto from "crypto-browserify";
import { OnlySocialLoginKey as onlySocialKey } from "./tkey";
import "./App.css";
import { TorusServiceProvider } from "@oraichain/service-provider-torus";
// import init from "@oraichain/blsdkg";
// init();

const ec = new elliptic.ec("secp256k1");

const hash160 = (buffer: Buffer) => {
  const sha256Hash = crypto.createHash("sha256").update(buffer).digest();
  try {
    return crypto.createHash("rmd160").update(sha256Hash).digest();
  } catch (err) {
    return crypto.createHash("ripemd160").update(sha256Hash).digest();
  }
};

const getAddress = (privateKey: string) => {
  const key = ec.keyFromPrivate(privateKey);
  const pubKey = Buffer.from(key.getPublic().encodeCompressed("array"));
  const words = bech32.toWords(hash160(pubKey));
  const address = bech32.encode("orai", words);
  return address;
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [privateKey, setPrivateKey] = useState<any>();

  // Init Service Provider inside the useEffect Method
  useEffect(() => {
    const init = async () => {
      // Initialization of Service Provider
      try {
        await (onlySocialKey.serviceProvider as TorusServiceProvider).init();
      } catch (error) {
        console.error(error);
      }
    };
    init();
  }, []);

  const triggerLogin = async () => {
    if (!onlySocialKey) {
      uiConsole("onlySocialKey not initialized yet");
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/idtoken");
      const { idToken } = await response.json();
      const loginResponse = await (onlySocialKey.serviceProvider as TorusServiceProvider).triggerLogin({
        typeOfLogin: "jwt",
        clientId: "http://localhost:3000/",
        verifier: "local-jwt",
        jwtParams: {
          domain: "http://localhost:3000/",
        },
        idToken,
      });

      console.log(loginResponse);
    } catch (error) {
      console.log({ error });
      uiConsole(error);
    }
  };

  const initializeNewKey = async () => {
    if (!onlySocialKey) {
      uiConsole("onlySocialKey not initialized yet");
      return;
    }
    try {
      await triggerLogin(); // Calls the triggerLogin() function above
      await onlySocialKey.initialize(); // 1/2 flow
      const { pubKey } = onlySocialKey.getKeyDetails();
      console.log({ pubKey });
      setPrivateKey(onlySocialKey.privKey.toString(16, 64));
      console.log("Private Key: " + onlySocialKey.privKey.toString(16, 64));
    } catch (error) {
      uiConsole(error, "caught");
    }
  };

  const keyDetails = async () => {
    if (!onlySocialKey) {
      uiConsole("onlySocialKey not initialized yet");
      return;
    }
    const keyDetails = onlySocialKey.getKeyDetails();
    uiConsole(keyDetails);
  };

  const logout = (): void => {
    uiConsole("Log out");
    setUser(null);
  };

  const getUserInfo = (): void => {
    uiConsole(user);
  };

  const getPrivateKey = (): void => {
    uiConsole(privateKey);
  };

  const getAccounts = async () => {
    const address = getAddress(privateKey);
    uiConsole(address);
  };

  const uiConsole = (...args: any[]): void => {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
  };

  const loggedInView = (
    <>
      <div className="flex-container">
        <div>
          <button onClick={getUserInfo} className="card">
            Get User Info
          </button>
        </div>
        <div>
          <button onClick={keyDetails} className="card">
            Key Details
          </button>
        </div>
        <div>
          <button onClick={getPrivateKey} className="card">
            Private Key
          </button>
        </div>

        <div>
          <button onClick={getAccounts} className="card">
            Get Accounts
          </button>
        </div>

        <div>
          <button onClick={logout} className="card">
            Log Out
          </button>
        </div>
      </div>

      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      <button onClick={initializeNewKey} className="card">
        Login
      </button>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="http://web3auth.io/" rel="noreferrer">
          Web3Auth (onlySocialKey)
        </a>
        & ReactJS Ethereum Example
      </h1>

      <div className="grid">{privateKey ? loggedInView : unloggedInView}</div>

      <footer className="footer">
        <a href="https://github.com/Web3Auth/examples/tree/main/self-host/self-host-react-example" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
