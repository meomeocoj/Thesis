use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},
    // Add any other custom errors you like here.
    #[error("Invalid dealer threshold")]
    InvalidDealerThreshold {},

    #[error("Key creating phase expired")]
    ExpiredRound {},

    #[error("Invalid row threshold")]
    InvalidRowThreshold {},

    #[error("Status: {0}")]
    WrongStatus(String),

    #[error("Duplicate member")]
    DuplicateMember,

    #[error("KeyPool is empty")]
    PoolEmpty,

    #[error("Round has already been assigned")]
    InvalidAssigned,

    #[error("{0} is not whitelisted")]
    NotWhitelisted(String),
}
