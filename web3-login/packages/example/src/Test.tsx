import React, { useEffect, useState } from "react";
import swal from "sweetalert";
import { bech32 } from "bech32";
import elliptic from "elliptic";
import BN from "bn.js";
// @ts-ignore
import crypto from "crypto-browserify";
import { ReconstructTKey as tKey } from "./tkey";
import "./App.css";
import init, { interpolate, get_pk } from "@oraichain/blsdkg";
init();

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
        await (tKey.serviceProvider as any).init();
      } catch (error) {
        console.error(error);
      }
    };
    init();
  }, []);

  const triggerLogin = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      // Triggering Login using Service Provider ==> opens the popup
      const loginResponse = await (tKey.serviceProvider as any).triggerLogin({
        typeOfLogin: "google",
        clientId: "349137538811-8t7s7584app6am5j09a2kglo8dg39eqn.apps.googleusercontent.com",
        verifier: "tkey-google",
      });
      setUser(loginResponse.userInfo);
      // uiConsole('Public Key : ' + loginResponse.publicAddress);
      // uiConsole('Email : ' + loginResponse.userInfo.email);
    } catch (error) {
      console.log(error);
      uiConsole(error);
    }
  };

  const triggerLoginMobile = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      // Triggering Login using Service Provider ==> opens the popup
      const { shares, sharesIndexes, userInfo, thresholdPublicKey } = await (tKey.serviceProvider as any).triggerLoginMobile({
        typeOfLogin: "google",
        clientId: "349137538811-8t7s7584app6am5j09a2kglo8dg39eqn.apps.googleusercontent.com",
        verifier: "tkey-google",
      });
      setUser(userInfo);
      const privKey = interpolate(sharesIndexes, shares);
      const pubKey = get_pk(privKey);

      if (thresholdPublicKey !== Buffer.from(pubKey).toString("hex")) {
        throw new Error("Public key not same");
      }
      const privateKey = await (tKey.serviceProvider as any).directWeb.torus.getPrivKey(new BN(privKey));
      (tKey.serviceProvider as any).setPostboxKey(privateKey.privKey);
    } catch (error) {
      uiConsole(error);
    }
  };

  const initializeNewKey = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      await triggerLogin(); // Calls the triggerLogin() function above
      // await triggerLoginMobile();
      // Initialization of tKey
      await tKey.initialize(); // 1/2 flow
      // Gets the deviceShare
      try {
        await (tKey.modules.webStorage as any).inputShareFromWebStorage(); // 2/2 flow
      } catch (e) {
        uiConsole(e);
        await recoverShare();
      }

      // Checks the requiredShares to reconstruct the tKey,
      // starts from 2 by default and each of the above share reduce it by one.
      const { requiredShares } = tKey.getKeyDetails();
      if (requiredShares <= 0) {
        const reconstructedKey = await tKey.reconstructKey();
        setPrivateKey(reconstructedKey?.privKey.toString(16, 64));
        uiConsole("Private Key: " + reconstructedKey.privKey.toString(16, 64));
      }
    } catch (error) {
      uiConsole(error, "caught");
    }
  };

  const changeSecurityQuestionAndAnswer = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    // swal is just a pretty dialog box
    swal("Enter password (>10 characters)", {
      content: "input" as any,
    }).then(async (value) => {
      if (value.length > 10) {
        await (tKey.modules.securityQuestions as any).changeSecurityQuestionAndAnswer(value, "whats your password?");
        swal("Success", "Successfully changed new share with password.", "success");
        uiConsole("Successfully changed new share with password.");
      } else {
        swal("Error", "Password must be >= 11 characters", "error");
      }
    });
    const keyDetails = await tKey.getKeyDetails();
    uiConsole(keyDetails);
  };

  const generateNewShareWithPassword = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    // swal is just a pretty dialog box
    swal("Enter password (>10 characters)", {
      content: "input" as any,
    }).then(async (value) => {
      if (value.length > 10) {
        try {
          await (tKey.modules.securityQuestions as any).generateNewShareWithSecurityQuestions(value, "whats your password?");
          swal("Success", "Successfully generated new share with password.", "success");
          uiConsole("Successfully generated new share with password.");
        } catch (error) {
          swal("Error", (error as any)?.message.toString(), "error");
        }
      } else {
        swal("Error", "Password must be >= 11 characters", "error");
      }
    });
  };

  const recoverShare = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    // swal is just a pretty dialog box
    swal("Enter password (>10 characters)", {
      content: "input" as any,
    }).then(async (value) => {
      if (value.length > 10) {
        try {
          await (tKey.modules.securityQuestions as any).inputShareFromSecurityQuestions(value); // 2/2 flow
          const { requiredShares } = tKey.getKeyDetails();
          if (requiredShares <= 0) {
            const reconstructedKey = await tKey.reconstructKey();
            setPrivateKey(reconstructedKey?.privKey.toString(16, 64));
            uiConsole("Private Key: " + reconstructedKey.privKey.toString(16, 64));
          }
          const shareStore = await tKey.generateNewShare();
          await (tKey.modules.webStorage as any).storeDeviceShare(shareStore.newShareStores[shareStore.newShareIndex.toString("hex")]);
          swal("Success", "Successfully logged you in with the recovery password.", "success");
          uiConsole("Successfully logged you in with the recovery password.");
        } catch (error) {
          swal("Error", (error as any)?.message.toString(), "error");
          uiConsole(error);
          logout();
        }
      } else {
        swal("Error", "Password must be >= 11 characters", "error");
        logout();
      }
    });
  };

  const requestNewShare = async () => {
    try {
      await triggerLogin();
      await tKey.initialize();
      const currentEncPubKeyX = await (tKey.modules.shareTransfer as any).requestNewShare(window.navigator.userAgent, tKey.getCurrentShareIndexes());
      console.log("🚀 ~ file: Test.tsx:208 ~ requestNewShare ~ currentEncPubKeyX:", currentEncPubKeyX);
      const shareStore = await (tKey.modules.shareTransfer as any).startRequestStatusCheck(currentEncPubKeyX, true);
      const { privKey } = await tKey.reconstructKey(false);
      console.log("🚀 ~ file: Test.tsx:208 ~ requestNewShare ~ privKey:", privKey);
    } catch (error) {
      console.log("🚀 ~ file: Test.tsx:211 ~ requestNewShare ~ error:", error);
    }
  };

  const keyDetails = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    const keyDetails = await tKey.getKeyDetails();
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
      <h1 className="title">A social login solution for Web3 using Shamir’s secret sharing and verified DKG</h1>

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
