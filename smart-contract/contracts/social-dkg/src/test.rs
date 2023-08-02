use crate::{
    helpers::keccak_256,
    msg::{
        AssignKeyMsg, ConfigResponse, ExecuteMsg, InstantiateMsg,
        ListVerifierIdResponse, MemberMsg, QueryMsg,
        RoundInfoResponse, ShareDealerMsg, ShareRowMsg,
        VerifiersResponse,
    },
    state::RoundStatus,
    ContractError,
};
use anyhow::Result;
use blsdkg::{
    ff::Field,
    poly::{BivarPoly, Commitment, Poly},
    Fr, SecretKeyShare,
};
use cosmwasm_schema::cw_serde;
use k256::{
    ecdsa::SigningKey,
    ecdsa::{RecoveryId, Signature, VerifyingKey},
    elliptic_curve::rand_core::OsRng,
};

use cosmwasm_std::{
    testing::mock_dependencies, Addr, Api, Binary, BlockInfo, Empty,
    Uint256,
};
use cw_multi_test::{
    App, AppResponse, Contract, ContractWrapper, Executor,
};
use derivative::Derivative;
use serde::{de::DeserializeOwned, Serialize};

use dotenv::dotenv;

pub const DEALER: usize = 4;
pub const EXPECTED_KEY: Uint256 = Uint256::from_u128(50);
pub const NODE_ADDRESS: [&str; 5] = [
    "orai1rr8dmktw4zf9eqqwfpmr798qk6xkycgzqpgtk5",
    "orai14v5m0leuxa7dseuekps3rkf7f3rcc84kzqys87",
    "orai14n3tx8s5ftzhlxvq0w5962v60vd82h30rha573",
    "orai1p926xnuet2xd7rajsahsghzeg8sg0tp2s0trp9",
    "orai17zr98cwzfqdwh69r8v5nrktsalmgs5sawmngxz",
];
pub const APP: &str = "owallet";

pub struct SocialDKGContract(Addr);

#[derive(Derivative)]
#[derivative(Debug, Clone)]
pub struct User {
    pub secret_key: SigningKey,
    pub member_msg: MemberMsg,
}

pub fn mock_app() -> App {
    App::default()
}

pub fn contract_social_dkg() -> Box<dyn Contract<Empty>> {
    Box::new(ContractWrapper::new(
        crate::contract::execute,
        crate::contract::instantiate,
        crate::contract::query,
    ))
}

#[derive(Derivative)]
#[derivative(Debug)]
pub struct Suite {
    #[derivative(Debug = "ignore")]
    app: App,
    pub owner: String,
    social_dkg: u64,
    contract_address: Option<String>,
    users: Option<Vec<User>>,
}

impl Suite {
    pub fn init() -> Result<Suite> {
        let mut app = mock_app();
        let owner = "owner".to_owned();
        let social_dkg = app.store_code(contract_social_dkg());

        Ok(Suite {
            app,
            owner,
            social_dkg,
            contract_address: None,
            users: None,
        })
    }

    pub fn instantiate_social_dkg_contract(
        &mut self,
        owner: String,
        members: Vec<MemberMsg>,
        dealers: u8,
    ) -> SocialDKGContract {
        let contract = self
            .app
            .instantiate_contract(
                self.social_dkg,
                Addr::unchecked(self.owner.clone()),
                &InstantiateMsg {
                    members,
                    owner,
                    dealers,
                    expected_key_num: EXPECTED_KEY,
                    deadline_time: 300,
                },
                &[],
                "social_dkg",
                None,
            )
            .unwrap();
        self.contract_address = Some(contract.to_string());
        SocialDKGContract(contract)
    }

    pub fn execute(
        &mut self,
        sender_address: String,
        msg: ExecuteMsg,
    ) -> Result<AppResponse> {
        self.app.execute_contract(
            Addr::unchecked(sender_address),
            Addr::unchecked(self.contract_address.clone().unwrap()),
            &msg,
            &[],
        )
    }

    pub fn query<T: Serialize + DeserializeOwned>(
        &self,
        msg: QueryMsg,
    ) -> Result<T> {
        self.app
            .wrap()
            .query_wasm_smart(
                Addr::unchecked(
                    self.contract_address.clone().unwrap(),
                ),
                &msg,
            )
            .map_err(Into::into)
    }
}

