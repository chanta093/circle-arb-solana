"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSigner = getSigner;
exports.waitLog = waitLog;
const sdk_1 = require("@wormhole-foundation/sdk");
const evm_1 = __importDefault(require("@wormhole-foundation/sdk/evm"));
const solana_1 = __importDefault(require("@wormhole-foundation/sdk/solana"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// Function to fetch environment variables (like your private key)
function getEnv(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing environment variable: ${key}`);
    return val;
}
// Signer setup function for different blockchain platforms
async function getSigner(chain) {
    let signer;
    const platform = chain.platform.utils()._platform;
    switch (platform) {
        case 'Solana':
            signer = await (await (0, solana_1.default)()).getSigner(await chain.getRpc(), getEnv('SOL_PRIVATE_KEY'));
            break;
        case 'Evm':
            signer = await (await (0, evm_1.default)()).getSigner(await chain.getRpc(), getEnv('ETH_PRIVATE_KEY'));
            break;
        default:
            throw new Error('Unsupported platform: ' + platform);
    }
    return {
        chain,
        signer: signer,
        address: sdk_1.Wormhole.chainAddress(chain.chain, signer.address()),
    };
}
async function waitLog(wh, xfer, tag = "WaitLog", timeout = sdk_1.DEFAULT_TASK_TIMEOUT) {
    const tracker = sdk_1.TokenTransfer.track(wh, sdk_1.TokenTransfer.getReceipt(xfer), timeout);
    let receipt;
    for await (receipt of tracker) {
        console.log(`${tag}: Current trasfer state: `, sdk_1.TransferState[receipt.state]);
    }
    return receipt;
}
