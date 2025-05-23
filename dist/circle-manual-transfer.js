"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@wormhole-foundation/sdk");
const evm_1 = __importDefault(require("@wormhole-foundation/sdk/evm"));
const solana_1 = __importDefault(require("@wormhole-foundation/sdk/solana"));
const helpers_1 = require("./helpers/helpers");
const web3_js_1 = require("@solana/web3.js");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const USDC_MINT = new web3_js_1.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
(async function () {
    // Initialize the Wormhole object for the Testnet environment and add supported chains (evm and solana)
    const wh = await (0, sdk_1.wormhole)('Mainnet', [evm_1.default, solana_1.default]);
    // Grab chain Contexts -- these hold a reference to a cached rpc client
    const sendChain = wh.getChain('Solana');
    const rcvChain = wh.getChain('Arbitrum');
    // Get signer from local key
    const source = await (0, helpers_1.getSigner)(sendChain);
    const destination = await (0, helpers_1.getSigner)(rcvChain);
    // Solana接続の設定
    const connection = new web3_js_1.Connection('https://api.mainnet-beta.solana.com');
    // トークン残高の取得
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(new web3_js_1.PublicKey(source.address.toString()), { programId: new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
    // SOL残高の取得
    const solBalance = await connection.getBalance(new web3_js_1.PublicKey(source.address.toString()));
    const solToKeep = 0.001 * 1e9; // 0.001 SOL in lamports
    // SOLをUSDCに変換（ガス代を除く）
    if (solBalance > solToKeep) {
        const solToSwap = solBalance - solToKeep;
        // SOL -> USDC スワップのクォートを取得
        const quoteResponse = await (0, cross_fetch_1.default)(`${JUPITER_API_URL}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${USDC_MINT.toString()}&amount=${solToSwap}&slippageBps=50`);
        const quote = await quoteResponse.json();
        if (quote) {
            // スワップトランザクションを取得
            const swapResponse = await (0, cross_fetch_1.default)(`${JUPITER_API_URL}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: source.address.toString(),
                    wrapUnwrapSOL: true
                })
            });
            const swapResult = await swapResponse.json();
            // トランザクションの実行
            const swapTransaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
            const txid = await connection.sendTransaction(swapTransaction);
            await connection.confirmTransaction(txid);
        }
    }
    // 他のトークンをUSDCにスワップ
    for (const account of tokenAccounts.value) {
        const mint = account.account.data.parsed.info.mint;
        if (mint !== USDC_MINT.toString()) {
            const balance = account.account.data.parsed.info.tokenAmount.amount;
            if (balance > 0) {
                // トークン -> USDC スワップのクォートを取得
                const quoteResponse = await (0, cross_fetch_1.default)(`${JUPITER_API_URL}/quote?inputMint=${mint}&outputMint=${USDC_MINT.toString()}&amount=${balance}&slippageBps=50`);
                const quote = await quoteResponse.json();
                if (quote) {
                    // スワップトランザクションを取得
                    const swapResponse = await (0, cross_fetch_1.default)(`${JUPITER_API_URL}/swap`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            quoteResponse: quote,
                            userPublicKey: source.address.toString(),
                            wrapUnwrapSOL: false
                        })
                    });
                    const swapResult = await swapResponse.json();
                    // トランザクションの実行
                    const swapTransaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
                    const txid = await connection.sendTransaction(swapTransaction);
                    await connection.confirmTransaction(txid);
                }
            }
        }
    }
    // USDC残高の取得
    const usdcAccount = tokenAccounts.value.find(account => account.account.data.parsed.info.mint === USDC_MINT.toString());
    const amt = BigInt(usdcAccount ? usdcAccount.account.data.parsed.info.tokenAmount.amount : 0);
    const automatic = false;
    // Create the circleTransfer transaction (USDC-only)
    const nativeGas = sdk_1.amount.units(sdk_1.amount.parse('0.0005', 18));
    const xfer = await wh.circleTransfer(amt, source.address, destination.address, automatic, undefined, nativeGas);
    console.log('Circle Transfer object created:', xfer);
    const quote = await sdk_1.CircleTransfer.quoteTransfer(sendChain, rcvChain, xfer.transfer);
    console.log('Quote: ', quote);
    // Step 1: Initiate the transfer on the source chain (Solana)
    console.log('Starting Transfer');
    const srcTxids = await xfer.initiateTransfer(source.signer);
    console.log(`Started Transfer: `, srcTxids);
    // Step 2: Wait for Circle Attestation (VAA)
    const timeout = 120 * 1000; // Timeout in milliseconds (120 seconds)
    console.log('Waiting for Attestation');
    const attestIds = await xfer.fetchAttestation(timeout);
    console.log(`Got Attestation: `, attestIds);
    // Step 3: Complete the transfer on the destination chain (Arbitrum)
    console.log('Completing Transfer');
    const dstTxids = await xfer.completeTransfer(destination.signer);
    console.log(`Completed Transfer: `, dstTxids);
    console.log('Circle Transfer status: ', xfer);
    process.exit(0);
})();
