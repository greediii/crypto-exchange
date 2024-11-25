import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  VStack,
  HStack,
  Text,
  Textarea,
  Button,
  useToast,
  Box,
} from '@chakra-ui/react';
import axios from 'axios';

const PaymentVerification = ({ isOpen, onClose, expectedAmount, cashappUsername, transactionId }) => {
  const [receipt, setReceipt] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const toast = useToast();

  const parseReceipt = (receiptText) => {
    try {
      // Extract key information using regex
      const amountMatch = receiptText.match(/\$(\d+\.?\d*)/);
      const dateMatch = receiptText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[APM]{2}/i);
      const identifierMatch = receiptText.match(/#[A-Z0-9]+/);
      const fromMatch = receiptText.match(/From\n(.+)/);
      const toMatch = receiptText.match(/To\n(.+)/);

      if (!amountMatch || !dateMatch || !identifierMatch || !fromMatch || !toMatch) {
        throw new Error('Invalid receipt format');
      }

      return {
        amount: parseFloat(amountMatch[1]),
        date: new Date(dateMatch[0]),
        identifier: identifierMatch[0],
        from: fromMatch[1].trim(),
        to: toMatch[1].trim(),
      };
    } catch (error) {
      console.error('Receipt parsing error:', error);
      return null;
    }
  };

  const verifyPayment = async () => {
    setIsVerifying(true);
    
    try {
      const parsedReceipt = parseReceipt(receipt);
      
      if (!parsedReceipt) {
        throw new Error('Could not parse receipt');
      }

      // Initial validation checks
      if (parsedReceipt.amount !== expectedAmount) {
        throw new Error(`Amount mismatch: Expected $${expectedAmount}, got $${parsedReceipt.amount}`);
      }

      if (!parsedReceipt.to.toLowerCase().includes(cashappUsername.toLowerCase())) {
        throw new Error('CashApp username mismatch');
      }

      const timeDiff = Date.now() - parsedReceipt.date.getTime();
      if (timeDiff > 30 * 60 * 1000) {
        throw new Error('Payment must be made within the last 30 minutes');
      }

      // Send verification request to server
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3001/api/exchange/verify-and-complete',
        {
          transactionId,
          receipt,
          identifier: parsedReceipt.identifier,
          amount: parsedReceipt.amount,
          fromUsername: parsedReceipt.from
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Handle different verification responses
      if (response.data.success === false) {
        if (response.data.step === 'balance_check') {
          toast({
            title: 'Insufficient Funds',
            description: 'The exchange wallet currently has insufficient funds. Please try again later or contact support.',
            status: 'error',
            duration: 10000,
          });
          return;
        }

        throw new Error(response.data.message || 'Payment verification failed');
      }

      // Success!
      toast({
        title: 'Success',
        description: 'Payment verified successfully! Your crypto will be sent shortly.',
        status: 'success',
        duration: 5000,
      });
      onClose();

    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent bg="gray.900">
        <ModalHeader>Verify CashApp Payment</ModalHeader>
        <ModalBody>
          <VStack spacing={4} pb={6}>
            <Box w="full">
              <Text mb={2}>Expected Payment</Text>
              <HStack 
                p={4} 
                bg="gray.800" 
                borderRadius="md"
                justify="space-between"
              >
                <Text>${expectedAmount}</Text>
                <Text>to: ${cashappUsername}</Text>
              </HStack>
            </Box>

            <Box w="full">
              <Text mb={2}>Paste CashApp Web Receipt</Text>
              <Textarea
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                placeholder={`Example:
Payment from $username
$XX.XX
Nov 24, 2024 at 8:57 PM

Received
Amount
$XX.XX
Destination
Cash
Identifier
#XXXXXXX
To
[Name]
From
[Name]`}
                minH="200px"
                bg="gray.800"
              />
            </Box>

            <Button
              colorScheme="blue"
              w="full"
              onClick={verifyPayment}
              isLoading={isVerifying}
              loadingText="Verifying..."
              isDisabled={!receipt.trim()}
            >
              Verify Payment
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default PaymentVerification; 