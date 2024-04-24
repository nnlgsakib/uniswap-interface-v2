import { InterfacePageName, SwapEventName } from '@uniswap/analytics-events'
import { ChainId, Currency, CurrencyAmount, Percent, Token } from 'dist'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk'
import { useWeb3React } from '@web3-react/core'
import { sendAnalyticsEvent, Trace, useTrace } from 'analytics'
import { useToggleAccountDrawer } from 'components/AccountDrawer'
import AssetItem, { assets } from 'components/AssetItems'
import { NetworkAlert } from 'components/NetworkAlert/NetworkAlert'
import SearchInputComponent from 'components/SearchInput'
import confirmPriceImpactWithoutFee from 'components/swap/confirmPriceImpactWithoutFee'
import ConfirmSwapModal from 'components/swap/ConfirmSwapModal'
import PriceImpactModal from 'components/swap/PriceImpactModal'
import { PageWrapper, SwapWrapperMulti } from 'components/swap/styled'
import SwapHeader from 'components/swap/SwapHeader'
import { SwitchLocaleLink } from 'components/SwitchLocaleLink'
import TokenSafetyModal from 'components/TokenSafety/TokenSafetyModal'
import { asSupportedChain, isSupportedChain } from 'constants/chains'
import { getSwapCurrencyId, TOKEN_SHORTHANDS } from 'constants/tokens'
import { useCurrency, useDefaultActiveTokens } from 'hooks/Tokens'
import { useIsSwapUnsupported } from 'hooks/useIsSwapUnsupported'
import { useMaxAmountIn } from 'hooks/useMaxAmountIn'
import usePermit2Allowance, { AllowanceState } from 'hooks/usePermit2Allowance'
import usePrevious from 'hooks/usePrevious'
import { SwapResult, useSwapCallback } from 'hooks/useSwapCallback'
import { useSwitchChain } from 'hooks/useSwitchChain'
import { useUSDPrice } from 'hooks/useUSDPrice'
import useWrapCallback, { WrapType } from 'hooks/useWrapCallback'
import JSBI from 'jsbi'
import { formatSwapQuoteReceivedEventProperties } from 'lib/utils/analytics'
import { ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppSelector } from 'state/hooks'
import { InterfaceTrade, TradeState } from 'state/routing/types'
import { isClassicTrade, isUniswapXTrade } from 'state/routing/utils'
import { Field, replaceSwapState } from 'state/swap/actions'
import { useDefaultsFromURLSearch, useDerivedSwapInfo, useSwapActionHandlers } from 'state/swap/hooks'
import swapReducer, { initialState as initialSwapState, SwapState } from 'state/swap/reducer'
import styled, { useTheme } from 'styled-components'
import { maybeLogFirstSwapAction } from 'tracing/swapFlowLoggers'
import { computeFiatValuePriceImpact } from 'utils/computeFiatValuePriceImpact'
import { formatCurrencyAmount, NumberType } from 'utils/formatNumbers'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { computeRealizedPriceImpact, warningSeverity } from 'utils/prices'
import { didUserReject } from 'utils/swapErrorToUserReadableMessage'

import arrow from '../../assets/images/arrow3.png'
import drp from '../../assets/images/dropdown.svg'
import eth from '../../assets/images/ethereum-logo.png'
import bnb from '../../assets/svg/bnb-logo.svg'
import polygon from '../../assets/svg/polygon-matic-logo.svg'
import { useScreenSize } from '../../hooks/useScreenSize'
import { useIsDarkMode } from '../../theme/components/ThemeToggle'
import CurrencyModal from './Modal'
// import { UniswapXOptIn } from './UniswapXOptIn'

const ArrowContainer = styled.div`
  position: absolute;
  top: 57%;
  transform: translateY(-50%);
  right: 12.3rem;

  @media (max-width: 768px) {
    right: 12.5rem;
  }

  @media (max-width: 480px) {
    right: 10.5rem;
  }
`

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const LeftContainer = styled.div`
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  position: relative;
`

const InputBackground = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  background-color: #f9f9f9;
  height: 7rem;
  border-radius: 0.5rem;
  padding: 1rem;
`
const InputMainBackground = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  background-color: #ccc;
  height: 7rem;
  border-radius: 0.5rem;
  padding: 1rem;
  position: relative;
`

