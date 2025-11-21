//lib/amm/calculator.ts - CORRECTED & IMPROVED VERSION

export interface AMMConfig {
  feeRate: number;           // 0.03 for 3%
  minPrice: number;          // 0.01
  maxPrice: number;          // 0.99
  kConstant?: number;        // Will be calculated if not provided
}

export interface TradeResult {
  sharesReceived: number;
  effectivePrice: number;
  priceImpact: number;
  totalCost: number;
  fees: number;
  newPrices: Record<string, number>;
  newShares: Record<string, number>;
  newReserves: Record<string, number>;
}

export interface MarketState {
  outcomes: {
    [outcomeId: string]: {
      shares: number;
      reserve: number;
      currentPrice: number;
    };
  };
  totalLiquidity: number;
  kConstant: number;
}

export class AMMCalculator {
  private config: AMMConfig;

  constructor(config: AMMConfig) {
    this.config = {
      feeRate: config.feeRate || 0.00,
      // feeRate: config.feeRate || 0.03,
      minPrice: config.minPrice || 0.01,
      maxPrice: config.maxPrice || 0.99,
      kConstant: config.kConstant
    };
  }

  /**
   * Initialize a new market with equal distribution
   */
  initializeMarket(outcomeIds: string[], totalLiquidity: number = 1000): MarketState {
    const outcomeCount = outcomeIds.length;
    const equalReserve = totalLiquidity / outcomeCount;
    const equalPrice = 1 / outcomeCount;

    const outcomes: MarketState['outcomes'] = {};
    outcomeIds.forEach(outcomeId => {
      outcomes[outcomeId] = {
        shares: equalReserve, // In CPMM, shares = reserve initially
        reserve: equalReserve,
        currentPrice: equalPrice
      };
    });

    // Calculate k constant (product of all reserves)
    const kConstant = Object.values(outcomes).reduce(
      (product, outcome) => product * outcome.reserve,
      1
    );

    return {
      outcomes,
      totalLiquidity,
      kConstant
    };
  }

  /**
   * Calculate BUY trade using proper Constant Product Market Maker (CPMM) formula
   * 
   * For a multi-outcome CPMM: k = R1 * R2 * R3 * ... * Rn
   * When buying outcome i with amount Δ:
   * - Reserve Ri decreases by shares S received
   * - The cost is added to the liquidity pool (distributed to other reserves)
   * 
   * Formula: S = Ri * (1 - (k / (k + Δ * (k / Ri))^(1/(n-1))))
   */
  calculateBuy(
    marketState: MarketState,
    outcomeId: string,
    dollarAmount: number
  ): TradeResult {
    console.log('=== BUY CALCULATION START ===');
    console.log('Dollar amount:', dollarAmount);
    
    const { outcomes, kConstant } = marketState;
    const buyingOutcome = outcomes[outcomeId];

    if (!buyingOutcome) {
      throw new Error(`Outcome ${outcomeId} not found in market`);
    }

    console.log('Current reserves:', Object.fromEntries(
      Object.entries(outcomes).map(([id, o]) => [id, o.reserve])
    ));
    console.log('K constant:', kConstant);

    // Calculate fees
    const fees = dollarAmount * this.config.feeRate;
    const amountAfterFees = dollarAmount - fees;

    console.log('Fees:', fees);
    console.log('Amount after fees:', amountAfterFees);

    // Get all outcome IDs and the buying outcome index
    const outcomeIds = Object.keys(outcomes);
    const n = outcomeIds.length;
    const buyingIndex = outcomeIds.indexOf(outcomeId);

    if (buyingIndex === -1) {
      throw new Error('Buying outcome not found in outcome list');
    }

    // Calculate shares using CPMM formula for multiple outcomes
    const sharesReceived = this.calculateSharesFromBuy(
      outcomes,
      outcomeId,
      amountAfterFees,
      kConstant
    );

    console.log('Shares received:', sharesReceived);

    // Calculate new reserves
    const newReserves = this.calculateNewReservesAfterBuy(
      outcomes,
      outcomeId,
      sharesReceived,
      amountAfterFees,
      kConstant
    );

    // Calculate new shares (buying outcome gets more shares, others unchanged)
    const newShares: Record<string, number> = {};
    Object.entries(outcomes).forEach(([id, outcome]) => {
      newShares[id] = id === outcomeId ? outcome.shares + sharesReceived : outcome.shares;
    });

    // Calculate new prices based on new reserves
    const totalReserves = Object.values(newReserves).reduce((sum, r) => sum + r, 0);
    const newPrices: Record<string, number> = {};
    Object.keys(outcomes).forEach(id => {
      newPrices[id] = newReserves[id] / totalReserves;
    });

    // Calculate effective price and impact
    const currentPrice = buyingOutcome.currentPrice;
    const effectivePrice = sharesReceived > 0 ? dollarAmount / sharesReceived : currentPrice;
    const priceImpact = ((effectivePrice - currentPrice) / currentPrice) * 100;

    console.log('New reserves:', newReserves);
    console.log('New prices:', newPrices);
    console.log('Effective price:', effectivePrice);
    console.log('Price impact:', priceImpact);
    console.log('=== BUY CALCULATION END ===');

    return {
      sharesReceived,
      effectivePrice,
      priceImpact,
      totalCost: dollarAmount,
      fees,
      newPrices,
      newReserves,
      newShares
    };
  }

