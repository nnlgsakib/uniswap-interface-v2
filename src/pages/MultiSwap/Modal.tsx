import React from 'react'
import styled from 'styled-components'

const ModalWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent black overlay */
  z-index: 1000;
`

const ModalContent = styled.div`
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.2);
  width: 80%; /* Default width for larger screens */
  max-width: 500px; /* Maximum width for very large screens */

  @media (max-width: 768px) {
    width: 90%; /* Adjust width for tablets and smaller screens */
  }

  @media (max-width: 480px) {
    width: 95%; /* Adjust width for mobile screens */
  }
`

const Button = styled.button`
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`

const CurrencyModal = ({ onClose, isModalOpen, children }: any) => {
  return (
    <div>
      {isModalOpen && (
        <ModalWrapper>
          <ModalContent>{children}</ModalContent>
        </ModalWrapper>
      )}
    </div>
  )
}

export default CurrencyModal