const AssetToggle = styled.div`
  position: absolute;
  top: 0.5rem;
`
const AssetToggleTwo = styled.div`
  position: absolute;
  top: 1rem;
`

const AssetToggleThree = styled.div`
  position: absolute;
  bottom: 5rem;
`

const ButtonToggle = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
`
const InputContainer = styled.div`
  display: flex;
  align-items: baseline;
`

const AssetContainer = styled.div`
  display: flex;
  align-items: center;
  background: #5a5a5a;
  height: 2rem;
  border-radius: 0.5rem;
`

const Input = styled.input`
  width: 100%;
  outline: none;
  padding: 0.5rem;
  border: none;
  background: transparent;
  font-size: 1.5rem;
  color: #989898;
`
const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
`

const PercentSign = styled.div`
  margin-left: 0.5rem;
  background: #989898;
  font-size: 1.5rem;
  border-radius: 0.5rem;
  color: #000;
`

const RightContainer = styled.div`
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  position: relative;
`

const SwapSection = styled.div`
  background-color: ${({ theme }) => theme.surface2};
  border-radius: 16px;
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
  font-weight: 500;
  height: 120px;
  line-height: 20px;
  padding: 16px;
  position: relative;

  &:before {
    box-sizing: border-box;
    background-size: 100%;
    border-radius: inherit;

    position: absolute;
    top: 0;
    left: 0;

    width: 100%;
    height: 100%;
    pointer-events: none;
    content: '';
    border: 1px solid ${({ theme }) => theme.surface2};
  }

  &:hover:before {
    border-color: ${({ theme }) => theme.deprecated_stateOverlayHover};
  }

  &:focus-within:before {
    border-color: ${({ theme }) => theme.deprecated_stateOverlayPressed};
  }
`

const OutputSwapSection = styled(SwapSection)`
  border-bottom: ${({ theme }) => `1px solid ${theme.surface1}`};
`

function getIsValidSwapQuote(
  trade: InterfaceTrade | undefined,
  tradeState: TradeState,
  swapInputError?: ReactNode
): boolean {
  return Boolean(!swapInputError && trade && tradeState === TradeState.VALID)
}

function largerPercentValue(a?: Percent, b?: Percent) {
  if (a && b) {
    return a.greaterThan(b) ? a : b
  } else if (a) {
    return a
  } else if (b) {
    return b
  }
  return undefined
}

export default function MultiSwapPage({ className }: { className?: string }) {
  const { chainId: connectedChainId } = useWeb3React()
  const loadedUrlParams = useDefaultsFromURLSearch()

  const location = useLocation()

  const supportedChainId = asSupportedChain(connectedChainId)

  return (
    <Trace page={InterfacePageName.SWAP_PAGE} shouldLogImpression>
      <PageWrapper>
        <Swap
          className={className}
          chainId={supportedChainId ?? ChainId.MAINNET}
          prefilledState={{
            [Field.INPUT]: {
              currencyId: loadedUrlParams?.[Field.INPUT]?.currencyId,
            },
            [Field.OUTPUT]: {
              currencyId: loadedUrlParams?.[Field.OUTPUT]?.currencyId,
            },
          }}
          disableTokenInputs={supportedChainId === undefined}
        />
        <NetworkAlert />
      </PageWrapper>
      {location.pathname === '/swap' && <SwitchLocaleLink />}
    </Trace>
  )
}

/**
 * The swap component displays the swap interface, manages state for the swap, and triggers onchain swaps.
 *
 * In most cases, chainId should refer to the connected chain, i.e. `useWeb3React().chainId`.
 * However if this component is being used in a context that displays information from a different, unconnected
 * chain (e.g. the TDP), then chainId should refer to the unconnected chain.
 */
