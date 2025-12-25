/**
 * Stellar Operation Formatter
 *
 * Converts raw Stellar operation data from decoded XDR into human-readable descriptions.
 * Supports all 26 Stellar operation types as of Protocol 21.
 *
 * Reference: https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations
 */

/**
 * Formats a Stellar address for display (first 5 chars)
 * @param {string} addr - Full Stellar address
 * @returns {string} Shortened address or '?' if invalid
 */
export function shortenAddress(addr) {
  if (!addr || typeof addr !== 'string') return '?';
  return addr.substring(0, 5);
}

/**
 * Formats an asset for display
 * @param {object|string} asset - Asset object with asset_code/asset_issuer or 'native'
 * @returns {string} Formatted asset string (e.g., 'XLM', 'USDC')
 */
export function formatAsset(asset) {
  if (!asset) return '?';

  // Handle string 'native'
  if (asset === 'native' || asset === 'Native') return 'XLM';

  // Handle object formats
  if (typeof asset === 'object') {
    // Format: { native: null } or { Native: {} }
    if ('native' in asset || 'Native' in asset) return 'XLM';

    // Format: { credit_alphanum4: { asset_code, asset_issuer } }
    if (asset.credit_alphanum4) {
      return asset.credit_alphanum4.asset_code || '?';
    }
    if (asset.CreditAlphanum4) {
      return asset.CreditAlphanum4.asset_code || '?';
    }

    // Format: { credit_alphanum12: { asset_code, asset_issuer } }
    if (asset.credit_alphanum12) {
      return asset.credit_alphanum12.asset_code || '?';
    }
    if (asset.CreditAlphanum12) {
      return asset.CreditAlphanum12.asset_code || '?';
    }

    // Format: { asset_code, asset_issuer } directly
    if (asset.asset_code) {
      return asset.asset_code;
    }

    // Format: { assetCode } (camelCase)
    if (asset.assetCode) {
      return asset.assetCode;
    }
  }

  return '?';
}

/**
 * Formats a raw amount (stroops) for display
 * @param {string|number|bigint} amount - Amount in stroops (1 XLM = 10^7 stroops)
 * @param {number} decimals - Number of decimal places (default 7 for XLM)
 * @returns {string} Formatted amount
 */
