/**
 * Solana -> Arbitrumブリッジスクリプト
 * 
 * 機能：
 * 1. Solanaウォレット内の全トークンをUSDCへスワップ
 * 2. SOL残高から指定量のガス代を残してUSDCへスワップ
 * 3. 全てのUSDCをArbitrumへブリッジ
 * 
 * 処理フロー：
 * 1. 環境設定とウォレット初期化
 * 2. トークン残高の取得とスワップ
 * 3. USDC残高の確認
 * 4. ブリッジトランザクションの実行
 */

import {
	CircleTransfer,
	wormhole,
	amount,
	ChainAddress,
	ChainContext,
	Network,
	Signer,
	Chain,
	TxHash,
	DEFAULT_TASK_TIMEOUT,
	TokenTransfer,
	TransferState,
	Wormhole
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { config } from 'dotenv';
import { Connection, PublicKey, VersionedTransaction, Keypair } from '@solana/web3.js';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import fetch from 'cross-fetch';

config();

/**
 * SignerStuffインターフェース
 * ブロックチェーンの署名者情報を管理
 * 
 * @param chain - チェーンのコンテキスト情報
 * @param signer - トランザクション署名用のウォレット
 * @param address - ウォレットのアドレス
 */
interface SignerStuff<N extends Network, C extends Chain> {
	chain: ChainContext<N, C>;
	signer: Signer<N, C>;
	address: ChainAddress<C>;
}

/**
 * 環境変数を取得する関数
 * .envファイルから必要な設定値を読み込む
 * 
 * @param key - 環境変数のキー
 * @returns 環境変数の値
 * @throws 環境変数が存在しない場合にエラー
 */
function getEnv(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`Missing environment variable: ${key}`);
	return val;
}

/**
 * ブロックチェーン用の署名者をセットアップする関数
 * SolanaとEVMチェーン用のウォレットを初期化
 * 
 * @param chain - 対象チェーンのコンテキスト
 * @returns 署名者情報（SignerStuff）
 * @throws サポートされていないプラットフォームの場合にエラー
 */
async function getSigner<N extends Network, C extends Chain>(
	chain: ChainContext<N, C>
): Promise<{ chain: ChainContext<N, C>; signer: Signer<N, C>; address: ChainAddress<C> }> {
	let signer: Signer;
	const platform = chain.platform.utils()._platform;

	switch (platform) {
		case 'Solana':
			signer = await (await solana()).getSigner(await chain.getRpc(), getEnv('SOL_PRIVATE_KEY'));
			break;
		case 'Evm':
			signer = await (await evm()).getSigner(await chain.getRpc(), getEnv('ETH_PRIVATE_KEY'));
			break;
		default:
			throw new Error('Unsupported platform: ' + platform);
	}

	return {
		chain,
		signer: signer as Signer<N, C>,
		address: Wormhole.chainAddress(chain.chain, signer.address()),
	};
}

/**
 * トランザクションの状態を監視するログ関数
 * トークン転送の進行状況をトラッキング
 * 
 * @param wh - Wormholeインスタンス
 * @param xfer - トークン転送オブジェクト
 * @param tag - ログ用のタグ
 * @param timeout - タイムアウト時間
 * @returns 最終的な転送レシート
 */
async function waitLog<N extends Network = Network>(
	wh: Wormhole<N>,
	xfer: TokenTransfer<N>,
	tag: string = "WaitLog",
	timeout: number = DEFAULT_TASK_TIMEOUT,
) {
	const tracker = TokenTransfer.track(wh, TokenTransfer.getReceipt(xfer), timeout);
	let receipt;
	for await (receipt of tracker) {
		console.log(`${tag}: Current trasfer state: `, TransferState[receipt.state]);
	}
	return receipt;
}

// Jupiter DEXのAPI URL（v6）
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

// Solana上のUSDCトークンのミントアドレス
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