function Swap({
  className,
  prefilledState = {},
  chainId,
  onCurrencyChange,
  disableTokenInputs = false,
}: {
  className?: string
  prefilledState?: Partial<SwapState>
  chainId?: ChainId
  onCurrencyChange?: (selected: Pick<SwapState, Field.INPUT | Field.OUTPUT>) => void
  disableTokenInputs?: boolean
}) {
  const { account, chainId: connectedChainId, connector } = useWeb3React()
  const trace = useTrace()

  // token warning stuff
  const prefilledInputCurrency = useCurrency(prefilledState?.[Field.INPUT]?.currencyId)
  const prefilledOutputCurrency = useCurrency(prefilledState?.[Field.OUTPUT]?.currencyId)

  const [loadedInputCurrency, setLoadedInputCurrency] = useState(prefilledInputCurrency)
  const [loadedOutputCurrency, setLoadedOutputCurrency] = useState(prefilledOutputCurrency)

  useEffect(() => {
    setLoadedInputCurrency(prefilledInputCurrency)
    setLoadedOutputCurrency(prefilledOutputCurrency)
  }, [prefilledInputCurrency, prefilledOutputCurrency])

  const [dismissTokenWarning, setDismissTokenWarning] = useState<boolean>(false)
  const [showPriceImpactModal, setShowPriceImpactModal] = useState<boolean>(false)

  const urlLoadedTokens: Token[] = useMemo(
    () => [loadedInputCurrency, loadedOutputCurrency]?.filter((c): c is Token => c?.isToken ?? false) ?? [],
    [loadedInputCurrency, loadedOutputCurrency]
  )
  const handleConfirmTokenWarning = useCallback(() => {
    setDismissTokenWarning(true)
  }, [])

  // dismiss warning if all imported tokens are in active lists
  const defaultTokens = useDefaultActiveTokens(chainId)
  const importTokensNotInDefault = useMemo(
    () =>
      urlLoadedTokens &&
      urlLoadedTokens
        .filter((token: Token) => {
          return !(token.address in defaultTokens)
        })
        .filter((token: Token) => {
          // Any token addresses that are loaded from the shorthands map do not need to show the import URL
          const supported = asSupportedChain(chainId)
          if (!supported) return true
          return !Object.keys(TOKEN_SHORTHANDS).some((shorthand) => {
            const shorthandTokenAddress = TOKEN_SHORTHANDS[shorthand][supported]
            return shorthandTokenAddress && shorthandTokenAddress === token.address
          })
        }),
    [chainId, defaultTokens, urlLoadedTokens]
  )

  const theme = useTheme()

  // toggle wallet when disconnected
  const toggleWalletDrawer = useToggleAccountDrawer()

  // swap state
  const [state, dispatch] = useReducer(swapReducer, {
    ...initialSwapState,
    ...prefilledState,
  })
  const { typedValue, recipient, independentField } = state

  const previousConnectedChainId = usePrevious(connectedChainId)
  const previousPrefilledState = usePrevious(prefilledState)
  useEffect(() => {
    const combinedInitialState = { ...initialSwapState, ...prefilledState }
    const chainChanged = previousConnectedChainId && previousConnectedChainId !== connectedChainId
    const prefilledInputChanged =
      previousPrefilledState &&
      previousPrefilledState?.[Field.INPUT]?.currencyId !== prefilledState?.[Field.INPUT]?.currencyId
    const prefilledOutputChanged =
      previousPrefilledState &&
      previousPrefilledState?.[Field.OUTPUT]?.currencyId !== prefilledState?.[Field.OUTPUT]?.currencyId
    if (chainChanged || prefilledInputChanged || prefilledOutputChanged) {
      dispatch(
        replaceSwapState({
          ...initialSwapState,
          ...prefilledState,
          field: combinedInitialState.independentField ?? Field.INPUT,
          inputCurrencyId: combinedInitialState.INPUT.currencyId ?? undefined,
          outputCurrencyId: combinedInitialState.OUTPUT.currencyId ?? undefined,
        })
      )
      // reset local state
      setSwapState({
        tradeToConfirm: undefined,
        swapError: undefined,
        showConfirm: false,
        swapResult: undefined,
      })
    }
  }, [connectedChainId, prefilledState, previousConnectedChainId, previousPrefilledState])

  const swapInfo = useDerivedSwapInfo(state, chainId)
  const {
    trade: { state: tradeState, trade, swapQuoteLatency },
    allowedSlippage,
    autoSlippage,
    currencyBalances,
    parsedAmount,
    currencies,
    inputError: swapInputError,
  } = swapInfo

  const {
    wrapType,
    execute: onWrap,
    inputError: wrapInputError,
  } = useWrapCallback(currencies[Field.INPUT], currencies[Field.OUTPUT], typedValue)
  const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE

  const parsedAmounts = useMemo(
    () =>
      showWrap
        ? {
            [Field.INPUT]: parsedAmount,
            [Field.OUTPUT]: parsedAmount,
          }
        : {
            [Field.INPUT]: independentField === Field.INPUT ? parsedAmount : trade?.inputAmount,
            [Field.OUTPUT]: independentField === Field.OUTPUT ? parsedAmount : trade?.postTaxOutputAmount,
          },
    [independentField, parsedAmount, showWrap, trade]
  )

  const fiatValueInput = useUSDPrice(parsedAmounts[Field.INPUT], currencies[Field.INPUT] ?? undefined)
  const fiatValueOutput = useUSDPrice(parsedAmounts[Field.OUTPUT], currencies[Field.OUTPUT] ?? undefined)
  const showFiatValueInput = Boolean(parsedAmounts[Field.INPUT])
  const showFiatValueOutput = Boolean(parsedAmounts[Field.OUTPUT])

  const [routeNotFound, routeIsLoading, routeIsSyncing] = useMemo(
    () => [
      tradeState === TradeState.NO_ROUTE_FOUND,
      tradeState === TradeState.LOADING,
      tradeState === TradeState.LOADING && Boolean(trade),
    ],
    [trade, tradeState]
  )

  const fiatValueTradeInput = useUSDPrice(trade?.inputAmount)
  const fiatValueTradeOutput = useUSDPrice(trade?.postTaxOutputAmount)
  const preTaxFiatValueTradeOutput = useUSDPrice(trade?.outputAmount)
  const [stablecoinPriceImpact, preTaxStablecoinPriceImpact] = useMemo(
    () =>
      routeIsSyncing || !isClassicTrade(trade)
        ? [undefined, undefined]
        : [
            computeFiatValuePriceImpact(fiatValueTradeInput.data, fiatValueTradeOutput.data),
            computeFiatValuePriceImpact(fiatValueTradeInput.data, preTaxFiatValueTradeOutput.data),
          ],
    [fiatValueTradeInput, fiatValueTradeOutput, preTaxFiatValueTradeOutput, routeIsSyncing, trade]
  )

  const { onSwitchTokens, onCurrencySelection, onUserInput, onChangeRecipient } = useSwapActionHandlers(dispatch)
  const dependentField: Field = independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT

  const handleTypeInput = useCallback(
    (value: string) => {
      onUserInput(Field.INPUT, value)
      maybeLogFirstSwapAction(trace)
    },
    [onUserInput, trace]
  )
  const handleTypeOutput = useCallback(
    (value: string) => {
      onUserInput(Field.OUTPUT, value)
      maybeLogFirstSwapAction(trace)
    },
    [onUserInput, trace]
  )

  const navigate = useNavigate()
  const swapIsUnsupported = useIsSwapUnsupported(currencies[Field.INPUT], currencies[Field.OUTPUT])

  // reset if they close warning without tokens in params
  const handleDismissTokenWarning = useCallback(() => {
    setDismissTokenWarning(true)
    navigate('/swap/')
  }, [navigate])

  // modal and loading
  const [{ showConfirm, tradeToConfirm, swapError, swapResult }, setSwapState] = useState<{
    showConfirm: boolean
    tradeToConfirm?: InterfaceTrade
    swapError?: Error
    swapResult?: SwapResult
  }>({
    showConfirm: false,
    tradeToConfirm: undefined,
    swapError: undefined,
    swapResult: undefined,
  })

  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: showWrap
        ? parsedAmounts[independentField]?.toExact() ?? ''
        : formatCurrencyAmount(parsedAmounts[dependentField], NumberType.SwapTradeAmount, ''),
    }),
    [dependentField, independentField, parsedAmounts, showWrap, typedValue]
  )

  const userHasSpecifiedInputOutput = Boolean(
    currencies[Field.INPUT] && currencies[Field.OUTPUT] && parsedAmounts[independentField]?.greaterThan(JSBI.BigInt(0))
  )

  const maximumAmountIn = useMaxAmountIn(trade, allowedSlippage)
  const allowance = usePermit2Allowance(
    maximumAmountIn ??
      (parsedAmounts[Field.INPUT]?.currency.isToken
        ? (parsedAmounts[Field.INPUT] as CurrencyAmount<Token>)
        : undefined),
    isSupportedChain(chainId) ? UNIVERSAL_ROUTER_ADDRESS(chainId) : undefined,
    trade?.fillType
  )

  const maxInputAmount: CurrencyAmount<Currency> | undefined = useMemo(
    () => maxAmountSpend(currencyBalances[Field.INPUT]),
    [currencyBalances]
  )
  const showMaxButton = Boolean(maxInputAmount?.greaterThan(0) && !parsedAmounts[Field.INPUT]?.equalTo(maxInputAmount))
  const swapFiatValues = useMemo(() => {
    return {
      amountIn: fiatValueTradeInput.data,
      amountOut: fiatValueTradeOutput.data,
    }
  }, [fiatValueTradeInput, fiatValueTradeOutput])

  // the callback to execute the swap
  const swapCallback = useSwapCallback(
    trade,
    swapFiatValues,
    allowedSlippage,
    allowance.state === AllowanceState.ALLOWED ? allowance.permitSignature : undefined
  )

  const handleContinueToReview = useCallback(() => {
    setSwapState({
      tradeToConfirm: trade,
      swapError: undefined,
      showConfirm: true,
      swapResult: undefined,
    })
  }, [trade])

  const handleSwap = useCallback(() => {
    if (!swapCallback) {
      return
    }
    if (preTaxStablecoinPriceImpact && !confirmPriceImpactWithoutFee(preTaxStablecoinPriceImpact)) {
      return
    }
    setSwapState((currentState) => ({
      ...currentState,
      swapError: undefined,
      swapResult: undefined,
    }))
    swapCallback()
      .then((result) => {
        setSwapState((currentState) => ({
          ...currentState,
          swapError: undefined,
          swapResult: result,
        }))
      })
      .catch((error) => {
        setSwapState((currentState) => ({
          ...currentState,
          swapError: error,
          swapResult: undefined,
        }))
      })
  }, [swapCallback, preTaxStablecoinPriceImpact])

  const handleOnWrap = useCallback(async () => {
    if (!onWrap) return
    try {
      const txHash = await onWrap()
      setSwapState((currentState) => ({
        ...currentState,
        swapError: undefined,
        txHash,
      }))
      onUserInput(Field.INPUT, '')
    } catch (error) {
      if (!didUserReject(error)) {
        sendAnalyticsEvent(SwapEventName.SWAP_ERROR, {
          wrapType,
          input: currencies[Field.INPUT],
          output: currencies[Field.OUTPUT],
        })
      }
      console.error('Could not wrap/unwrap', error)
      setSwapState((currentState) => ({
        ...currentState,
        swapError: error,
        txHash: undefined,
      }))
    }
  }, [currencies, onUserInput, onWrap, wrapType])

  // warnings on the greater of fiat value price impact and execution price impact
  const { priceImpactSeverity, largerPriceImpact } = useMemo(() => {
    if (isUniswapXTrade(trade)) {
      return { priceImpactSeverity: 0, largerPriceImpact: undefined }
    }

    const marketPriceImpact = trade?.priceImpact ? computeRealizedPriceImpact(trade) : undefined
    const largerPriceImpact = largerPercentValue(marketPriceImpact, preTaxStablecoinPriceImpact)
    return {
      priceImpactSeverity: warningSeverity(largerPriceImpact),
      largerPriceImpact,
    }
  }, [preTaxStablecoinPriceImpact, trade])

  const handleConfirmDismiss = useCallback(() => {
    setSwapState((currentState) => ({ ...currentState, showConfirm: false }))
    // If there was a swap, we want to clear the input
    if (swapResult) {
      onUserInput(Field.INPUT, '')
    }
  }, [onUserInput, swapResult])

  const handleAcceptChanges = useCallback(() => {
    setSwapState((currentState) => ({
      ...currentState,
      tradeToConfirm: trade,
    }))
  }, [trade])

  const handleInputSelect = useCallback(
    (inputCurrency: Currency) => {
      onCurrencySelection(Field.INPUT, inputCurrency)
      onCurrencyChange?.({
        [Field.INPUT]: {
          currencyId: getSwapCurrencyId(inputCurrency),
        },
        [Field.OUTPUT]: state[Field.OUTPUT],
      })
      maybeLogFirstSwapAction(trace)
    },
    [onCurrencyChange, onCurrencySelection, state, trace]
  )

  const handleMaxInput = useCallback(() => {
    maxInputAmount && onUserInput(Field.INPUT, maxInputAmount.toExact())
    maybeLogFirstSwapAction(trace)
  }, [maxInputAmount, onUserInput, trace])

  const handleOutputSelect = useCallback(
    (outputCurrency: Currency) => {
      onCurrencySelection(Field.OUTPUT, outputCurrency)
      onCurrencyChange?.({
        [Field.INPUT]: state[Field.INPUT],
        [Field.OUTPUT]: {
          currencyId: getSwapCurrencyId(outputCurrency),
        },
      })
      maybeLogFirstSwapAction(trace)
    },
    [onCurrencyChange, onCurrencySelection, state, trace]
  )

  const showPriceImpactWarning = isClassicTrade(trade) && largerPriceImpact && priceImpactSeverity > 3

  const prevTrade = usePrevious(trade)
  useEffect(() => {
    if (!trade || prevTrade === trade) return // no new swap quote to log

    sendAnalyticsEvent(SwapEventName.SWAP_QUOTE_RECEIVED, {
      ...formatSwapQuoteReceivedEventProperties(trade, allowedSlippage, swapQuoteLatency),
      ...trace,
    })
  }, [prevTrade, trade, trace, allowedSlippage, swapQuoteLatency])

  const showDetailsDropdown = Boolean(
    !showWrap && userHasSpecifiedInputOutput && (trade || routeIsLoading || routeIsSyncing)
  )

  const inputCurrency = currencies[Field.INPUT] ?? undefined
  const switchChain = useSwitchChain()
  const switchingChain = useAppSelector((state) => state.wallets.switchingChain)
  const showOptInSmall = !useScreenSize().navSearchInputVisible
  const isDark = useIsDarkMode()

  const [isModalOpenOne, setIsModalOpenOne] = useState(false)
  const [isModalOpenTwo, setIsModalOpenTwo] = useState(false)
  const [isModalOpenThree, setIsModalOpenThree] = useState(false)

  const toggleModalOne = () => {
    setIsModalOpenOne(!isModalOpenOne)
  }

  const toggleModalTwo = () => {
    setIsModalOpenTwo(!isModalOpenTwo)
  }

  const toggleModalThree = () => {
    setIsModalOpenThree(!isModalOpenThree)
  }

  const [selectedAsset, setSelectedAsset] = useState({
    logoSrc: eth,
    name: 'Ether',
    symbol: 'ETH',
  })
  const [selectedAssetTwo, setSelectedAssetTwo] = useState({
    logoSrc: polygon,
    name: 'Polygon',
    symbol: 'Matic',
  })
  const [selectedAssetThree, setSelectedAssetThree] = useState({
    logoSrc: bnb,
    name: 'BNB',
    symbol: 'BNB',
  })
  const handleAssetSelection = (asset: any) => {
    setSelectedAsset(asset)
    toggleModalOne() // Close the modal after asset selection if needed
  }

  const handleAssetSelectionTwo = (asset: any) => {
    setSelectedAssetTwo(asset)
    toggleModalTwo() // Close the modal after asset selection if needed
  }

  const handleAssetSelectionThree = (asset: any) => {
    setSelectedAssetThree(asset)
    toggleModalThree() // Close the modal after asset selection if needed
  }

  const swapElement = (
    <SwapWrapperMulti isDark={isDark} className={className} id="swap-page">
      <TokenSafetyModal
        isOpen={importTokensNotInDefault.length > 0 && !dismissTokenWarning}
        tokenAddress={importTokensNotInDefault[0]?.address}
        secondTokenAddress={importTokensNotInDefault[1]?.address}
        onContinue={handleConfirmTokenWarning}
        onCancel={handleDismissTokenWarning}
        showCancel={true}
      />
      <SwapHeader trade={trade} autoSlippage={autoSlippage} chainId={chainId} />
      {trade && showConfirm && allowance.state !== AllowanceState.LOADING && (
        <ConfirmSwapModal
          trade={trade}
          inputCurrency={inputCurrency}
          originalTrade={tradeToConfirm}
          onAcceptChanges={handleAcceptChanges}
          onCurrencySelection={onCurrencySelection}
          swapResult={swapResult}
          allowedSlippage={allowedSlippage}
          onConfirm={handleSwap}
          allowance={allowance}
          swapError={swapError}
          onDismiss={handleConfirmDismiss}
          fiatValueInput={fiatValueTradeInput}
          fiatValueOutput={fiatValueTradeOutput}
        />
      )}
      {showPriceImpactModal && showPriceImpactWarning && (
        <PriceImpactModal
          priceImpact={largerPriceImpact}
          onDismiss={() => setShowPriceImpactModal(false)}
          onContinue={() => {
            setShowPriceImpactModal(false)
            handleContinueToReview()
          }}
        />
      )}
      {/* container */}
      <Container>
        {/* container-one */}
        {/* <LeftContainer>
          <InputMainBackground>
            <AssetToggle>
              <div>
                <ButtonToggle onClick={toggleModal}>
                  <AssetContainer style={{ display: 'flex', alignItems: 'center' }}>
                    <img
                      src={eth}
                      style={{
                        // width: '50px',
                        height: '20px',
                        objectFit: 'contain',
                        objectPosition: 'right',
                        marginRight: '10px',
                      }}
                      alt="logo"
                    />
                    <p style={{ color: '#000', fontSize: '1rem' }}>ETH</p>
                    <img src={drp} style={{ width: '25px', marginLeft: '2px' }} alt="dropdown" />
                  </AssetContainer>
                </ButtonToggle>
              </div>
            </AssetToggle>
            <div>
              <Input style={{ width: '100%' }} type="number" defaultValue={0} />
            </div>
          </InputMainBackground>
          <div>
            {isModalOpen && (
              <CurrencyModal onClose={toggleModal} isModalOpen={isModalOpen}>
                <ModalHeader>
                  <h4 style={{ color: '#000' }}>Select a token</h4>
                  <p
                    style={{
                      color: '#000',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                    }}
                    onClick={toggleModal}
                  >
                    X
                  </p>
                </ModalHeader>

                <div>
                  {assets.map((asset, index) => (
                    <AssetItem
                      key={index}
                      logoSrc={asset.logoSrc}
                      name={asset.name}
                      symbol={asset.symbol}
                      onClick={() => handleAssetSelection(asset)} // Handle asset selection
                    />
                  ))}
                </div>
              </CurrencyModal>
            )}
          </div>
        </LeftContainer> */}
        <ArrowContainer>
          <img src={arrow} width={40} alt="arrow" />
        </ArrowContainer>
        <LeftContainer>
          <InputMainBackground>
            <AssetToggle>
              <div>
                <ButtonToggle onClick={toggleModalOne}>
                  <AssetContainer style={{ display: 'flex', alignItems: 'center' }}>
                    <img
                      src={selectedAsset?.logoSrc || eth} // Use selected asset logo or default
                      style={{
                        height: '20px',
                        objectFit: 'contain',
                        objectPosition: 'right',
                        marginRight: '10px',
                      }}
                      alt="logo"
                    />
                    <p style={{ color: '#000', fontSize: '1rem' }}>{selectedAsset?.name || 'ETH'}</p>
                    <img src={drp} style={{ width: '25px', marginLeft: '2px' }} alt="dropdown" />
                  </AssetContainer>
                </ButtonToggle>
              </div>
            </AssetToggle>
            <div>
              <Input style={{ width: '100%' }} type="number" defaultValue={0} />
            </div>
          </InputMainBackground>
          <div>
            {isModalOpenOne && (
              <CurrencyModal onClose={toggleModalOne} isModalOpen={isModalOpenOne}>
                <ModalHeader>
                  <h4 style={{ color: '#000' }}>Select a token</h4>
                  <p
                    style={{
                      color: '#000',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                    }}
                    onClick={toggleModalOne}
                  >
                    X
                  </p>
                </ModalHeader>
                <SearchInputComponent />
                <div>
                  {assets.map((asset, index) => (
                    <AssetItem
                      key={index}
                      logoSrc={asset.logoSrc}
                      name={asset.name}
                      symbol={asset.symbol}
                      onClick={() => handleAssetSelection(asset)}
                    />
                  ))}
                </div>
              </CurrencyModal>
            )}
          </div>
        </LeftContainer>

        <RightContainer>
          <div>
            <InputBackground>
              <div>
                <AssetToggleTwo>
                  <div>
                    <ButtonToggle onClick={toggleModalTwo}>
                      <AssetContainer style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                          src={selectedAssetTwo?.logoSrc || polygon}
                          style={{
                            height: '20px',
                            objectFit: 'contain',
                            objectPosition: 'right',
                            marginRight: '10px',
                          }}
                          alt="logo"
                        />
                        <p style={{ color: '#000', fontSize: '1rem' }}>{selectedAssetTwo?.name || 'ETH'}</p>
                        <img src={drp} style={{ width: '25px', marginLeft: '2px' }} alt="dropdown" />
                      </AssetContainer>
                    </ButtonToggle>
                  </div>
                </AssetToggleTwo>
              </div>
              <div>
                <InputContainer>
                  <Input style={{ width: '100%' }} type="number" defaultValue={0} />
                  <PercentSign>%</PercentSign>
                </InputContainer>
              </div>
              {isModalOpenTwo && (
                <CurrencyModal onClose={toggleModalTwo} isModalOpen={isModalOpenTwo}>
                  <ModalHeader>
                    <h4 style={{ color: '#000' }}>Select a token</h4>
                    <p
                      style={{
                        color: '#000',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                      }}
                      onClick={toggleModalTwo}
                    >
                      X
                    </p>
                  </ModalHeader>
                  <SearchInputComponent />
                  <div>
                    {assets.map((asset, index) => (
                      <AssetItem
                        key={index}
                        logoSrc={asset.logoSrc}
                        name={asset.name}
                        symbol={asset.symbol}
                        onClick={() => handleAssetSelectionTwo(asset)}
                      />
                    ))}
                  </div>
                </CurrencyModal>
              )}
            </InputBackground>
          </div>

          {/* {showDetailsDropdown && (
            <SwapDetailsDropdown
              trade={trade}
              syncing={routeIsSyncing}
              loading={routeIsLoading}
              allowedSlippage={allowedSlippage}
            />
          )} */}
          {/* </AutoColumn> */}

          {/* <div style={{ marginTop: '3rem' }}>
            <InputBackground>
              <InputContainer>
                <Input style={{ width: '100%' }} type="number" defaultValue={0} />
                <PercentSign>%</PercentSign>
              </InputContainer>
            </InputBackground>
          </div> */}

          <div style={{ marginTop: '2rem' }}>
            <InputBackground>
              <div>
                <AssetToggleThree>
                  <div>
                    <ButtonToggle onClick={toggleModalThree}>
                      <AssetContainer style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                          src={selectedAssetThree?.logoSrc || bnb}
                          style={{
                            height: '20px',
                            objectFit: 'contain',
                            objectPosition: 'right',
                            marginRight: '10px',
                          }}
                          alt="logo"
                        />
                        <p style={{ color: '#000', fontSize: '1rem' }}>{selectedAssetThree?.name || 'ETH'}</p>
                        <img src={drp} style={{ width: '25px', marginLeft: '2px' }} alt="dropdown" />
                      </AssetContainer>
                    </ButtonToggle>
                  </div>
                </AssetToggleThree>
              </div>
              <div>
                <InputContainer>
                  <Input style={{ width: '100%' }} type="number" defaultValue={0} />
                  <PercentSign>%</PercentSign>
                </InputContainer>
              </div>
              {isModalOpenThree && (
                <CurrencyModal onClose={toggleModalThree} isModalOpen={isModalOpenThree}>
                  <ModalHeader>
                    <h4 style={{ color: '#000' }}>Select a token</h4>
                    <p
                      style={{
                        color: '#000',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                      }}
                      onClick={toggleModalThree}
                    >
                      X
                    </p>
                  </ModalHeader>
                  <SearchInputComponent />
                  <div>
                    {assets.map((asset, index) => (
                      <AssetItem
                        key={index}
                        logoSrc={asset.logoSrc}
                        name={asset.name}
                        symbol={asset.symbol}
                        onClick={() => handleAssetSelectionThree(asset)}
                      />
                    ))}
                  </div>
                </CurrencyModal>
              )}
            </InputBackground>
          </div>
        </RightContainer>
      </Container>
    </SwapWrapperMulti>
  )

  return <>{swapElement}</>
}
