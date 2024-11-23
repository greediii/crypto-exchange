import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Select,
  FormControl,
  FormLabel,
  StatGroup,
  useToast,
  Heading,
  IconButton,
  Divider,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Image,
  Link,
  Table,
  Thead,
  Tr,
  Td,
  Th,
  Tbody,
  Badge,
  Textarea,
} from '@chakra-ui/react';
import { FaBitcoin, FaEthereum, FaUser, FaExchangeAlt, FaCrown, FaCog, FaTicketAlt, FaComments } from 'react-icons/fa';
import { SiLitecoin } from 'react-icons/si';
import { BiDollar, BiRefresh } from 'react-icons/bi';
import axios from 'axios';
import QRCodeModal from './QRCodeModal';
import { useNavigate } from 'react-router-dom';
import TicketModal from './TicketModal';
import TicketListModal from './TicketListModal';

const CryptoExchange = ({ onProfileClick, userRole, onAdminClick, onLogout }) => {
  const [formData, setFormData] = useState({
    cashAppAmount: '',
    cryptoType: 'BTC',
    walletAddress: ''
  });

  const [qrCodeData, setQrCodeData] = useState(null);

  const [cryptoPrices, setCryptoPrices] = useState({
    BTC: { price: null, change24h: null },
    ETH: { price: null, change24h: null },
    LTC: { price: null, change24h: null }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [calculatedValues, setCalculatedValues] = useState({
    feeAmount: 0,
    netAmount: 0,
    cryptoAmount: 0
  });

  const [feePercentage, setFeePercentage] = useState(22);

  const [showReceiptInput, setShowReceiptInput] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [verifyingReceipt, setVerifyingReceipt] = useState(false);

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    message: '',
    priority: 'normal'
  });

  const [selectedTicketResponses, setSelectedTicketResponses] = useState([]);
  const [newResponse, setNewResponse] = useState('');

  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const cryptoOptions = [
    { value: 'BTC', label: 'Bitcoin', icon: FaBitcoin, color: '#f7931a' },
    { value: 'ETH', label: 'Ethereum', icon: FaEthereum, color: '#627eea' },
    { value: 'LTC', label: 'Litecoin', icon: SiLitecoin, color: '#345d9d' }
  ];

  const navigate = useNavigate();

  const fetchPrices = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await axios.get('http://localhost:3001/api/crypto/prices');
      
      console.log('Price response:', response.data);
      
      if (response.data && typeof response.data === 'object') {
        const hasValidPrices = ['BTC', 'ETH', 'LTC'].every(
          symbol => 
            response.data[symbol]?.price !== undefined && 
            response.data[symbol]?.change24h !== undefined
        );

        if (hasValidPrices) {
          setCryptoPrices(response.data);
        } else {
          console.error('Invalid price data structure:', response.data);
          throw new Error('Invalid price data received');
        }
      }
    } catch (error) {
      console.error('Price fetch error:', error);
      toast({
        title: 'Price Update Failed',
        description: 'Unable to fetch current prices. Please try again later.',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  useEffect(() => {
    const fetchFeePercentage = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3001/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data && response.data.feePercentage) {
          setFeePercentage(parseFloat(response.data.feePercentage));
        }
      } catch (error) {
        console.error('Error fetching fee percentage:', error);
      }
    };

    fetchFeePercentage();
  }, []);

  const calculateAmounts = (amount, cryptoType) => {
    const numAmount = parseFloat(amount) || 0;
    const feeAmount = (numAmount * feePercentage) / 100;
    const netAmount = numAmount - feeAmount;
    
    const cryptoAmount = cryptoPrices[cryptoType]?.price 
      ? (netAmount / cryptoPrices[cryptoType].price).toFixed(8)
      : 0;

    setCalculatedValues({
      feeAmount: feeAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      cryptoAmount
    });
  };

  const verifyWalletAddress = (address, type) => {
    try {
      switch (type) {
        case 'BTC':
          // Updated Bitcoin address validation to include bech32 (bc1), legacy (1), and segwit (3)
          return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address);
        case 'ETH':
          // Ethereum address validation
          return /^0x[a-fA-F0-9]{40}$/.test(address);
        case 'LTC':
          // Litecoin address validation (including M addresses)
          return /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.cashAppAmount || !formData.walletAddress) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    if (!verifyWalletAddress(formData.walletAddress, formData.cryptoType)) {
      toast({
        title: 'Invalid Wallet Address',
        description: `Please enter a valid ${formData.cryptoType} wallet address`,
        status: 'error',
        duration: 5000,
      });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3001/api/exchange/create',
        {
          cashAppAmount: formData.cashAppAmount,
          cryptoType: formData.cryptoType,
          walletAddress: formData.walletAddress,
          priceAtSubmission: cryptoPrices[formData.cryptoType].price
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setQrCodeData(response.data);
      setIsQRModalOpen(true);
    } catch (error) {
      console.error('Exchange creation error:', error);
      toast({
        title: 'Exchange Failed',
        description: error.response?.data?.message || 'Failed to create exchange',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    if (name === 'cashAppAmount' || name === 'cryptoType') {
      calculateAmounts(newFormData.cashAppAmount, newFormData.cryptoType);
    }
  };

  const bgColor = useColorModeValue('gray.800', 'gray.800');
  const borderColor = useColorModeValue('gray.700', 'gray.700');

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '---';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleVerifyReceipt = async () => {
    try {
      setVerifyingReceipt(true);
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:3001/api/exchange/verify',
        {
          transactionId: qrCodeData.transactionId,
          receiptUrl
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      toast({
        title: 'Success',
        description: 'Payment verified! Your crypto will be sent shortly.',
        status: 'success',
        duration: 5000,
      });
      setIsQRModalOpen(false);
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: error.response?.data?.message || 'Failed to verify payment',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setVerifyingReceipt(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Current user role:', userRole);
      
      const endpoint = ['support', 'admin', 'owner'].includes(userRole) ? 
        'http://localhost:3001/api/tickets/all' : 
        'http://localhost:3001/api/tickets/my';
      
      console.log('Using endpoint:', endpoint);
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Tickets response:', response.data);
      setTickets(response.data);
    } catch (error) {
      console.error('Ticket fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tickets',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleSubmitTicket = async (ticketData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3001/api/tickets', ticketData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh tickets list after submission
      fetchTickets();
      
      toast({
        title: 'Success',
        description: 'Ticket submitted successfully',
        status: 'success',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to submit ticket',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleViewTicket = (ticketId) => {
    setSelectedTicketId(ticketId);
  };

  useEffect(() => {
    if (isTicketModalOpen) {
      fetchTickets();
    }
  }, [isTicketModalOpen]);

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3001/api/tickets/${ticketId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      fetchTickets();
      toast({
        title: 'Success',
        description: 'Ticket status updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update ticket status',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleAddResponse = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3001/api/tickets/${ticketId}/responses`,
        { message: newResponse },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNewResponse('');
      fetchTicketResponses(ticketId);
      toast({
        title: 'Success',
        description: 'Response added',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add response',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const fetchTicketResponses = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:3001/api/tickets/${ticketId}/responses`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setSelectedTicketResponses(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load ticket responses',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:3001/api/tickets/${ticketId}/status`, {
        status: 'closed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchTickets();
      toast({
        title: 'Success',
        description: 'Ticket closed successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to close ticket',
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <Container maxW="container.lg" py={8}>
      <HStack w="full" justify="flex-end" mb={4}>
        <IconButton
          icon={<FaTicketAlt />}
          onClick={() => setIsTicketModalOpen(true)}
          colorScheme="purple"
          variant="ghost"
          aria-label="Support Tickets"
        />
        <IconButton
          icon={<FaCog />}
          onClick={handleSettingsClick}
          colorScheme="blue"
          color="blue.200"
          variant="ghost"
          aria-label="Settings"
          _hover={{
            bg: 'blue.800',
            color: 'white',
            transform: 'rotate(90deg)',
            transition: 'all 0.3s ease'
          }}
        />
        <IconButton
          icon={<FaUser />}
          onClick={onProfileClick}
          colorScheme="blue"
          variant="ghost"
          aria-label="Profile"
        />
        {userRole === 'owner' && (
          <IconButton
            icon={<FaCrown />}
            onClick={onAdminClick}
            colorScheme="yellow"
            variant="ghost"
            aria-label="Admin Panel"
          />
        )}
      </HStack>

      <Heading
        size="2xl"
        bgGradient="linear(to-r, blue.400, purple.500)"
        bgClip="text"
        fontWeight="extrabold"
        letterSpacing="tight"
        textAlign="center"
        mb={6}
        py={2}
        lineHeight="1.2"
        textShadow="0 0 1px rgba(0,0,0,0.1)"
      >
        Crypto Exchange
      </Heading>

      <StatGroup 
        mb={6} 
        display="grid"
        gridTemplateColumns={{ 
          base: "repeat(1, 1fr)",    // 1 card per row on mobile
          sm: "repeat(2, 1fr)",      // 2 cards per row on small screens
          md: "repeat(3, 1fr)"       // 3 cards per row on medium and up
        }}
        gap={4}
      >
        {cryptoOptions.map(({ value, label, icon: CryptoIcon, color }) => (
          <Box
            key={value}
            bg={bgColor}
            p={4}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={borderColor}
            width="100%"
          >
            <HStack spacing={4} align="center">
              <CryptoIcon size={24} color={color} />
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.400">
                  {label}
                </Text>
                {cryptoPrices[value]?.price ? (
                  <>
                    <Text fontWeight="bold" fontSize="lg">
                      ${cryptoPrices[value].price.toLocaleString()}
                    </Text>
                    <Text
                      fontSize="xs"
                      color={
                        cryptoPrices[value].change24h >= 0
                          ? "green.400"
                          : "red.400"
                      }
                    >
                      {cryptoPrices[value].change24h >= 0 ? "+" : ""}
                      {cryptoPrices[value].change24h}%
                    </Text>
                  </>
                ) : (
                  <Text color="red.400">Price unavailable</Text>
                )}
              </VStack>
            </HStack>
          </Box>
        ))}
      </StatGroup>

      <VStack spacing={4} align="center" mt={6}>
        <Box
          as="form"
          onSubmit={handleSubmit}
          w="full"
          bg={bgColor}
          p={8}
          borderRadius="xl"
          borderWidth={1}
          borderColor={borderColor}
          boxShadow="2xl"
          transition="all 0.3s"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '3xl' }}
        >
          <VStack spacing={6}>
            <FormControl isRequired>
              <FormLabel>CashApp Amount (USD)</FormLabel>
              <InputGroup>
                <InputLeftElement children={<BiDollar />} />
                <Input
                  name="cashAppAmount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.cashAppAmount}
                  onChange={handleInputChange}
                  placeholder="Enter amount"
                />
              </InputGroup>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Select Cryptocurrency</FormLabel>
              <Select
                name="cryptoType"
                value={formData.cryptoType}
                onChange={handleInputChange}
                bg="gray.800"
                color="white"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                sx={{
                  '& option': {
                    backgroundColor: 'gray.800',
                    color: 'white'
                  }
                }}
                style={{
                  backgroundColor: '#1A202C',
                  color: 'white'
                }}
              >
                <option style={{ backgroundColor: '#1A202C', color: 'white' }} value="BTC">Bitcoin (BTC)</option>
                <option style={{ backgroundColor: '#1A202C', color: 'white' }} value="ETH">Ethereum (ETH)</option>
                <option style={{ backgroundColor: '#1A202C', color: 'white' }} value="LTC">Litecoin (LTC)</option>
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Wallet Address</FormLabel>
              <Input
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                placeholder={`Enter your ${formData.cryptoType} wallet address`}
              />
            </FormControl>

            <Divider />

            <Box w="full">
              <Text mb={2}>Exchange Summary:</Text>
              <HStack justify="space-between" mb={2}>
                <Text color="gray.400">Amount (USD):</Text>
                <Text>${formData.cashAppAmount || '0.00'}</Text>
              </HStack>
              <HStack justify="space-between" mb={2}>
                <Text color="gray.400">Fee ({feePercentage}%):</Text>
                <Text>${calculatedValues.feeAmount}</Text>
              </HStack>
              <HStack justify="space-between" mb={4}>
                <Text color="gray.400">You'll Receive:</Text>
                <Text>{calculatedValues.cryptoAmount} {formData.cryptoType}</Text>
              </HStack>
            </Box>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              w="full"
              isLoading={loading}
              leftIcon={<FaExchangeAlt />}
            >
              Exchange Now
            </Button>
          </VStack>
        </Box>
      </VStack>

      <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent bg={bgColor}>
          <ModalHeader color="white">Scan with CashApp</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Link href="https://cash.app/$Greedii1" isExternal>
                <Image src={qrCodeData?.qrCodeUrl} alt="QR Code" />
              </Link>
              <Box w="100%" p={4} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between">
                    <Text color="white">Total Amount:</Text>
                    <Text color="white">${formData.cashAppAmount}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="white">Fee ({feePercentage}%):</Text>
                    <Text color="white">${qrCodeData?.feeAmount}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="white">Net Amount:</Text>
                    <Text color="white">${qrCodeData?.netAmount}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="white">You will receive:</Text>
                    <Text color="white">{qrCodeData?.cryptoAmountAfterFees} {formData.cryptoType}</Text>
                  </HStack>
                  <Divider my={2} />
                  <HStack justify="space-between">
                    <Text color="gray.400">Transaction ID:</Text>
                    <Text color="gray.400">{qrCodeData?.transactionId}</Text>
                  </HStack>
                </VStack>
              </Box>
              
              <Button
                colorScheme="green"
                size="lg"
                width="full"
                onClick={() => setShowReceiptInput(true)}
              >
                I've Completed the Payment
              </Button>

              {showReceiptInput && (
                <VStack spacing={3} width="full">
                  <Text color="white">
                    Please paste your CashApp web receipt URL to verify the payment
                  </Text>
                  <Input
                    placeholder="https://cash.app/payments/..."
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                  />
                  <Button
                    colorScheme="blue"
                    width="full"
                    isLoading={verifyingReceipt}
                    onClick={handleVerifyReceipt}
                  >
                    Verify Payment
                  </Button>
                </VStack>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <TicketListModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        tickets={tickets}
        onViewTicket={handleViewTicket}
        userRole={userRole}
        onSubmitTicket={handleSubmitTicket}
        onCloseTicket={handleCloseTicket}
      />

      <TicketModal
        isOpen={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        ticketId={selectedTicketId}
        userRole={userRole}
      />

    </Container>
  );
};

export default CryptoExchange; 