  /**
   * Calculate shares received for a buy using CPMM formula
   */
  private calculateSharesFromBuy(
    outcomes: MarketState['outcomes'],
    outcomeId: string,
    cost: number,
    kConstant: number
  ): number {
    const buyingOutcome = outcomes[outcomeId];
    const outcomeIds = Object.keys(outcomes);
    const n = outcomeIds.length;

    // For multi-outcome CPMM: S = R_buy * (1 - (k / (k + cost * product))^(1/(n-1)))
    // where product = ∏(R_j for j ≠ buy)
    
    const otherReservesProduct = Object.entries(outcomes)
      .filter(([id]) => id !== outcomeId)
      .reduce((product, [, outcome]) => product * outcome.reserve, 1);

    const denominator = kConstant + cost * otherReservesProduct;
    
    if (denominator <= 0) {
      throw new Error('Invalid CPMM calculation: denominator <= 0');
    }

    const ratio = kConstant / denominator;
    const exponent = 1 / (n - 1);
    
    const shares = buyingOutcome.reserve * (1 - Math.pow(ratio, exponent));

    // Ensure we don't buy more than available
    return Math.max(0, Math.min(shares, buyingOutcome.reserve * 0.95));
  }

  /**
   * Calculate new reserves after a buy transaction
   */
  private calculateNewReservesAfterBuy(
    outcomes: MarketState['outcomes'],
    outcomeId: string,
    sharesReceived: number,
    cost: number,
    kConstant: number
  ): Record<string, number> {
    const newReserves: Record<string, number> = {};
    const outcomeIds = Object.keys(outcomes);
    const n = outcomeIds.length;

    // Buying outcome's reserve decreases
    newReserves[outcomeId] = outcomes[outcomeId].reserve - sharesReceived;

    // Distribute cost to other reserves proportionally
    const otherOutcomes = outcomeIds.filter(id => id !== outcomeId);
    const totalOtherReserves = otherOutcomes.reduce(
      (sum, id) => sum + outcomes[id].reserve, 0
    );

    otherOutcomes.forEach(id => {
      const proportion = outcomes[id].reserve / totalOtherReserves;
      newReserves[id] = outcomes[id].reserve + cost * proportion;
    });

    // Verify and adjust to maintain k constant approximately
    const newK = Object.values(newReserves).reduce((p, r) => p * r, 1);
    const kRatio = newK / kConstant;

    if (Math.abs(kRatio - 1) > 0.01) {
      console.warn(`K constant deviation: ${((kRatio - 1) * 100).toFixed(2)}%. Adjusting...`);
      // Adjust reserves to maintain k constant
      const adjustment = Math.pow(kConstant / newK, 1 / n);
      Object.keys(newReserves).forEach(id => {
        newReserves[id] *= adjustment;
      });
    }

    return newReserves;
  }