export function formatAmount(amount, decimals = 7) {
  if (amount === undefined || amount === null) return '?';

  try {
    const amountStr = String(amount);
    const amountBigInt = BigInt(amountStr);
    const divisor = BigInt(10 ** decimals);
    const whole = amountBigInt / divisor;
    const fraction = amountBigInt % divisor;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractionStr}`;
  } catch {
    return String(amount);
  }
}

/**
 * Formats a price for display
 * @param {object} price - Price object with n (numerator) and d (denominator)
 * @returns {string} Formatted price
 */
export function formatPrice(price) {
  if (!price) return '?';

  const n = price.n || price.N || price.numerator;
  const d = price.d || price.D || price.denominator;

  if (n === undefined || d === undefined || d === 0) return '?';

  const result = Number(n) / Number(d);
  return result.toFixed(7).replace(/\.?0+$/, '');
}

/**
 * Extracts the operation type from an operation object
 * @param {object} op - Operation object from decoded XDR
 * @returns {string} Operation type name
 */
export function getOperationType(op) {
  if (!op || !op.body) return 'unknown';

  const body = op.body;

  // The body contains a single key which is the operation type
  const types = [
    'create_account', 'createAccount', 'CreateAccount',
    'payment', 'Payment',
    'path_payment_strict_receive', 'pathPaymentStrictReceive', 'PathPaymentStrictReceive',
    'path_payment_strict_send', 'pathPaymentStrictSend', 'PathPaymentStrictSend',
    'manage_sell_offer', 'manageSellOffer', 'ManageSellOffer',
    'manage_buy_offer', 'manageBuyOffer', 'ManageBuyOffer',
    'create_passive_sell_offer', 'createPassiveSellOffer', 'CreatePassiveSellOffer',
    'set_options', 'setOptions', 'SetOptions',
    'change_trust', 'changeTrust', 'ChangeTrust',
    'allow_trust', 'allowTrust', 'AllowTrust',
    'account_merge', 'accountMerge', 'AccountMerge',
    'inflation', 'Inflation',
    'manage_data', 'manageData', 'ManageData',
    'bump_sequence', 'bumpSequence', 'BumpSequence',
    'create_claimable_balance', 'createClaimableBalance', 'CreateClaimableBalance',
    'claim_claimable_balance', 'claimClaimableBalance', 'ClaimClaimableBalance',
    'begin_sponsoring_future_reserves', 'beginSponsoringFutureReserves', 'BeginSponsoringFutureReserves',
    'end_sponsoring_future_reserves', 'endSponsoringFutureReserves', 'EndSponsoringFutureReserves',
    'revoke_sponsorship', 'revokeSponsorship', 'RevokeSponsorship',
    'clawback', 'Clawback',
    'clawback_claimable_balance', 'clawbackClaimableBalance', 'ClawbackClaimableBalance',
    'set_trust_line_flags', 'setTrustLineFlags', 'SetTrustLineFlags',
    'liquidity_pool_deposit', 'liquidityPoolDeposit', 'LiquidityPoolDeposit',
    'liquidity_pool_withdraw', 'liquidityPoolWithdraw', 'LiquidityPoolWithdraw',
    'invoke_host_function', 'invokeHostFunction', 'InvokeHostFunction',
    'extend_footprint_ttl', 'extendFootprintTtl', 'ExtendFootprintTTL', 'ExtendFootprintTtl',
    'restore_footprint', 'restoreFootprint', 'RestoreFootprint',
  ];

  for (const type of types) {
    if (type in body) {
      return normalizeOperationType(type);
    }
  }

  // Fallback: return first key
  const keys = Object.keys(body);
  if (keys.length > 0) {
    return normalizeOperationType(keys[0]);
  }

  return 'unknown';
}

/**
 * Normalizes operation type to snake_case
 * @param {string} type - Operation type in any case
 * @returns {string} Normalized operation type
 */
function normalizeOperationType(type) {
  // Convert camelCase/PascalCase to snake_case
  return type
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Gets the operation data from the body
 * @param {object} op - Operation object
 * @returns {object} Operation data
 */
function getOpData(op) {
  if (!op || !op.body) return {};

  const body = op.body;
  const keys = Object.keys(body);

  for (const key of keys) {
    if (body[key] && typeof body[key] === 'object') {
      return body[key];
    }
  }

  return {};
}

/**
 * Formats a single operation into a human-readable description
 * @param {object} op - Operation object from decoded XDR
 * @returns {object} { type: string, description: string, details: object }
 */
export function formatOperation(op) {
  const type = getOperationType(op);
  const data = getOpData(op);
  const sourceAccount = op.source_account || op.sourceAccount;

  let description = '';
  let details = {};

  switch (type) {
    case 'create_account': {
      const destination = data.destination || data.Destination || '?';
      const startingBalance = formatAmount(data.starting_balance || data.startingBalance);
      description = `create account ${shortenAddress(destination)} with ${startingBalance} XLM`;
      details = { destination, startingBalance };
      break;
    }

    case 'payment': {
      const destination = data.destination || data.Destination || '?';
      const asset = formatAsset(data.asset);
      const amount = formatAmount(data.amount);
      description = `pay ${amount} ${asset} to ${shortenAddress(destination)}`;
      details = { destination, asset, amount };
      break;
    }

    case 'path_payment_strict_receive': {
      const destination = data.destination || data.dest_asset ? (data.destination || '?') : '?';
      const sendAsset = formatAsset(data.send_asset || data.sendAsset);
      const destAsset = formatAsset(data.dest_asset || data.destAsset);
      const destAmount = formatAmount(data.dest_amount || data.destAmount);
      description = `swap ${sendAsset} for ${destAmount} ${destAsset} to ${shortenAddress(destination)}`;
      details = { destination, sendAsset, destAsset, destAmount };
      break;
    }

    case 'path_payment_strict_send': {
      const destination = data.destination || '?';
      const sendAsset = formatAsset(data.send_asset || data.sendAsset);
      const sendAmount = formatAmount(data.send_amount || data.sendAmount);
      const destAsset = formatAsset(data.dest_asset || data.destAsset);
      description = `swap ${sendAmount} ${sendAsset} for ${destAsset} to ${shortenAddress(destination)}`;
      details = { destination, sendAsset, sendAmount, destAsset };
      break;
    }

    case 'manage_sell_offer': {
      const selling = formatAsset(data.selling);
      const buying = formatAsset(data.buying);
      const amount = formatAmount(data.amount);
      const price = formatPrice(data.price);
      const offerId = data.offer_id || data.offerId || '0';

      if (amount === '0' && offerId !== '0') {
        description = `cancel sell offer #${offerId}`;
      } else if (offerId !== '0' && offerId !== 0) {
        description = `update sell offer #${offerId}: ${amount} ${selling} for ${buying} at ${price}`;
      } else {
        description = `sell ${amount} ${selling} for ${buying} at ${price}`;
      }
      details = { selling, buying, amount, price, offerId };
      break;
    }

    case 'manage_buy_offer': {
      const selling = formatAsset(data.selling);
      const buying = formatAsset(data.buying);
      const buyAmount = formatAmount(data.buy_amount || data.buyAmount);
      const price = formatPrice(data.price);
      const offerId = data.offer_id || data.offerId || '0';

      if (buyAmount === '0' && offerId !== '0') {
        description = `cancel buy offer #${offerId}`;
      } else if (offerId !== '0' && offerId !== 0) {
        description = `update buy offer #${offerId}: ${buyAmount} ${buying} with ${selling} at ${price}`;
      } else {
        description = `buy ${buyAmount} ${buying} with ${selling} at ${price}`;
      }
      details = { selling, buying, buyAmount, price, offerId };
      break;
    }

    case 'create_passive_sell_offer': {
      const selling = formatAsset(data.selling);
      const buying = formatAsset(data.buying);
      const amount = formatAmount(data.amount);
      const price = formatPrice(data.price);
      description = `passive sell ${amount} ${selling} for ${buying} at ${price}`;
      details = { selling, buying, amount, price };
      break;
    }

    case 'set_options': {
      const options = [];

      if (data.inflation_dest || data.inflationDest) {
        options.push(`inflation dest: ${shortenAddress(data.inflation_dest || data.inflationDest)}`);
      }
      if (data.home_domain || data.homeDomain) {
        options.push(`home domain: "${data.home_domain || data.homeDomain}"`);
      }
      if (data.signer) {
        const signerKey = data.signer.key || data.signer.ed25519_public_key || '?';
        const weight = data.signer.weight;
        if (weight === 0) {
          options.push(`remove signer ${shortenAddress(signerKey)}`);
        } else {
          options.push(`add signer ${shortenAddress(signerKey)} (weight: ${weight})`);
        }
      }
      if (data.master_weight !== undefined || data.masterWeight !== undefined) {
        options.push(`master weight: ${data.master_weight ?? data.masterWeight}`);
      }
      if (data.low_threshold !== undefined || data.lowThreshold !== undefined) {
        options.push(`low threshold: ${data.low_threshold ?? data.lowThreshold}`);
      }
      if (data.med_threshold !== undefined || data.medThreshold !== undefined) {
        options.push(`med threshold: ${data.med_threshold ?? data.medThreshold}`);
      }
      if (data.high_threshold !== undefined || data.highThreshold !== undefined) {
        options.push(`high threshold: ${data.high_threshold ?? data.highThreshold}`);
      }
      if (data.set_flags !== undefined || data.setFlags !== undefined) {
        options.push(`set flags: ${data.set_flags ?? data.setFlags}`);
      }
      if (data.clear_flags !== undefined || data.clearFlags !== undefined) {
        options.push(`clear flags: ${data.clear_flags ?? data.clearFlags}`);
      }

      description = options.length > 0 ? `set options (${options.join(', ')})` : 'set options';
      details = { options: data };
      break;
    }

    case 'change_trust': {
      const asset = data.line || data.asset;
      const assetStr = formatAsset(asset);
      const limit = data.limit;

      // Handle liquidity pool assets
      if (asset && (asset.liquidity_pool || asset.liquidityPool || asset.pool_share)) {
        description = limit === '0' || limit === 0
          ? 'remove trust for liquidity pool'
          : 'trust liquidity pool';
      } else if (limit === '0' || limit === 0) {
        description = `remove trust ${assetStr}`;
      } else {
        description = `trust ${assetStr}`;
      }
      details = { asset: assetStr, limit };
      break;
    }

    case 'allow_trust': {
      const trustor = data.trustor || '?';
      const asset = data.asset_code || data.assetCode || data.asset || '?';
      const authorize = data.authorize;

      if (authorize === 0 || authorize === false) {
        description = `revoke authorization for ${shortenAddress(trustor)} on ${asset}`;
      } else {
        description = `authorize ${shortenAddress(trustor)} for ${asset}`;
      }
      details = { trustor, asset, authorize };
      break;
    }

    case 'account_merge': {
      // For account_merge, the destination is the body value itself
      const destination = typeof data === 'string' ? data : (data.destination || op.body.account_merge || op.body.accountMerge || '?');
      description = `merge account into ${shortenAddress(destination)}`;
      details = { destination };
      break;
    }

    case 'inflation': {
      description = 'run inflation';
      break;
    }

    case 'manage_data': {
      const name = data.data_name || data.dataName || data.name || '?';
      const value = data.data_value || data.dataValue || data.value;

      if (value === null || value === undefined) {
        description = `delete data "${name}"`;
      } else {
        description = `set data "${name}"`;
      }
      details = { name, hasValue: value !== null && value !== undefined };
      break;
    }

    case 'bump_sequence': {
      const bumpTo = data.bump_to || data.bumpTo || '?';
      description = `bump sequence to ${bumpTo}`;
      details = { bumpTo };
      break;
    }

    case 'create_claimable_balance': {
      const asset = formatAsset(data.asset);
      const amount = formatAmount(data.amount);
      const claimants = data.claimants || [];
      description = `create claimable balance of ${amount} ${asset} (${claimants.length} claimant${claimants.length !== 1 ? 's' : ''})`;
      details = { asset, amount, claimantCount: claimants.length };
      break;
    }

    case 'claim_claimable_balance': {
      const balanceId = data.balance_id || data.balanceId || '?';
      const shortId = typeof balanceId === 'string' && balanceId.length > 16
        ? `${balanceId.substring(0, 8)}...`
        : balanceId;
      description = `claim balance ${shortId}`;
      details = { balanceId };
      break;
    }

    case 'begin_sponsoring_future_reserves': {
      // The sponsored ID can be in data object or directly as the body value (string)
      let sponsoredId = data.sponsored_id || data.sponsoredId;
      if (!sponsoredId) {
        // Check if body value is a string directly
        const bodyValue = op.body.begin_sponsoring_future_reserves || op.body.beginSponsoringFutureReserves;
        if (typeof bodyValue === 'string') {
          sponsoredId = bodyValue;
        }
      }
      const addr = typeof sponsoredId === 'string' ? sponsoredId : '?';
      description = `begin sponsoring ${shortenAddress(addr)}`;
      details = { sponsoredId: addr };
      break;
    }

    case 'end_sponsoring_future_reserves': {
      description = 'end sponsoring';
      break;
    }

    case 'revoke_sponsorship': {
      // Revoke sponsorship can target different ledger entry types
      const ledgerKey = data.ledger_key || data.ledgerKey;
      const signer = data.signer;

      if (signer) {
        description = `revoke signer sponsorship`;
      } else if (ledgerKey) {
        const keyType = Object.keys(ledgerKey)[0] || 'entry';
        description = `revoke ${keyType} sponsorship`;
      } else {
        description = 'revoke sponsorship';
      }
      details = { ledgerKey, signer };
      break;
    }

    case 'clawback': {
      const from = data.from || '?';
      const asset = formatAsset(data.asset);
      const amount = formatAmount(data.amount);
      description = `clawback ${amount} ${asset} from ${shortenAddress(from)}`;
      details = { from, asset, amount };
      break;
    }

    case 'clawback_claimable_balance': {
      const balanceId = data.balance_id || data.balanceId || '?';
      const shortId = typeof balanceId === 'string' && balanceId.length > 16
        ? `${balanceId.substring(0, 8)}...`
        : balanceId;
      description = `clawback claimable balance ${shortId}`;
      details = { balanceId };
      break;
    }

    case 'set_trust_line_flags': {
      const trustor = data.trustor || '?';
      const asset = formatAsset(data.asset);
      description = `set trustline flags for ${shortenAddress(trustor)} on ${asset}`;
      details = { trustor, asset };
      break;
    }

    case 'liquidity_pool_deposit': {
      const maxAmountA = formatAmount(data.max_amount_a || data.maxAmountA);
      const maxAmountB = formatAmount(data.max_amount_b || data.maxAmountB);
      description = `deposit to liquidity pool (max ${maxAmountA} + ${maxAmountB})`;
      details = { maxAmountA, maxAmountB };
      break;
    }

    case 'liquidity_pool_withdraw': {
      const amount = formatAmount(data.amount);
      description = `withdraw ${amount} shares from liquidity pool`;
      details = { amount };
      break;
    }

    case 'invoke_host_function': {
      const hostFunction = data.host_function || data.hostFunction || data;

      // Determine the type of host function
      if (hostFunction.invoke_contract || hostFunction.invokeContract || hostFunction.InvokeContract) {
        const invoke = hostFunction.invoke_contract || hostFunction.invokeContract || hostFunction.InvokeContract;
        const contractId = invoke.contract_address || invoke.contractAddress || invoke.contract_id || '?';
        const functionName = invoke.function_name || invoke.functionName || invoke.function || '?';
        const contractAddr = typeof contractId === 'object' ? (contractId.contract_id || contractId.contractId || '?') : contractId;
        description = `invoke ${functionName}() on ${shortenAddress(contractAddr)}`;
        details = { contractId: contractAddr, functionName };
      } else if (hostFunction.upload_wasm || hostFunction.uploadWasm || hostFunction.UploadWasm) {
        description = 'upload wasm';
        details = { type: 'upload_wasm' };
      } else if (hostFunction.create_contract || hostFunction.createContract || hostFunction.CreateContract) {
        description = 'deploy contract';
        details = { type: 'create_contract' };
      } else {
        description = 'invoke host function';
        details = { hostFunction };
      }
      break;
    }

    case 'extend_footprint_ttl': {
      const extendTo = data.extend_to || data.extendTo || '?';
      description = `extend TTL by ${extendTo} ledgers`;
      details = { extendTo };
      break;
    }

    case 'restore_footprint': {
      description = 'restore archived entries';
      break;
    }

    default: {
      description = type.replace(/_/g, ' ');
      details = data;
    }
  }

  return {
    type,
    description,
    details,
    sourceAccount: sourceAccount || null,
    sourceAccountShort: sourceAccount ? shortenAddress(sourceAccount) : null,
  };
}