pub fn __generate_random_dealers(
    users: &[MemberMsg],
) -> ShareDealerMsg {
    let mut rng = rand::thread_rng();
    let bivar = BivarPoly::random(NODE_ADDRESS.len() - 2, &mut rng);
    let commitment = bivar.commitment();

    let rows =
        (1..=users.len()).map(|i| Binary(bivar.row(i).to_bytes()));

    let row_encrypt: Vec<Binary> = rows
        .zip(users.iter())
        .map(|(r, u)| {
            Binary(ecies::encrypt(&u.pub_key, r.as_slice()).unwrap())
        })
        .collect();

    let commits: Vec<Binary> = (0..=users.len())
        .map(|i| Binary(commitment.row(i).to_bytes()))
        .collect();

    ShareDealerMsg {
        rows: row_encrypt,
        commitments: commits,
    }
}

pub fn generate_user(address: &str) -> User {
    let signing_key = SigningKey::random(&mut OsRng);
    let pub_key = VerifyingKey::from(&signing_key);
    User {
        secret_key: signing_key,
        member_msg: MemberMsg {
            end_point: "end_point".to_owned(),
            pub_key: Binary::from(
                pub_key.to_encoded_point(false).as_bytes(),
            ),
            address: address.to_owned(),
        },
    }
}

pub fn __do_instantiate(
    suite: &mut Suite,
) -> Result<(SocialDKGContract, Vec<User>)> {
    if let Some(contract_address) = suite.contract_address.clone() {
        let users = suite.users.clone().unwrap();
        Ok((
            SocialDKGContract(Addr::unchecked(contract_address)),
            users,
        ))
    } else {
        dotenv().ok();

        let mut users_address = NODE_ADDRESS;

        users_address.sort();

        let secret_str_env =
            std::env::var("SECRET_KEY").expect("secret not found");

        let private_key: [u8; 32] =
            hex::decode(secret_str_env).unwrap().try_into().unwrap();

        let secret_key = SigningKey::from_bytes(&private_key.into())?;

        let pub_key = VerifyingKey::from(&secret_key)
            .to_encoded_point(false)
            .as_bytes()
            .to_vec();

        let specific_user = User {
            secret_key,
            member_msg: MemberMsg {
                pub_key: Binary::from(pub_key),
                address:
                    "orai1zz8dmktw4zf9eqqwfpmr798qk6xkycgzqpgtk5"
                        .to_owned(),
                end_point: "end_point".to_owned(),
            },
        };
        // let json_pubkey =
        //     serde_json::to_string(&specific_user.member_msg.pub_key)
        //         .unwrap();

        let mut users: Vec<User> =
            users_address.into_iter().map(generate_user).collect();

        users.push(specific_user);
        let member_share: Vec<MemberMsg> = users
            .iter()
            .map(|user| user.member_msg.clone())
            .collect();

        let contract = suite.instantiate_social_dkg_contract(
            suite.owner.clone(),
            member_share,
            DEALER as u8,
        );

        suite.users = Some(users.clone());

        let tx_verifier_response = suite.execute(
            suite.owner.clone(),
            ExecuteMsg::UpdateVerifier {
                verifier: String::from("owallet"),
                client_id: String::from("owallet"),
            },
        )?;

        let attrs = tx_verifier_response.custom_attrs(1);

        assert_eq!(attrs[0].value, "update_verifier");
        assert_eq!(attrs[1].value, "owallet");
        assert_eq!(attrs[2].value, "owallet");

        Ok((contract, users))
    }
}

pub fn _share_delears(
    suite: &mut Suite,
) -> Result<(SocialDKGContract, Vec<User>)> {
    let (contract, _users) = __do_instantiate(suite).unwrap();

    let config =
        suite.query::<ConfigResponse>(QueryMsg::Config {}).unwrap();

    let shares: Vec<ShareDealerMsg> = NODE_ADDRESS
        .into_iter()
        .map(|_| __generate_random_dealers(&config.members))
        .collect();

    for (address, share) in NODE_ADDRESS.iter().zip(shares).take(4) {
        suite
            .execute(
                address.to_string(),
                ExecuteMsg::ShareDealer { share },
            )
            .unwrap();
    }

    Ok((contract, _users))
}

