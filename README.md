# CCTP Bridge for Solana to EVM

## 機能
- Solanaウォレット内の全トークンをUSDCへ自動スワップ
- SOL残高から指定量のガス代を残してUSDCへスワップ
- 全てのUSDCをArbitrumへブリッジ

## 必要条件
- Node.js と npm
- Solanaウォレットの秘密鍵
- EVMウォレットの秘密鍵（ガス代用のネイティブトークンが必要）

## セットアップ
1. .envファイルの作成:
```bash
SOL_PRIVATE_KEY="YOUR_SOLANA_PRIVATE_KEY"
ETH_PRIVATE_KEY="YOUR_EVM_PRIVATE_KEY"
```

2. 依存パッケージのインストール:
```bash
npm install
```

## 使用方法
```bash
npm run circle-arb-solana
```

## ガス代の目安
- Solana: ~0.005 SOL（スワップ用に残す量）
- Arbitrum: ~0.0005 ETH（ブリッジ用）

## トランザクション例
### トークンスワップ
1. 他のトークンをUSDCへスワップ
2. SOL残高からガス代を除いた分をUSDCへスワップ
3. スワップ後のUSDC残高を確認（5秒間隔で最大3回）

### ブリッジ
1. SolanaからArbitrumへUSDCをブリッジ
2. Circle Attestationの取得を待機
3. Arbitrumでのトランザクション完了を確認

## エラー処理
- トランザクション失敗時の自動リトライ
- USDC残高確認の複数回試行
- ブロックハッシュの自動更新

## 依存パッケージのバージョン
### メインパッケージ
- @wormhole-foundation/sdk: ^1.20.0
- @wormhole-foundation/sdk-definitions: ^1.20.0
- @wormhole-foundation/sdk-evm-cctp: ^1.20.0
- @wormhole-foundation/sdk-solana-cctp: ^1.20.0

### Solana関連
- @solana/web3.js: ^1.98.2
- @solana/wallet-adapter-ledger: ^0.9.25
- @solana/wallet-adapter-react: ^0.15.35
- @project-serum/anchor: ^0.26.0

### その他
- ethers: ^6.13.4
- dotenv: ^16.4.5
- cross-fetch: ^4.1.0
- @orca-so/sdk: ^1.2.26
- @orca-so/common-sdk: ^0.6.11
- @ethersproject/hardware-wallets: ^5.7.0
- @ledgerhq/hw-transport-webusb: ^6.29.4

### 開発ツール
- tsx: ^4.19.0

## 環境情報
- Node.js: v18.20.8以上推奨
- npm: v10.8.2以上推奨
- プラットフォーム: Windows/Linux/Mac対応