/**
 * Formats all operations from a decoded transaction envelope
 * @param {object} envelope - Decoded TransactionEnvelope
 * @returns {Array<object>} Array of formatted operations
 */
export function formatOperations(envelope) {
  if (!envelope) return [];

  // Handle different envelope types
  let operations = [];

  // v1 envelope (standard format from stellar-xdr-json)
  if (envelope.v1?.tx?.operations) {
    operations = envelope.v1.tx.operations;
  }
  // v0 envelope
  else if (envelope.v0?.tx?.operations) {
    operations = envelope.v0.tx.operations;
  }
  // fee bump envelope (tx_fee_bump from stellar-xdr-json)
  else if (envelope.tx_fee_bump?.tx?.inner_tx?.tx?.tx?.operations) {
    operations = envelope.tx_fee_bump.tx.inner_tx.tx.tx.operations;
  }
  // fee bump envelope (camelCase variant)
  else if (envelope.txFeeBump?.tx?.innerTx?.tx?.tx?.operations) {
    operations = envelope.txFeeBump.tx.innerTx.tx.tx.operations;
  }
  // fee bump envelope (fee_bump variant with v1)
  else if (envelope.fee_bump?.tx?.inner_tx?.v1?.tx?.operations) {
    operations = envelope.fee_bump.tx.inner_tx.v1.tx.operations;
  }
  else if (envelope.feeBump?.tx?.innerTx?.v1?.tx?.operations) {
    operations = envelope.feeBump.tx.innerTx.v1.tx.operations;
  }
  // fee bump envelope (fee_bump variant with tx.tx)
  else if (envelope.fee_bump?.tx?.inner_tx?.tx?.tx?.operations) {
    operations = envelope.fee_bump.tx.inner_tx.tx.tx.operations;
  }
  // Nested tx.tx format (from some XDR decoders)
  else if (envelope.tx?.tx?.operations) {
    operations = envelope.tx.tx.operations;
  }
  // Direct tx access (some decoders)
  else if (envelope.tx?.operations) {
    operations = envelope.tx.operations;
  }
  // Operations at root
  else if (Array.isArray(envelope.operations)) {
    operations = envelope.operations;
  }

  return operations.map((op, index) => ({
    index,
    ...formatOperation(op),
  }));
}