pub fn _share_rows(
    suite: &mut Suite,
) -> Result<(SocialDKGContract, Vec<User>)> {
    let (contract, users) = _share_delears(suite).unwrap();

    let round_info = suite
        .query::<RoundInfoResponse>(QueryMsg::RoundWorkingInfo {})
        .unwrap();

    let members_shares = round_info.members_shares.unwrap();

    for (i, user) in users.iter().enumerate() {
        let mut sec_key = Fr::zero();
        for share in members_shares.iter() {
            let row = share.rows.clone().unwrap();
            let commit = share.commitments.clone().unwrap();
            let mono_poly = Poly::from_bytes(
                ecies::decrypt(
                    user.secret_key.to_bytes().as_slice(),
                    row[i].as_slice(),
                )
                .unwrap(),
            )
            .unwrap();
            let commitment =
                Commitment::from_bytes(commit[i + 1].to_vec())
                    .unwrap();
            assert_eq!(mono_poly.commitment(), commitment);

            sec_key.add_assign(&mono_poly.evaluate(0));
        }
        // Pubkey share
        let pk_share =
            SecretKeyShare::from_mut(&mut sec_key).public_key_share();

        suite
            .execute(
                user.member_msg.address.clone(),
                ExecuteMsg::ShareRows {
                    share: ShareRowMsg {
                        pk_share: Binary::from(&pk_share.to_bytes()),
                    },
                },
            )
            .unwrap();
    }
    Ok((contract, users))
}

pub fn _generate_sigs(
    users: &[User],
    message: &[u8],
) -> Result<Vec<(Signature, RecoveryId)>> {
    let bundle_sigs: Vec<(Signature, RecoveryId)> = users
        .iter()
        .map(|u| {
            u.secret_key.sign_prehash_recoverable(message).unwrap()
        })
        .collect();

    Ok(bundle_sigs)
}

#[test]
fn do_instantiate() {
    let mut suite = Suite::init().unwrap();

    let (_contract, _users) = __do_instantiate(&mut suite).unwrap();

    let config =
        suite.query::<ConfigResponse>(QueryMsg::Config {}).unwrap();

    assert_eq!(config.total, NODE_ADDRESS.len() as u8 + 1u8);
    assert_eq!(config.owner, suite.owner.clone());
    assert_eq!(config.expected_key_num, EXPECTED_KEY);
}

#[test]
fn generate_json_sample() {
    use std::env::current_dir;
    use std::fs::write;
    use std::path::PathBuf;

    #[cw_serde]
    struct UserSerde {
        secret_key: String,
        member_share: MemberMsg,
        share: ShareDealerMsg,
        message: Vec<u8>,
        signature: Binary,
    }
    let mut users_address = NODE_ADDRESS;
    let message = keccak_256("email".as_bytes());

    users_address.sort();

    let users: Vec<User> =
        users_address.into_iter().map(generate_user).collect();

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users.as_slice(), &message).unwrap();

    let member_share: Vec<MemberMsg> =
        users.iter().map(|user| user.member_msg.clone()).collect();

    let shares: Vec<ShareDealerMsg> = NODE_ADDRESS
        .into_iter()
        .map(|_| __generate_random_dealers(&member_share))
        .collect();

    let users_and_shares: Vec<(User, ShareDealerMsg)> =
        users.into_iter().zip(shares.into_iter()).collect();

    let users_serde: Vec<UserSerde> = users_and_shares
        .into_iter()
        .zip(bundle_sigs.into_iter())
        .map(|((u, s), (sig, _))| UserSerde {
            secret_key: hex::encode(u.secret_key.to_bytes()),
            member_share: u.member_msg,
            share: s,
            message: message.to_vec(),
            signature: Binary(sig.to_bytes().to_vec()),
        })
        .collect();

    let json_users = serde_json::to_string(&users_serde).unwrap();
    let curdir = current_dir().unwrap();

    let mut path_parent = PathBuf::from(&curdir);
    path_parent.pop();
    path_parent.pop();
    let path = path_parent.join("artifacts/sample.json");

    write(path, json_users).unwrap();
}

#[test]
fn share_dealers() {
    let mut suite = Suite::init().unwrap();

    let (_contract, _users) = _share_delears(&mut suite).unwrap();

    let round_info = suite
        .query::<RoundInfoResponse>(QueryMsg::RoundWorkingInfo {})
        .unwrap();

    assert_eq!(
        round_info.round_status,
        RoundStatus::WaitForRows as u8
    );
    assert_ne!(
        round_info.round_status,
        RoundStatus::WaitForDealer as u8
    )
}

