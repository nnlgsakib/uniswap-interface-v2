import React from 'react'
import styled from 'styled-components'

import eth from '../../assets/images/ethereum-logo.png'
import bnb from '../../assets/svg/bnb-logo.svg'
import matic from '../../assets/svg/polygon-matic-logo.svg'
const AssetItemsContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1.25rem;
  cursor: pointer;
`

const AssetLogo = styled.img`
  height: 50px;
  object-fit: contain;
  margin-right: 10px;
`

const AssetName = styled.div`
  display: flex;
  flex-direction: column;
`

const AssetItem = ({ logoSrc, name, symbol, onClick }: any) => {
  return (
    <AssetItemsContainer onClick={onClick}>
      <AssetLogo src={logoSrc} alt="logo" />
      <AssetName>
        <span style={{ color: '#000', fontSize: '1rem' }}>{name}</span>
        <span style={{ color: '#ccc', fontSize: '.75rem' }}>{symbol}</span>
      </AssetName>
    </AssetItemsContainer>
  )
}

export default AssetItem

export const assets = [
  { logoSrc: eth, name: 'Ether', symbol: 'ETH' },
  { logoSrc: bnb, name: 'BNB', symbol: 'BNB' },
  { logoSrc: matic, name: 'Polygon', symbol: 'MATIC' },
  // Add more assets
]