(async function () {
	// Wormholeオブジェクトの初期化（Mainnet用）
	const wh = await wormhole('Mainnet', [evm, solana]);

	// チェーンコンテキストの取得（RPCクライアントへの参照を保持）
	const sendChain = wh.getChain('Solana');
	const rcvChain = wh.getChain('Arbitrum');

	// ローカルの秘密鍵からウォレット署名者を取得
	const source = await getSigner(sendChain);
	const destination = await getSigner(rcvChain);

	// Solana接続の設定
	const connection = new Connection('https://api.mainnet-beta.solana.com');

	// Solanaウォレット内のトークン残高を取得
	const solanaAddress = new PublicKey(source.signer.address());
	const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
		solanaAddress,
		{ programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
	);

	// USDCトークン以外の全てのトークンをUSDCへスワップ
	// Jupiter DEXを使用して最適なスワップルートで取引
	for (const account of tokenAccounts.value) {
		const mint = account.account.data.parsed.info.mint;
		if (mint !== USDC_MINT.toString()) {
			const balance = account.account.data.parsed.info.tokenAmount.amount;
			if (balance > 0) {
				console.log('Converting token:', mint, 'balance:', balance);
				// Jupiter APIを使用してトークン -> USDC スワップのクォートを取得
				// slippageBps: 100 = 1%のスリッページ許容
				const quoteResponse = await fetch(`${JUPITER_API_URL}/quote?inputMint=${mint}&outputMint=${USDC_MINT.toString()}&amount=${balance}&slippageBps=100`);
				const quote = await quoteResponse.json();

				if (quote) {
					// Jupiterからスワップトランザクションを取得
					// wrapUnwrapSOL: false = SOLのラップ/アンラップを行わない
					const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							quoteResponse: quote,
							userPublicKey: solanaAddress.toString(),
							wrapUnwrapSOL: false
						})
					});
					const swapResult = await swapResponse.json();
					
					// スワップトランザクションの実行
					// 1. 最新のブロックハッシュを取得
					// 2. トランザクションをデシリアライズ
					// 3. ブロックハッシュを設定
					// 4. 署名
					// 5. 送信と確認
					const swapTransaction = VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
					const latestBlockhash = await connection.getLatestBlockhash('finalized');
					swapTransaction.message.recentBlockhash = latestBlockhash.blockhash;
					const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY || ''));
					swapTransaction.sign([keypair]);
					const txid = await connection.sendTransaction(swapTransaction, {
						skipPreflight: false,
						preflightCommitment: 'finalized',
						maxRetries: 5
					});
					await connection.confirmTransaction({
						signature: txid,
						blockhash: latestBlockhash.blockhash,
						lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
					}, 'finalized');
				}
			}
		}
	}

	// SOL残高の取得
	const solBalance = await connection.getBalance(solanaAddress);
	const solToKeep = 0.005 * 1e9; // ガス代用に残すSOL（0.005 SOL = 5,000,000 lamports）

	// SOLをUSDCに変換（ガス代を除く）
	if (solBalance > solToKeep) {
		console.log('Current SOL balance:', solBalance / 1e9, 'SOL');
		console.log('Keeping', solToKeep / 1e9, 'SOL for gas');
		const solToSwap = solBalance - solToKeep;
		console.log('Converting', solToSwap / 1e9, 'SOL to USDC');
		
		// Jupiter APIを使用してSOL -> USDC スワップのクォートを取得
		// So11...112はWrapped SOL（wSOL）のアドレス
		// slippageBps: 100 = 1%のスリッページ許容
		const quoteResponse = await fetch(`${JUPITER_API_URL}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${USDC_MINT.toString()}&amount=${solToSwap}&slippageBps=100`);
		const quote = await quoteResponse.json();

		if (quote) {
			// Jupiterからスワップトランザクションを取得
			// wrapUnwrapSOL: true = 自動的にSOLをwSOLにラップしてスワップ
			const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					quoteResponse: quote,
					userPublicKey: solanaAddress.toString(),
					wrapUnwrapSOL: true
				})
			});
			const swapResult = await swapResponse.json();
			
			// SOL -> USDCスワップトランザクションの実行
			// 1. 最新のブロックハッシュを取得
			// 2. トランザクションをデシリアライズ
			// 3. ブロックハッシュを設定
			// 4. 署名
			// 5. 送信と確認
			const swapTransaction = VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
			const latestBlockhash = await connection.getLatestBlockhash('finalized');
			swapTransaction.message.recentBlockhash = latestBlockhash.blockhash;
			const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY || ''));
			swapTransaction.sign([keypair]);
			const txid = await connection.sendTransaction(swapTransaction, {
				skipPreflight: false,
				preflightCommitment: 'finalized',
				maxRetries: 5
			});
			await connection.confirmTransaction({
				signature: txid,
				blockhash: latestBlockhash.blockhash,
				lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
			}, 'finalized');
		}
	}


	// スワップ後のUSDC残高を取得（最大3回再試行、3秒間隔）
	// トランザクションの確認とUSDC残高の更新に時間がかかるため、
	// 複数回チェックして確実に最新の残高を取得
	let amt = 0n;
	for (let i = 0; i < 3; i++) {
		console.log('Waiting for USDC balance update...');
		await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機

		const updatedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
			solanaAddress,
			{ programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
		);

		const usdcAccount = updatedTokenAccounts.value.find(
			account => account.account.data.parsed.info.mint === USDC_MINT.toString()
		);
		amt = BigInt(usdcAccount ? usdcAccount.account.data.parsed.info.tokenAmount.amount : 0);

		console.log('USDC balance:', Number(amt) / 1e6, 'USDC');

		if (amt === 0n) {
			console.log('No USDC balance to bridge');
			process.exit(0);
		}

		// USDCが見つかったらブリッジを実行
		if (amt > 0n) {
			break;
		}
	}

	const automatic = false; // 手動ブリッジモードを使用

	// Circle CCTPブリッジのトランザクションを作成（USDCのみ対応）
	const nativeGas = amount.units(amount.parse('0.005', 18)); // Arbitrum側で必要なガス代（0.0005 ETH）
	const xfer = await wh.circleTransfer(amt, source.address, destination.address, automatic, undefined, nativeGas);
	console.log('Circle Transfer object created:', xfer);

	const quote = await CircleTransfer.quoteTransfer(sendChain, rcvChain, xfer.transfer);
	console.log('Quote: ', quote);

	// ステップ1: 送信元チェーン（Solana）でトランザクションを開始
	console.log('Starting Transfer');
	const srcTxids = await xfer.initiateTransfer(source.signer);
	console.log(`Started Transfer: `, srcTxids);

	// ステップ2: Circle Attestation（VAA）の取得を待機
	const timeout = 120 * 1000; // タイムアウト時間: 120秒
	// Circle Attestationの取得には通常30-60秒程度かかるため、
	// 十分な待機時間を設定
	console.log('Waiting for Attestation');
	const attestIds = await xfer.fetchAttestation(timeout);
	console.log(`Got Attestation: `, attestIds);

	// ステップ3: 送信先チェーン（Arbitrum）でトランザクションを完了
	console.log('Completing Transfer');
	const dstTxids = await xfer.completeTransfer(destination.signer);
	console.log(`Completed Transfer: `, dstTxids);

	// 最終的なトランザクションの状態を表示
	// 送信元と送信先のトランザクションID、Attestation情報などを含む
	console.log('Circle Transfer status: ', xfer);

	process.exit(0);
})();
