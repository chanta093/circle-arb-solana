import { Wormhole, } from "@wormhole-foundation/sdk-connect";
export function isPlatformDefinition(obj) {
    return obj && obj.Platform && obj.Address && obj.getSigner && obj.protocols;
}
/**
 * load the platforms and their protocols by
 *  first calling the import function for each platform
 *  then calling the import function for each protocol
 *
 * @param loaders the list of PlatformLoaders to load
 */
export async function loadPlatforms(loaders) {
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
/**
 * loads the protocols for a given platform by calling the import function for each protocol
 *  if a list of protocols is provided, only those protocols will be loaded
 *
 * @param platform the PlatformDefinition to load the protocols for
 * @param protocols the list of protocols to load
 * @throws if any of the protocols fail to load
 */
export async function loadProtocols(platform, protocols) {
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
export async function wormhole(network, platforms, config) {
    const loaded = (await loadPlatforms(platforms)).map((p) => p.Platform);
    return new Wormhole(network, loaded, config);
}
export * from "@wormhole-foundation/sdk-connect";
export * from "./addresses.js";
//# sourceMappingURL=index.js.map