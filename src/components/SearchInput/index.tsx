import React, { useState } from 'react'
import styled from 'styled-components'

import search from '../../assets/svg/search.svg'

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  background-color: #fff;
  border: 1px solid #000;
  border-radius: 4px;
  padding: 5px;
  margin-bottom: 50px;
`

const SearchIcon = styled.img`
  width: 20px;
  height: 20px;
  margin-right: 5px;
`

const SearchInput = styled.input`
  border: none;
  outline: none;
  flex-grow: 1;
`

const SearchInputComponent = () => {
  const [searchText, setSearchText] = useState('')

  const handleSearchChange = (event: any) => {
    setSearchText(event.target.value)
  }

  return (
    <SearchContainer>
      <SearchIcon src={search} alt="Search" />
      <SearchInput
        type="text"
        placeholder="Search name or paste address"
        value={searchText}
        onChange={handleSearchChange}
      />
    </SearchContainer>
  )
}

export default SearchInputComponent
