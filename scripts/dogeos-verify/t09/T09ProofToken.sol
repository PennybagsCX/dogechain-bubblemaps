// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title T09 Proof Token
/// @notice Minimal ERC-20 deployed live on DogeOS Chikyū (6281971) as the end-to-end
///         verification token for the port. Metadata is `constant` so the constructor
///         performs no string SSTOREs — Chikyū's fee floor makes deploy size matter.
///         Keeps the standard Transfer/Approval events + balanceOf / allowance getters so
///         blockscout indexes it as an ERC-20 and the app's log scanner sees ordinary logs.
contract T09ProofToken {
    string public constant name = "T09 Proof Token";
    string public constant symbol = "T09P";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 supply) {
        totalSupply = supply;
        balanceOf[msg.sender] = supply;
        emit Transfer(address(0), msg.sender, supply);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "T09: allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "T09: balance");
        unchecked {
            balanceOf[from] -= value;
        }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