#[test]
fn share_rows() {
    let mut suite = Suite::init().unwrap();

    let (_contract, _users) = _share_rows(&mut suite).unwrap();

    let new_round_info = suite
        .query::<RoundInfoResponse>(QueryMsg::RoundInfo {
            round: Uint256::from_u128(1),
        })
        .unwrap();

    assert_eq!(
        new_round_info.round_status,
        RoundStatus::WaitForAssigment as u8
    );
}

#[test]
fn verify() {
    let mut suite = Suite::init().unwrap();

    let (contract, users) = __do_instantiate(&mut suite).unwrap();

    let domain_separator = suite
        .query::<Binary>(QueryMsg::DomainSeparator {})
        .unwrap()
        .to_base64();

    let verifier_id = "tminh1103@gmail.com";

    let hash1 = keccak_256((domain_separator + "owallet").as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + verifier_id).as_bytes(),
    );

    let binary_hash = Binary::from(hash);

    let _config =
        suite.query::<ConfigResponse>(QueryMsg::Config {}).unwrap();

    let _contract_address = contract.0.to_string();

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users.as_slice(), &hash).unwrap();

    let sigs: Vec<Binary> = bundle_sigs
        .iter()
        .map(|b| Binary::from(b.0.to_bytes().as_slice()))
        .collect();

    let deps = mock_dependencies();

    // Assert user.pub_key == recovery_pubkey
    let pub_keys_recovery: Vec<Vec<u8>> = bundle_sigs
        .iter()
        .map(|sig| {
            deps.as_ref()
                .api
                .secp256k1_recover_pubkey(
                    &hash,
                    sig.0.to_bytes().as_slice(),
                    sig.1.to_byte(),
                )
                .unwrap()
        })
        .collect();

    let mut user_pk = vec![];

    for (user, pk_re) in
        users.into_iter().zip(pub_keys_recovery.iter())
    {
        user_pk.push(Binary::from(pk_re.as_slice()));
        assert_eq!(user.member_msg.pub_key.as_slice(), pk_re);
    }

    // Check signatures msg
    let is_valid = suite
        .query::<bool>(QueryMsg::VerifyMember {
            msg: binary_hash,
            sigs,
            pub_keys: user_pk,
        })
        .unwrap();

    assert!(is_valid)
}

#[test]
fn assign_key() {
    let mut suite = Suite::init().unwrap();

    let (_contract, users) = _share_rows(&mut suite).unwrap();

    let domain_separator = suite
        .query::<Binary>(QueryMsg::DomainSeparator {})
        .unwrap()
        .to_base64();

    let verifier_id = "tminh1103@gmail.com";

    let hash1 = keccak_256((domain_separator + "owallet").as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + verifier_id).as_bytes(),
    );

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users.as_slice(), &hash).unwrap();

    // Signatures
    let sigs: Vec<Binary> = bundle_sigs
        .iter()
        .map(|b| Binary::from(b.0.to_bytes().as_slice()))
        .collect();

    let deps = mock_dependencies();

    // Assert user.pub_key == recovery_pubkey
    let pub_keys_recovery: Vec<Vec<u8>> = bundle_sigs
        .iter()
        .map(|sig| {
            deps.as_ref()
                .api
                .secp256k1_recover_pubkey(
                    &hash,
                    sig.0.to_bytes().as_slice(),
                    sig.1.to_byte(),
                )
                .unwrap()
        })
        .collect();

    let mut user_pk = vec![];

    for (user, pk_re) in
        users.into_iter().zip(pub_keys_recovery.iter())
    {
        user_pk.push(Binary::from(pk_re.as_slice()));
        assert_eq!(user.member_msg.pub_key.as_slice(), pk_re);
    }

    let is_valid = suite
        .query::<bool>(QueryMsg::VerifyMember {
            msg: Binary::from(hash),
            sigs: sigs.clone(),
            pub_keys: user_pk.clone(),
        })
        .unwrap();
    println!("{:?}", is_valid);

    let response = suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: "owallet".to_string(),
            }),
        )
        .unwrap();

    let attrs = response.custom_attrs(1);

    assert_eq!(attrs[0].value, "assign_key");
    assert_eq!(attrs[1].value, verifier_id);
    assert_eq!(attrs[2].value, "owallet");
    assert_eq!(attrs[3].value, "1");

    let new_round_info = suite
        .query::<RoundInfoResponse>(QueryMsg::RoundInfo {
            round: Uint256::from_u128(1),
        })
        .unwrap();

    assert_eq!(
        new_round_info.round_status,
        RoundStatus::Assigned as u8
    );

    let response = suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: String::from("owallet"),
            }),
        )
        .unwrap_err();
    assert_eq!(
        response.root_cause().to_string(),
        ContractError::PoolEmpty.to_string(),
    );

    // Create key
    _share_rows(&mut suite).unwrap();

    let response = suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: String::from("owallet"),
            }),
        )
        .unwrap_err();

    assert_eq!(
        response.root_cause().to_string(),
        ContractError::InvalidAssigned.to_string(),
    );
}

