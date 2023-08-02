import React, { useState, useEffect } from 'react';
import logo from '../../assets/img/logo.svg';
import './Newtab.css';
import './Newtab.scss';
import ThresholdKey from '@oraichain/default';
import ChromeStorageModule from '@oraichain/chrome-storage';
import SecurityQuestionsModule from '@oraichain/security-questions';
import init, { interpolate, get_pk } from "@oraichain/blsdkg";
import { Network } from '@oraichain/customauth';
import swal from 'sweetalert';

const tKey = new ThresholdKey({
  modules: {
    chromeStorageModule: new ChromeStorageModule(),
    securityQuestions: new SecurityQuestionsModule(),
  },
  manualSync: false,
  customAuthArgs: {
    baseUrl: `${window.location.origin}`,
    network: Network.TESTNET,
    blsdkg: { init, get_pk, interpolate },
  },
});

const CLIENT_ID =
  '349137538811-8t7s7584app6am5j09a2kglo8dg39eqn.apps.googleusercontent.com';

const Newtab = () => {
  const [user, setUser] = useState();
  const [privateKey, setPrivateKey] = useState();

  useEffect(() => {
    const init = async () => {
      // Initialization of Service Provider
      try {
        await tKey.serviceProvider.init({
          skipSw: true,
          skipPrefetch: true,
        });
      } catch (error) {
        console.error(error);
      }
    };
    init();
  }, [privateKey]);

  const initializeNewKey = async (hash, queryParams) => {
    if (!tKey) {
      return;
    }
    try {
      await triggerLogin(hash, queryParams); // Calls the triggerLogin() function above
      // Initialization of tKey
      await tKey.initialize(); // 1/2 flow
      // Gets the deviceShare
      try {
        await tKey.modules.chromeStorageModule.inputShareFromChromeExtensionStorage(); // 2/2 flow
      } catch (e) {
        await recoverShare();
      }

      // Checks the requiredShares to reconstruct the tKey,
      // starts from 2 by default and each of the above share reduce it by one.
      const { requiredShares } = tKey.getKeyDetails();
      if (requiredShares <= 0) {
        const reconstructedKey = await tKey.reconstructKey();
        setPrivateKey(reconstructedKey?.privKey.toString(16, 64));
      }
    } catch (error) {
      console.log('🚀 ~ file: Popup.jsx:66 ~ initializeNewKey ~ error:', error);
    }
  };

  const triggerLogin = async (hash, queryParameters) => {
    if (!tKey) {
      return;
    }
    try {
      // Triggering Login using Service Provider ==> opens the popup
      const loginResponse = await tKey.serviceProvider.triggerLogin({
        typeOfLogin: 'google',
        clientId: CLIENT_ID,
        verifier: "tkey-google",
        hash,
        queryParameters,
      });
      setUser(loginResponse.userInfo);
    } catch (error) {
      console.log('🚀 ~ file: Popup.jsx:86 ~ triggerLogin ~ error:', error);
    }
  };

  const generateNewShareWithPassword = async () => {
    if (!tKey) {
      return;
    }
    // swal is just a pretty dialog box
    swal('Enter password (>10 characters)', {
      content: 'input',
    }).then(async (value) => {
      if (value.length > 10) {
        try {
          await tKey.modules.securityQuestions.generateNewShareWithSecurityQuestions(
            value,
            'whats your password?'
          );
          swal(
            'Success',
            'Successfully generated new share with password.',
            'success'
          );
        } catch (error) {
          swal('Error', error?.message.toString(), 'error');
        }
      } else {
        swal('Error', 'Password must be >= 11 characters', 'error');
      }
    });
  };

  const recoverShare = async () => {
    if (!tKey) {
      return;
    }
    // swal is just a pretty dialog box
    swal('Enter password (>10 characters)', {
      content: 'input',
    }).then(async (value) => {
      if (value.length > 10) {
        try {
          await tKey.modules.securityQuestions.inputShareFromSecurityQuestions(
            value
          ); // 2/2 flow
          const { requiredShares } = tKey.getKeyDetails();
          if (requiredShares <= 0) {
            const reconstructedKey = await tKey.reconstructKey();
            setPrivateKey(reconstructedKey?.privKey.toString(16, 64));
          }
          const shareStore = await tKey.generateNewShare();
          await tKey.modules.chromeStorageModule.storeDeviceShare(
            shareStore.newShareStores[shareStore.newShareIndex.toString('hex')]
          );
          swal(
            'Success',
            'Successfully logged you in with the recovery password.',
            'success'
          );
        } catch (error) {
          swal('Error', error?.message.toString(), 'error');
        }
      } else {
        swal('Error', 'Password must be >= 11 characters', 'error');
      }
    });
  };

  return (
    <div className="App">
      <button
        onClick={async () => {
          try {
            const nonce = Math.floor(Math.random() * 10000).toString();
            const state = encodeURIComponent(
              Buffer.from(
                JSON.stringify({
                  instanceId: nonce,
                  redirectToOpener: false,
                })
              ).toString('base64')
            );

            const redirectURL = chrome.identity.getRedirectURL('index.html');
            const authParams = new URLSearchParams({
              client_id: CLIENT_ID,
              response_type: 'id_token token',
              redirect_uri: redirectURL,
              scope: 'profile email openid',
              state,
              nonce,
            });
            const authURL = `https://accounts.google.com/o/oauth2/auth?${authParams.toString()}`;
            // chrome.identity.launchWebAuthFlow({
            //   url: 'https://accounts.google.com/logout',
            //   interactive: true,
            // });
            // return;
            chrome.identity.launchWebAuthFlow(
              {
                url: authURL,
                interactive: true,
              },
              async (res) => {
                if (!res) return;
                try {
                  const url = new URL(res);
                  const hash = url.hash.substr(1);
                  console.log('🚀 ~ file: Newtab.jsx:195 ~ hash:', hash);
                  let queryParams = {};
                  for (let key of url.searchParams.keys()) {
                    queryParams[key] = url.searchParams.get(key);
                  }
                  console.log(
                    '🚀 ~ file: Newtab.jsx:197 ~ queryParams:',
                    queryParams
                  );
                  await initializeNewKey(hash, queryParams);
                } catch (error) {
                  console.log(error);
                }
              }
            );
          } catch (error) {
            console.log('🚀 ~ file: Popup.jsx:143 ~ onClick={ ~ error:', error);
          }
        }}
      >
        Login
      </button>
      {privateKey && (
        <>
          <div>Private key: {privateKey}</div>
          <button onClick={generateNewShareWithPassword}>
            Generate new share
          </button>
        </>
      )}
    </div>
  );
};

export default Newtab;
