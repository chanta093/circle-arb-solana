"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_connect_1 = require("@wormhole-foundation/sdk-connect");
const _cosmwasm = __importStar(require("@wormhole-foundation/sdk-cosmwasm"));
const cosmwasm = {
    Address: _cosmwasm.CosmwasmAddress,
    Platform: _cosmwasm.CosmwasmPlatform,
    getSigner: _cosmwasm.getCosmwasmSigner,
    protocols: {
        WormholeCore: () => Promise.resolve().then(() => __importStar(require("@wormhole-foundation/sdk-cosmwasm-core"))),
        TokenBridge: () => Promise.resolve().then(() => __importStar(require("@wormhole-foundation/sdk-cosmwasm-tokenbridge"))),
        IbcBridge: () => Promise.resolve().then(() => __importStar(require("@wormhole-foundation/sdk-cosmwasm-ibc"))),
    },
    getChain: (network, chain, overrides) => new _cosmwasm.CosmwasmChain(chain, new _cosmwasm.CosmwasmPlatform(network, (0, sdk_connect_1.applyChainsConfigConfigOverrides)(network, _cosmwasm._platform, {
        [chain]: overrides,
    }))),
};
exports.default = cosmwasm;
//# sourceMappingURL=cosmwasm.js.map