use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{
    to_binary, Addr, CosmosMsg, Deps, Env, StdResult, Uint256,
    WasmMsg,
};
use tiny_keccak::{Hasher, Keccak};

use crate::{msg::ExecuteMsg, state::ROUND_INFO, ContractError};

/// CwTemplateContract is a wrapper around Addr that provides a lot of helpers
/// for working with this.
#[derive(
    Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema,
)]
pub struct CwTemplateContract(pub Addr);

impl CwTemplateContract {
    pub fn addr(&self) -> Addr {
        self.0.clone()
    }

    pub fn call<T: Into<ExecuteMsg>>(
        &self,
        msg: T,
    ) -> StdResult<CosmosMsg> {
        let msg = to_binary(&msg.into())?;
        Ok(WasmMsg::Execute {
            contract_addr: self.addr().into(),
            msg,
            funds: vec![],
        }
        .into())
    }
}

pub fn is_expired(
    _deps: Deps,
    _env: Env,
    round: Uint256,
) -> Result<bool, ContractError> {
    match ROUND_INFO.may_load(_deps.storage, &round.to_string())? {
        Some(info) => Ok(info.deadline < _env.block.height),
        None => Ok(false),
    }
}

pub fn keccak_256(data: &[u8]) -> [u8; 32] {
    let mut sha256 = Keccak::v256();
    sha256.update(data);
    let mut output = [0u8; 32];
    sha256.finalize(&mut output);
    output
}

const MAX_LIMIT: u32 = 30;
const DEFAULT: u32 = 10;

pub fn calc_limit(request: Option<u32>) -> usize {
    request.unwrap_or(DEFAULT).min(MAX_LIMIT) as usize
}
