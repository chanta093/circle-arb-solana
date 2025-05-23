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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wormhole = exports.loadProtocols = exports.loadPlatforms = exports.isPlatformDefinition = void 0;
const sdk_connect_1 = require("@wormhole-foundation/sdk-connect");
function isPlatformDefinition(obj) {
    return obj && obj.Platform && obj.Address && obj.getSigner && obj.protocols;
}
exports.isPlatformDefinition = isPlatformDefinition;
/**
 * load the platforms and their protocols by
 *  first calling the import function for each platform
 *  then calling the import function for each protocol
 *
 * @param loaders the list of PlatformLoaders to load
 */
async function loadPlatforms(loaders) {
    try {
        // Load platforms
        const platforms = await Promise.all(loaders.map(async (loader) => loader()));
        // Load all protocols by default
        await Promise.all(platforms.map(async (p) => await loadProtocols(p)));
        // return platforms
        return platforms;
    }
    catch (e) {
        console.error("Failed to load required packages", e);
        throw e;
    }
}
exports.loadPlatforms = loadPlatforms;
/**
 * loads the protocols for a given platform by calling the import function for each protocol
 *  if a list of protocols is provided, only those protocols will be loaded
 *
 * @param platform the PlatformDefinition to load the protocols for
 * @param protocols the list of protocols to load
 * @throws if any of the protocols fail to load
 */
async function loadProtocols(platform, protocols) {
    try {
        let toLoad = Object.entries(platform.protocols);
        if (protocols)
            toLoad.filter(([name]) => protocols.includes(name));
        await Promise.all(toLoad.map(([, loaderFn]) => loaderFn()));
    }
    catch (e) {
        console.error("Failed to load required packages", e);
        throw e;
    }
}
exports.loadProtocols = loadProtocols;
async function wormhole(network, platforms, config) {
    const loaded = (await loadPlatforms(platforms)).map((p) => p.Platform);
    return new sdk_connect_1.Wormhole(network, loaded, config);
}
exports.wormhole = wormhole;
__exportStar(require("@wormhole-foundation/sdk-connect"), exports);
__exportStar(require("./addresses.js"), exports);
//# sourceMappingURL=index.js.map