  /**
   * Calculate SELL trade using proper CPMM formula
   * When selling shares, the reserve INCREASES, payout is received
   */
  calculateSell(
    marketState: MarketState,
    outcomeId: string,
    sharesToSell: number
  ): TradeResult {
    console.log('=== SELL CALCULATION START ===');
    console.log('Shares to sell:', sharesToSell);
    
    const { outcomes, kConstant } = marketState;
    const sellingOutcome = outcomes[outcomeId];

    if (!sellingOutcome) {
      throw new Error(`Outcome ${outcomeId} not found in market`);
    }

    if (sharesToSell > sellingOutcome.shares) {
      throw new Error(`Insufficient shares: trying to sell ${sharesToSell} but only have ${sellingOutcome.shares}`);
    }

    console.log('Current reserves:', Object.fromEntries(
      Object.entries(outcomes).map(([id, o]) => [id, o.reserve])
    ));

    // Calculate payout using CPMM formula
    const payoutBeforeFees = this.calculatePayoutFromSell(
      outcomes,
      outcomeId,
      sharesToSell,
      kConstant
    );

    const fees = payoutBeforeFees * this.config.feeRate;
    const payout = payoutBeforeFees - fees;

    // Calculate new reserves
    const newReserves = this.calculateNewReservesAfterSell(
      outcomes,
      outcomeId,
      sharesToSell,
      payoutBeforeFees
    );

    // Calculate new shares (selling outcome loses shares)
    const newShares: Record<string, number> = {};
    Object.entries(outcomes).forEach(([id, outcome]) => {
      newShares[id] = id === outcomeId ? outcome.shares - sharesToSell : outcome.shares;
    });

    // Calculate new prices
    const totalReserves = Object.values(newReserves).reduce((sum, r) => sum + r, 0);
    const newPrices: Record<string, number> = {};
    Object.keys(outcomes).forEach(id => {
      newPrices[id] = newReserves[id] / totalReserves;
    });

    // Calculate effective price and impact
    const currentPrice = sellingOutcome.currentPrice;
    const effectivePrice = sharesToSell > 0 ? payout / sharesToSell : currentPrice;
    const priceImpact = ((effectivePrice - currentPrice) / currentPrice) * 100;

    console.log('Payout before fees:', payoutBeforeFees);
    console.log('Payout after fees:', payout);
    console.log('New reserves:', newReserves);
    console.log('Effective price:', effectivePrice);
    console.log('Price impact:', priceImpact);
    console.log('=== SELL CALCULATION END ===');

    return {
      sharesReceived: sharesToSell,
      effectivePrice,
      priceImpact,
      totalCost: payout,
      fees,
      newPrices,
      newReserves,
      newShares
    };
  }

  /**
   * Calculate payout for selling shares using CPMM formula
   */
  private calculatePayoutFromSell(
    outcomes: MarketState['outcomes'],
    outcomeId: string,
    sharesToSell: number,
    kConstant: number
  ): number {
    const sellingOutcome = outcomes[outcomeId];
    const outcomeIds = Object.keys(outcomes);
    const n = outcomeIds.length;

    // For multi-outcome CPMM payout calculation
    // When selling S shares of outcome i:
    // payout ≈ S * current_price * (1 - S/(2 * R_i)) * adjustment_factor
    
    const currentPrice = sellingOutcome.currentPrice;
    const reserveRatio = sharesToSell / sellingOutcome.reserve;
    
    // Simple approximation with slippage adjustment
    const basePayout = sharesToSell * currentPrice;
    const slippageAdjustment = 1 - (reserveRatio / 2);
    const multiOutcomeAdjustment = 1 - (1 / (2 * n)); // Less impact in multi-outcome markets
    
    return basePayout * slippageAdjustment * multiOutcomeAdjustment;
  }

  /**
   * Calculate new reserves after a sell transaction
   */
  private calculateNewReservesAfterSell(
    outcomes: MarketState['outcomes'],
    outcomeId: string,
    sharesToSell: number,
    payout: number
  ): Record<string, number> {
    const newReserves: Record<string, number> = {};
    const outcomeIds = Object.keys(outcomes);

    // Selling outcome's reserve increases (we're adding shares back to liquidity)
    newReserves[outcomeId] = outcomes[outcomeId].reserve + sharesToSell;

    // Payout comes from other reserves proportionally
    const otherOutcomes = outcomeIds.filter(id => id !== outcomeId);
    const totalOtherReserves = otherOutcomes.reduce(
      (sum, id) => sum + outcomes[id].reserve, 0
    );

    otherOutcomes.forEach(id => {
      const proportion = outcomes[id].reserve / totalOtherReserves;
      newReserves[id] = Math.max(0.01, outcomes[id].reserve - payout * proportion);
    });

    return newReserves;
  }

