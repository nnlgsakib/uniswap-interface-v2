import styled from 'styled-components'

interface SwitchButtonProps {
  active: boolean
  onClick: () => void
}

const SwitchButton = styled.button<SwitchButtonProps>`
  padding: 0.5rem 1rem;
  cursor: pointer;
  border: none;
  border-radius: 0.75rem;
  outline: none;
  color: #fff;
  outline-style: none;
  transition: background-color 0.3s;

  ${({ active }) =>
    active
      ? `
      background-color: #7a2ed6;
    `
      : `
      background-color: transparent;
      border: 1px solid #7a2ed6;
    `}

  &:hover {
    background-color: #7a2ed6;
  }
`

export default SwitchButton
