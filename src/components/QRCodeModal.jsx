import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Button,
  HStack,
  Divider,
  Box,
  Input,
  Spinner,
  useDisclosure,
} from '@chakra-ui/react';
import { FaExternalLinkAlt, FaCheck, FaTimes } from 'react-icons/fa';
import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import axios from 'axios';
import { keyframes } from '@emotion/react';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const shake = keyframes`
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
`;

const QRCodeModal = ({ isOpen, onClose, qrCodeData, onVerify }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [webReceipt, setWebReceipt] = useState('');
  const [showReceiptInput, setShowReceiptInput] = useState(false);
  const [verificationState, setVerificationState] = useState('initial'); // 'initial', 'verifying', 'success', 'declined'
  const toast = useToast();

  const handleVerification = async () => {
    if (!webReceipt) {
      toast({
        title: 'Error',
        description: 'Please enter the web receipt URL',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setVerificationState('verifying');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3001/api/exchange/verify-and-complete',
        {
          transactionId: qrCodeData?.transactionId,
          receipt: webReceipt,
          amount: parseFloat(qrCodeData?.amount),
          fromUsername: qrCodeData?.fromUsername
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setVerificationState('success');
        setTimeout(() => {
          onClose();
          toast({
            title: 'Success',
            description: 'Payment verified! Your crypto will be sent shortly.',
            status: 'success',
            duration: 5000,
          });
        }, 2000);
      } else {
        setVerificationState('declined');
        setTimeout(() => {
          setVerificationState('initial');
          setShowReceiptInput(true);
          setWebReceipt('');
        }, 3000);
      }
    } catch (error) {
      setVerificationState('declined');
      setTimeout(() => {
        setVerificationState('initial');
        setShowReceiptInput(true);
        setWebReceipt('');
      }, 3000);
    }
  };

  const renderVerificationState = () => {
    switch (verificationState) {
      case 'verifying':
        return (
          <VStack 
            spacing={6} 
            py={8}
            animation={`${fadeIn} 0.3s ease-out`}
          >
            <Spinner size="xl" color="green.400" thickness="4px" />
            <Text color="white" fontSize="lg">Verifying Payment...</Text>
            <Text color="gray.400" fontSize="sm">Please wait while we confirm your transaction</Text>
          </VStack>
        );
      
      case 'success':
        return (
          <VStack 
            spacing={6} 
            py={8}
            animation={`${fadeIn} 0.3s ease-out`}
          >
            <Box 
              color="green.400" 
              fontSize="48px"
              animation={`${fadeIn} 0.5s ease-out`}
            >
              <FaCheck />
            </Box>
            <Text color="white" fontSize="lg">Payment Verified!</Text>
            <Text color="gray.400" fontSize="sm">Your crypto will be sent shortly</Text>
          </VStack>
        );
      
      case 'declined':
        return (
          <VStack 
            spacing={6} 
            py={8}
            animation={`${fadeIn} 0.3s ease-out`}
          >
            <Box 
              bg="red.500"
              color="white"
              p={4}
              borderRadius="full"
              animation={`${shake} 0.5s ease-out`}
            >
              <FaTimes size="32px" />
            </Box>
            <Text 
              color="red.400" 
              fontSize="xl" 
              fontWeight="bold"
              animation={`${fadeIn} 0.5s ease-out`}
            >
              Payment Declined
            </Text>
            <Text color="gray.400" fontSize="sm" textAlign="center">
              We couldn't verify your payment.
              <br />
              Please check the receipt URL and try again.
            </Text>
          </VStack>
        );
      
      default:
        return showReceiptInput ? (
          <VStack spacing={4}>
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Please enter the web receipt URL from your CashApp payment
            </Text>
            <Input
              placeholder="https://cash.app/payments/..."
              value={webReceipt}
              onChange={(e) => setWebReceipt(e.target.value)}
              bg="gray.900"
              border="1px solid"
              borderColor="gray.700"
              _focus={{ borderColor: "green.400" }}
              color="white"
            />
            <Button
              colorScheme="green"
              width="full"
              onClick={handleVerification}
              mt={2}
            >
              Verify Payment
            </Button>
          </VStack>
        ) : (
          // Original payment details and options content
          <VStack spacing={6} align="stretch">
            {/* Payment Details Box */}
            <Box
              bg="gray.900"
              p={{ base: 4, md: 6 }}
              borderRadius="xl"
              borderWidth="1px"
              borderColor="gray.700"
            >
              {/* ... (rest of the payment details content) */}
              <VStack spacing={4} align="stretch">
                  <HStack justify="space-between">
                    <Text color="gray.400">Send to:</Text>
                    <Text color="green.400" fontWeight="bold" fontSize={{ base: "md", md: "lg" }}>
                      ${qrCodeData?.cashappUsername}
                    </Text>
                  </HStack>

                  <Divider borderColor="gray.700" />

                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text color="gray.400">Total Amount:</Text>
                      <Text color="green.400" fontWeight="bold" fontSize={{ base: "xl", md: "2xl" }}>
                        ${qrCodeData?.amount}
                      </Text>
                    </HStack>

                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize={{ base: "sm", md: "md" }}>
                        Service Fee ({qrCodeData?.feePercentage}%):
                      </Text>
                      <Text color="blue.400" fontWeight="semibold">
                        ${qrCodeData?.exchangeFee}
                      </Text>
                    </HStack>

                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize={{ base: "sm", md: "md" }}>Network Fee:</Text>
                      <Text color="blue.400" fontWeight="semibold">
                        ${qrCodeData?.networkFee}
                      </Text>
                    </HStack>

                    <Divider borderColor="gray.700" />

                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize={{ base: "sm", md: "md" }}>You will receive:</Text>
                      <VStack align="flex-end" spacing={0}>
                        <Text color="green.400" fontWeight="bold">
                          {qrCodeData?.cryptoAmount} {qrCodeData?.cryptoType}
                        </Text>
                      </VStack>
                    </HStack>
                  </VStack>

                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Transaction ID: {qrCodeData?.transactionId}
                  </Text>
                </VStack>
            </Box>

            {/* Payment Options */}
            <VStack spacing={4} align="stretch">
              {/* Option 1: QR Code */}
              <Box
                bg="gray.900"
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="gray.700"
              >
                <VStack spacing={3}>
                  <Text color="gray.400" fontWeight="medium" fontSize={{ base: "sm", md: "md" }}>
                    Option 1: Scan QR Code
                  </Text>
                  <Box
                    bg="white"
                    p={3}
                    borderRadius="md"
                    width={{ base: "160px", md: "200px" }}
                    height={{ base: "160px", md: "200px" }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mx="auto"
                  >
                    {qrCodeData && cashAppUrl ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cashAppUrl)}`}
                        alt="CashApp QR Code"
                        width="100%"
                        height="100%"
                        style={{ objectFit: 'contain' }}
                      />
                    ) : (
                      <Text color="gray.800">Loading QR Code...</Text>
                    )}
                  </Box>
                </VStack>
              </Box>

              {/* Option 2: Direct Link */}
              <Box
                bg="gray.900"
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="gray.700"
              >
                <VStack spacing={3}>
                  <Text color="gray.400" fontWeight="medium" fontSize={{ base: "sm", md: "md" }}>
                    Option 2: Click Link
                  </Text>
                  <Button
                    as="a"
                    href={cashAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    colorScheme="green"
                    width="full"
                    size={{ base: "sm", md: "md" }}
                    leftIcon={<FaExternalLinkAlt />}
                  >
                    Open in CashApp
                  </Button>
                </VStack>
              </Box>
            </VStack>

            <Button
              colorScheme="green"
              width="full"
              onClick={() => setShowReceiptInput(true)}
              mt={2}
            >
              I've Sent the Payment
            </Button>
          </VStack>
        );
    }
  };

  // Generate CashApp payment URL
  const cashAppUsername = qrCodeData?.cashappUsername?.replace('$', '');
  const amount = qrCodeData?.amount;
  const cashAppUrl = `https://cash.app/$${cashAppUsername}/${amount}`;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent 
        bg="gray.800" 
        borderRadius="xl" 
        borderWidth="1px" 
        borderColor="gray.700"
        mx={{ base: 4, md: 0 }}
        my={{ base: 4, md: 0 }}
        maxH={{ base: "90vh", md: "85vh" }}
        overflow="auto"
      >
        <ModalHeader>
          <Text fontSize={{ base: "md", md: "lg" }} color="white" textAlign="center">
            Send Payment
          </Text>
        </ModalHeader>
        <ModalCloseButton size="sm" />
        
        <ModalBody pb={6}>
          {renderVerificationState()}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default QRCodeModal;