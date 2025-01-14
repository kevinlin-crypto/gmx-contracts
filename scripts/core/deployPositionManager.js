const { getFrameSigner, deployContract, contractAt , sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toUsd } = require("../../test/shared/units")
const { errors } = require("../../test/core/Vault/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

const depositFee = 30 // 0.3%

async function getArbValues() {
  const signer = await getFrameSigner()

  const vault = await contractAt("Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A")
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064", signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const orderBook = await contractAt("OrderBook", "0x09f77E8A13De9a35a7231028187e9fD5DB8a2ACB")

  const orderKeeper = { address: "0xd4266F8F82F7405429EE18559e548979D49160F3" }
  const liquidator = { address: "0x44311c91008DDE73dE521cd25136fD37d616802c" }

  const partnerContracts = [
    "0x9ba57a1D3f6C61Ff500f598F16b97007EB02E346", // Vovo ETH up vault
    "0x5D8a5599D781CC50A234D73ac94F4da62c001D8B", // Vovo ETH down vault
    "0xE40bEb54BA00838aBE076f6448b27528Dd45E4F0", // Vovo BTC up vault
    "0x1704A75bc723A018D176Dc603b0D1a361040dF16" // Vovo BTC down vault
  ]

  return { vault, timelock, router, weth, depositFee, orderBook, orderKeeper, liquidator, partnerContracts }
}

async function getAvaxValues() {
  const signer = await getFrameSigner()

  const vault = await contractAt("Vault", "0x9ab2De34A33fB459b538c43f251eB825645e8595")
  const timelock = await contractAt("Timelock", await vault.gov(), signer)
  const router = await contractAt("Router", "0x5F719c2F1095F7B9fc68a68e35B51194f4b6abe8", signer)
  const weth = await contractAt("WETH", tokens.nativeToken.address)
  const orderBook = await contractAt("OrderBook", "0x4296e307f108B2f583FF2F7B7270ee7831574Ae5")

  const orderKeeper = { address: "0x06f34388A7CFDcC68aC9167C5f1C23DD39783179" }
  const liquidator = { address: "0x7858A4C42C619a68df6E95DF7235a9Ec6F0308b9" }

  const partnerContracts = []

  return { vault, timelock, router, weth, depositFee, orderBook, orderKeeper, liquidator, partnerContracts }
}

async function getValues() {
  if (network === "arbitrum") {
    return getArbValues()
  }

  if (network === "avax") {
    return getAvaxValues()
  }
}

async function main() {
  const { vault, timelock, router, weth, depositFee, orderBook, orderKeeper, liquidator, partnerContracts } = await getValues()

  const positionManager = await deployContract("PositionManager", [vault.address, router.address, weth.address, depositFee, orderBook.address])
  await sendTxn(positionManager.setOrderKeeper(orderKeeper.address, true), "positionManager.setOrderKeeper(orderKeeper)")
  await sendTxn(positionManager.setLiquidator(liquidator.address, true), "positionManager.setLiquidator(liquidator)")
  await sendTxn(timelock.setContractHandler(positionManager.address, true), "timelock.setContractHandler(positionRouter)")
  await sendTxn(timelock.setLiquidator(vault.address, positionManager.address, true), "timelock.setLiquidator(vault, positionManager, true)")
  await sendTxn(router.addPlugin(positionManager.address), "router.addPlugin(positionManager)")

  for (let i = 0; i < partnerContracts.length; i++) {
    const partnerContract = partnerContracts[i]
    await sendTxn(positionManager.setPartner(partnerContract, true), "positionManager.setPartner(partnerContract)")
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