#[test]
fn reset_current_round_happy_case() {
    let mut suite = Suite::init().unwrap();

    let (_contract, users) = _share_delears(&mut suite).unwrap();

    let current_block = suite.app.block_info();

    println!("prev_block: {:?}", current_block);
    suite.app.set_block(BlockInfo {
        height: current_block.height + 1000,
        time: current_block.time.plus_seconds(1000 * 5),
        chain_id: current_block.chain_id,
    });

    let current_block = suite.app.block_info();

    println!("after_block: {:?}", current_block);

    let round_info = suite
        .query::<RoundInfoResponse>(QueryMsg::RoundWorkingInfo {});

    println!(
        "current_round_deadline: {:?}",
        round_info.unwrap().deadline
    );

    let response = suite
        .execute(
            users[1].member_msg.address.clone(),
            ExecuteMsg::ResetCurrentRound {},
        )
        .unwrap();

    let attrs = response.custom_attrs(1);

    assert_eq!(attrs[0].value, "reset_current_round");
    assert_eq!(attrs[1].value, "1");

    let (_contract, users2) = _share_rows(&mut suite).unwrap();

    let domain_separator = suite
        .query::<Binary>(QueryMsg::DomainSeparator {})
        .unwrap()
        .to_base64();

    let verifier_id = "email";

    let hash1 = keccak_256((domain_separator + "owallet").as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + verifier_id).as_bytes(),
    );

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users2.as_slice(), &hash).unwrap();

    // Signatures
    let sigs: Vec<Binary> = bundle_sigs
        .iter()
        .map(|b| Binary::from(b.0.to_bytes().as_slice()))
        .collect();

    let deps = mock_dependencies();

    // Assert user.pub_key == recovery_pubkey
    let pub_keys_recovery: Vec<Vec<u8>> = bundle_sigs
        .iter()
        .map(|sig| {
            deps.as_ref()
                .api
                .secp256k1_recover_pubkey(
                    &hash,
                    sig.0.to_bytes().as_slice(),
                    sig.1.to_byte(),
                )
                .unwrap()
        })
        .collect();

    let mut user_pk = vec![];

    for (user, pk_re) in
        users.into_iter().zip(pub_keys_recovery.iter())
    {
        user_pk.push(Binary::from(pk_re.as_slice()));
        assert_eq!(user.member_msg.pub_key.as_slice(), pk_re);
    }

    let response = suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: String::from("owallet"),
            }),
        )
        .unwrap();

    let attrs = response.custom_attrs(1);

    assert_eq!(attrs[0].value, "assign_key");
    assert_eq!(attrs[1].value, verifier_id);
    assert_eq!(attrs[2].value, "owallet");
    assert_eq!(attrs[3].value, "1");
}

#[test]
fn reset_current_round_in_deadline() {
    let mut suite = Suite::init().unwrap();

    let (_contract, users) = _share_delears(&mut suite).unwrap();

    let err = suite
        .execute(
            users[1].member_msg.address.clone(),
            ExecuteMsg::ResetCurrentRound {},
        )
        .unwrap_err();

    assert_eq!(
        err.root_cause().to_string(),
        ContractError::Unauthorized {}.to_string()
    );
}

