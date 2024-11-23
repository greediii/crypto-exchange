import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Image,
  Button,
} from '@chakra-ui/react';

const QRCodeModal = ({ isOpen, onClose, qrCodeData, onVerify }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Complete Payment via CashApp</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} py={4}>
            <Text>Total Amount: ${qrCodeData?.amount}</Text>
            <Text>Fee (22%): ${qrCodeData?.feeAmount}</Text>
            <Text>Net Amount: ${qrCodeData?.netAmount}</Text>
            <Text>You will receive: {qrCodeData?.cryptoAmount} {qrCodeData?.cryptoType}</Text>
            <Text fontSize="sm">Transaction ID: {qrCodeData?.transactionId}</Text>
            <Image
              src={qrCodeData?.qrCodeUrl}
              alt="CashApp QR Code"
              boxSize="200px"
            />
            <Text fontSize="sm">
              Scan this QR code with CashApp to complete the payment
            </Text>
            <Button
              colorScheme="green"
              onClick={onVerify}
              w="full"
            >
              I've Completed the Payment
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default QRCodeModal; 