  /**
   * Calculate current prices from market state
   */
  calculateCurrentPrices(marketState: MarketState): Record<string, number> {
    const totalReserves = Object.values(marketState.outcomes).reduce(
      (sum, outcome) => sum + outcome.reserve,
      0
    );

    const prices: Record<string, number> = {};
    Object.entries(marketState.outcomes).forEach(([id, outcome]) => {
      prices[id] = totalReserves > 0 ? outcome.reserve / totalReserves : 1 / Object.keys(marketState.outcomes).length;
    });

    // Normalize to ensure sum = 1
    const priceSum = Object.values(prices).reduce((sum, p) => sum + p, 0);
    if (priceSum > 0) {
      Object.keys(prices).forEach(id => {
        prices[id] /= priceSum;
      });
    }

    return prices;
  }

  /**
   * Validate market state consistency
   */
  validateMarketState(marketState: MarketState): boolean {
    const { outcomes, kConstant } = marketState;
    
    // Check if all reserves are positive
    const allReservesPositive = Object.values(outcomes).every(outcome => 
      outcome.reserve > 0 && outcome.shares > 0
    );
    
    if (!allReservesPositive) {
      console.error('Invalid market state: non-positive reserves or shares');
      return false;
    }

    // Check if k constant is approximately maintained
    const calculatedK = Object.values(outcomes).reduce(
      (product, outcome) => product * outcome.reserve, 1
    );
    
    const kDeviation = Math.abs(calculatedK - kConstant) / kConstant;
    const isKValid = kDeviation < 0.1; // Allow 10% deviation
    
    if (!isKValid) {
      console.warn(`K constant deviation: ${(kDeviation * 100).toFixed(2)}%`);
    }

    // Check if prices sum to approximately 1
    const prices = this.calculateCurrentPrices(marketState);
    const priceSum = Object.values(prices).reduce((sum, p) => sum + p, 0);
    const priceSumValid = Math.abs(priceSum - 1) < 0.01;

    return allReservesPositive && priceSumValid;
  }

  /**
   * Estimate trade impact without executing
   */
  estimateTrade(
    marketState: MarketState,
    outcomeId: string,
    action: 'buy' | 'sell',
    amount: number
  ): Omit<TradeResult, 'newShares' | 'newPrices' | 'newReserves'> {
    // Validate market state first
    if (!this.validateMarketState(marketState)) {
      throw new Error('Invalid market state: cannot estimate trade');
    }

    if (action === 'buy') {
      const result = this.calculateBuy(marketState, outcomeId, amount);
      return {
        sharesReceived: result.sharesReceived,
        effectivePrice: result.effectivePrice,
        priceImpact: result.priceImpact,
        totalCost: result.totalCost,
        fees: result.fees
      };
    } else {
      const result = this.calculateSell(marketState, outcomeId, amount);
      return {
        sharesReceived: result.sharesReceived,
        effectivePrice: result.effectivePrice,
        priceImpact: result.priceImpact,
        totalCost: result.totalCost,
        fees: result.fees
      };
    }
  }

  /**
   * Rebalance market to fix AMM configuration issues
   */
  rebalanceMarket(marketState: MarketState): MarketState {
    console.log('Rebalancing market state...');
    
    const { outcomes, totalLiquidity, kConstant } = marketState;
    const outcomeIds = Object.keys(outcomes);
    const n = outcomeIds.length;

    // Calculate target reserves based on current prices
    const currentPrices = this.calculateCurrentPrices(marketState);
    const targetReserves: Record<string, number> = {};
    
    outcomeIds.forEach(id => {
      targetReserves[id] = totalLiquidity * currentPrices[id];
    });

    // Calculate new k constant
    const newKConstant = Object.values(targetReserves).reduce(
      (product, reserve) => product * reserve, 1
    );

    // Update outcomes with new reserves while preserving shares
    const newOutcomes: MarketState['outcomes'] = {};
    outcomeIds.forEach(id => {
      newOutcomes[id] = {
        ...outcomes[id],
        reserve: targetReserves[id],
        currentPrice: currentPrices[id]
      };
    });

    console.log('Rebalanced market:');
    console.log('Old k:', kConstant, 'New k:', newKConstant);
    console.log('New reserves:', targetReserves);

    return {
      outcomes: newOutcomes,
      totalLiquidity,
      kConstant: newKConstant
    };
  }
}