#[test]
fn reset_current_round_in_wait_for_assign() {
    let mut suite = Suite::init().unwrap();

    let (_contract, users) = _share_rows(&mut suite).unwrap();

    let err = suite
        .execute(
            users[1].member_msg.address.clone(),
            ExecuteMsg::ResetCurrentRound {},
        )
        .unwrap_err();

    assert_eq!(
        err.root_cause().to_string(),
        "social_dkg::state::RoundInfo not found".to_string()
    );
}

#[test]
fn query_verifies() {
    let mut suite = Suite::init().unwrap();
    __do_instantiate(&mut suite).unwrap();

    suite
        .execute(
            suite.owner.clone(),
            ExecuteMsg::UpdateVerifier {
                verifier: String::from("tkey-google"),
                client_id: String::from("https://tkey-google.com.vn"),
            },
        )
        .unwrap();

    let verifiers = suite
        .query::<VerifiersResponse>(QueryMsg::Verifiers {
            start_after: None,
            limit: None,
        })
        .unwrap();

    assert_eq!(verifiers.verifiers.len(), 2);
}

#[test]
fn query_list_verifier_id() {
    let mut suite = Suite::init().unwrap();

    let (_contract, users) = _share_rows(&mut suite).unwrap();

    let domain_separator = suite
        .query::<Binary>(QueryMsg::DomainSeparator {})
        .unwrap()
        .to_base64();

    let verifier_id = "tminh1103@gmail.com";

    let hash1 =
        keccak_256((domain_separator.clone() + "owallet").as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + verifier_id).as_bytes(),
    );

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users.as_slice(), &hash).unwrap();

    // Signatures
    let sigs: Vec<Binary> = bundle_sigs
        .iter()
        .map(|b| Binary::from(b.0.to_bytes().as_slice()))
        .collect();

    let deps = mock_dependencies();

    // Assert user.pub_key == recovery_pubkey
    let pub_keys_recovery: Vec<Vec<u8>> = bundle_sigs
        .iter()
        .map(|sig| {
            deps.as_ref()
                .api
                .secp256k1_recover_pubkey(
                    &hash,
                    sig.0.to_bytes().as_slice(),
                    sig.1.to_byte(),
                )
                .unwrap()
        })
        .collect();

    let mut user_pk = vec![];

    for (user, pk_re) in users.iter().zip(pub_keys_recovery.iter()) {
        user_pk.push(Binary::from(pk_re.as_slice()));
        assert_eq!(user.member_msg.pub_key.as_slice(), pk_re);
    }

    suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: "owallet".to_string(),
            }),
        )
        .unwrap();

    // create user 2
    _share_rows(&mut suite).unwrap();

    let verifier_id = "tminh0204@gmail.com";

    let hash1 = keccak_256((domain_separator + "owallet").as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + verifier_id).as_bytes(),
    );

    let bundle_sigs: Vec<(Signature, RecoveryId)> =
        _generate_sigs(users.as_slice(), &hash).unwrap();

    // Signatures
    let sigs: Vec<Binary> = bundle_sigs
        .iter()
        .map(|b| Binary::from(b.0.to_bytes().as_slice()))
        .collect();

    let deps = mock_dependencies();

    // Assert user.pub_key == recovery_pubkey
    let pub_keys_recovery: Vec<Vec<u8>> = bundle_sigs
        .iter()
        .map(|sig| {
            deps.as_ref()
                .api
                .secp256k1_recover_pubkey(
                    &hash,
                    sig.0.to_bytes().as_slice(),
                    sig.1.to_byte(),
                )
                .unwrap()
        })
        .collect();

    let mut user_pk = vec![];

    for (user, pk_re) in
        users.into_iter().zip(pub_keys_recovery.iter())
    {
        user_pk.push(Binary::from(pk_re.as_slice()));
        assert_eq!(user.member_msg.pub_key.as_slice(), pk_re);
    }

    suite
        .execute(
            "sender".to_string(),
            ExecuteMsg::AssignKey(AssignKeyMsg {
                sigs: sigs.clone(),
                verifier_id: verifier_id.to_string(),
                pub_keys: user_pk.clone(),
                verifier: "owallet".to_string(),
            }),
        )
        .unwrap();

    // query list user
    let list_verifier_id = suite
        .query::<ListVerifierIdResponse>(
            QueryMsg::ListVerifierIdByVerifier {
                verifier: "owallet".into(),
                start_after: None,
                limit: None,
            },
        )
        .unwrap();

    assert_eq!(list_verifier_id.list_verifier_id.len(), 2);
}
