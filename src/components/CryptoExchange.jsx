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
  Spinner,
  Grid,
  GridItem,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FaBitcoin, FaEthereum, FaUser, FaExchangeAlt, FaCrown, FaCog, FaTicketAlt, FaComments, FaChevronDown, FaInfoCircle, FaLink } from 'react-icons/fa';
import { SiLitecoin } from 'react-icons/si';
import { BiDollar, BiRefresh } from 'react-icons/bi';
import axios from 'axios';
import QRCodeModal from './QRCodeModal';
import { useNavigate } from 'react-router-dom';
import TicketModal from './TicketModal';
import TicketListModal from './TicketListModal';
import { CheckIcon } from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';

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
    feeAmount: '0',
    netAmount: '0',
    cryptoAmount: '0'
  });

  const [feePercentage, setFeePercentage] = useState(22);

  const [showReceiptInput, setShowReceiptInput] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [verifyingReceipt, setVerifyingReceipt] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);

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

  const [isScanning, setIsScanning] = useState(false);

  const [exchangeDetails, setExchangeDetails] = useState({
    amount: 0,
    cryptoType: '',
    cached: false,
    feeAmount: '0',
    netAmount: '0'
  });

  const [parsedReceipt, setParsedReceipt] = useState(null);
  const [isReceiptValid, setIsReceiptValid] = useState(false);

  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isValidUrl, setIsValidUrl] = useState(false);

  const [currentTransaction, setCurrentTransaction] = useState(null);

  const [networkFees, setNetworkFees] = useState({});

  const [amounts, setAmounts] = useState({
    serviceFee: '0.00',
    networkFeeUSD: '0.00',
    totalAmount: '0.00',
    cryptoAmount: '0.00000000'
  });

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
          // Only update if prices have actually changed
          setCryptoPrices(prevPrices => {
            const hasChanged = ['BTC', 'ETH', 'LTC'].some(
              symbol => prevPrices[symbol]?.price !== response.data[symbol].price
            );
            return hasChanged ? response.data : prevPrices;
          });
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

  const calculateAmounts = useCallback(async (inputAmount, cryptoPrice, networkFee) => {
    console.log('calculateAmounts called with:', { 
      inputAmount, 
      cryptoPrice, 
      networkFee, 
      currentFeePercentage: feePercentage 
    });

    try {
      const amount = parseFloat(inputAmount);
      
      const token = localStorage.getItem('token');
      console.log('Fetching fee rate from server...');
      const response = await axios.get(`http://localhost:3001/api/exchange/fee-rate`, {
        params: { 
          amount,
          cryptoType: formData.cryptoType 
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Server response:', response.data);

      // Only update fee if we get a valid response
      let effectiveFeePercentage = feePercentage; // Start with current fee
      if (response.data?.feePercentage) {
        const newFeePercentage = parseFloat(response.data.feePercentage);
        if (!isNaN(newFeePercentage)) {
          effectiveFeePercentage = newFeePercentage;
          console.log('New fee percentage from server:', newFeePercentage);
        }
      }
      
      // Calculate using the effective fee percentage
      const serviceFee = (amount * (effectiveFeePercentage / 100)).toFixed(2);
      const networkFeeUSD = (networkFee * cryptoPrice).toFixed(2);
      const netAmountUSD = amount - parseFloat(serviceFee) - parseFloat(networkFeeUSD);
      const cryptoAmount = (netAmountUSD / cryptoPrice - networkFee).toFixed(8);
      
      console.log('Calculation results:', {
        effectiveFeePercentage,
        serviceFee,
        networkFeeUSD,
        netAmountUSD,
        cryptoAmount
      });

      // Batch our state updates
      const updates = {
        amounts: {
          serviceFee,
          networkFeeUSD,
          totalAmount: amount.toFixed(2),
          cryptoAmount
        },
        newFeePercentage: effectiveFeePercentage
      };

      // Update states only if they've changed
      if (JSON.stringify(amounts) !== JSON.stringify(updates.amounts)) {
        setAmounts(updates.amounts);
      }
      if (feePercentage !== updates.newFeePercentage) {
        setFeePercentage(updates.newFeePercentage);
      }

    } catch (error) {
      console.error('Error in calculateAmounts:', error);
      // On error, keep using current fee percentage
      const amount = parseFloat(inputAmount);
      const serviceFee = (amount * (feePercentage / 100)).toFixed(2);
      const networkFeeUSD = (networkFee * cryptoPrice).toFixed(2);
      const netAmountUSD = amount - parseFloat(serviceFee) - parseFloat(networkFeeUSD);
      const cryptoAmount = (netAmountUSD / cryptoPrice - networkFee).toFixed(8);
      
      setAmounts({
        serviceFee,
        networkFeeUSD,
        totalAmount: amount.toFixed(2),
        cryptoAmount
      });
    }
  }, [formData.cryptoType, feePercentage, amounts]);

  const getFeePercentage = useCallback(async (amount, cryptoType) => {
    try {
      if (!amount || !cryptoType) return;
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3001/api/exchange/fee-rate`, {
        params: { amount, cryptoType },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.feePercentage) {
        const newFeePercentage = parseFloat(response.data.feePercentage);
        // Only update if the new fee is valid and different
        if (!isNaN(newFeePercentage) && newFeePercentage !== feePercentage) {
          setFeePercentage(newFeePercentage);
          // Recalculate amounts with the new fee percentage
          calculateAmounts(amount, cryptoPrices[cryptoType].price, networkFees[cryptoType]);
        }
      }
    } catch (error) {
      console.error('Error fetching fee percentage:', error);
      // Don't update fee percentage on error, keep the current one
      toast({
        title: 'Warning',
        description: 'Using current fee rate due to server error.',
        status: 'warning',
        duration: 5000,
      });
    }
  }, [calculateAmounts, cryptoPrices, networkFees, feePercentage]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    console.log('Input changed:', { name, value, currentFeePercentage: feePercentage });
    
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    if (name === 'cashAppAmount' || name === 'cryptoType') {
      if (value && cryptoPrices[newFormData.cryptoType]?.price) {
        console.log('Triggering calculation with:', {
          value,
          cryptoPrice: cryptoPrices[newFormData.cryptoType].price,
          networkFee: networkFees[newFormData.cryptoType]
        });
        calculateAmounts(
          value,
          cryptoPrices[newFormData.cryptoType].price,
          networkFees[newFormData.cryptoType]
        );
      }
    }
  }, [formData, calculateAmounts, cryptoPrices, networkFees, feePercentage]);

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
    
    // Validate minimum amount
    if (!formData.cashAppAmount || parseFloat(formData.cashAppAmount) < 10) {
      toast({
        title: 'Minimum Amount Required',
        description: 'The minimum exchange amount is $10',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      const amount = parseFloat(formData.cashAppAmount);
      
      // Exchange fee
      const exchangeFee = (amount * feePercentage / 100).toFixed(2);
      
      // Get current network fee
      const networkFee = networkFees[formData.cryptoType];
      const networkFeeUSD = (networkFee * cryptoPrices[formData.cryptoType].price).toFixed(2);
      
      // Total amount including network fee
      const totalAmount = (amount + parseFloat(networkFeeUSD)).toFixed(2);
      
      // Amount after exchange fee
      const netAmount = (amount - parseFloat(exchangeFee)).toFixed(2);
      
      // Final crypto amount (subtracting network fee)
      const cryptoAmount = (
        (parseFloat(netAmount) / cryptoPrices[formData.cryptoType].price) - networkFee
      ).toFixed(8);

      // Create transaction first
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3001/api/exchange/create',
        {
          cashAppAmount: amount,
          cryptoType: formData.cryptoType,
          walletAddress: formData.walletAddress,
          priceAtSubmission: cryptoPrices[formData.cryptoType].price
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Generate QR code data with calculated values
      const qrData = {
        cashappUsername: 'Greedii1',
        amount: (parseFloat(formData.cashAppAmount) + parseFloat(amounts.serviceFee) + parseFloat(amounts.networkFeeUSD)).toFixed(2),
        exchangeFee: amounts.serviceFee,
        networkFee: amounts.networkFeeUSD,
        netAmount: (parseFloat(formData.cashAppAmount) - parseFloat(amounts.serviceFee)).toFixed(2),
        cryptoAmount: amounts.cryptoAmount,
        cryptoType: formData.cryptoType,
        transactionId: response.data.transaction.id,
        qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chl=https://cash.app/$Greedii1/${(parseFloat(formData.cashAppAmount) + parseFloat(amounts.serviceFee) + parseFloat(amounts.networkFeeUSD)).toFixed(2)}&chs=200x200&chld=L|0`,
        cashAppUrl: `https://cash.app/$Greedii1/${(parseFloat(formData.cashAppAmount) + parseFloat(amounts.serviceFee) + parseFloat(amounts.networkFeeUSD)).toFixed(2)}`,
        feePercentage: feePercentage
      };

      console.log('QR Data:', qrData); // Debug log
      setQrCodeData(qrData);
      setIsQRModalOpen(true);

    } catch (error) {
      console.error('Transaction creation error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create transaction',
        status: 'error',
        duration: 5000,
      });
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

  const handleVerifyPayment = async () => {
    try {
      setVerifyingReceipt(true);
      
      const response = await axios.post(
        'http://localhost:3001/api/exchange/verify-and-complete',
        {
          receiptUrl: receiptUrl,
          amount: parseFloat(formData.cashAppAmount),
          username: qrCodeData.cashappUsername,
          transactionId: qrCodeData.transactionId
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setVerificationStatus('success');
        toast({
          title: 'Payment Verified',
          description: 'Your crypto will be sent shortly',
          status: 'success',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Verification error details:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        qrCodeData,
        receiptUrl
      });
      
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
      
      // Set tickets even if empty array
      setTickets(response.data || []);
    } catch (error) {
      console.error('Ticket fetch error:', error);
      // Set empty array on error
      setTickets([]);
    }
  };

  const handleSubmitTicket = async (ticketData) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Submitting ticket with data:', ticketData);
      
      const response = await axios.post(
        'http://localhost:3001/api/tickets',
        ticketData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Ticket creation response:', response.data);
      await fetchTickets();
      return response.data;
    } catch (error) {
      console.error('Error submitting ticket:', {
        error,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  };

  const handleViewTicket = (ticketId) => {
    console.log('Opening ticket modal for ID:', ticketId);
    setSelectedTicketId(ticketId);
    setIsTicketModalOpen(true);
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

  const handlePaymentCompletion = () => {
    setShowReceiptInput(true);
    setReceiptUrl('');
  };

  const handleNewTransaction = () => {
    setShowReceiptInput(false);
    setReceiptUrl('');
  };

  const handleReceiptUrlChange = async (url) => {
    setReceiptUrl(url);
    setIsValidUrl(url.match(/https:\/\/cash\.app\/payments\/[a-z0-9]+\/receipt/));
    
    if (url.match(/https:\/\/cash\.app\/payments\/[a-z0-9]+\/receipt/)) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:3001/api/exchange/preview-receipt?url=${encodeURIComponent(url)}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setReceiptPreview(response.data);
      } catch (error) {
        console.error('Error fetching receipt preview:', error);
        setReceiptPreview(null);
      }
    } else {
      setReceiptPreview(null);
    }
  };

  const calculateCryptoAmount = (usdAmount, currentRate) => {
    // Convert string to number if needed
    const amount = parseFloat(usdAmount);
    const rate = parseFloat(currentRate);
    
    // Calculate fee
    const feeAmount = amount * 0.22; // 22% fee
    const netAmount = amount - feeAmount;
    
    // Calculate BTC amount
    const btcAmount = netAmount / rate;
    
    // Return formatted to 8 decimal places
    return btcAmount.toFixed(8);
  };

  useEffect(() => {
    const fetchNetworkFees = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/crypto/network-fees');
        setNetworkFees(response.data);
      } catch (error) {
        console.error('Error fetching network fees:', error);
      }
    };

    fetchNetworkFees();
    // Add to your existing interval if you have one
    const interval = setInterval(fetchNetworkFees, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate amounts when input changes
  useEffect(() => {
    if (formData.cashAppAmount && cryptoPrices[formData.cryptoType]?.price) {
      const baseAmount = parseFloat(formData.cashAppAmount);
      // Use current feePercentage instead of hardcoded value
      const serviceFee = (baseAmount * (feePercentage / 100)).toFixed(2);
      const networkFeeUSD = (
        networkFees[formData.cryptoType] * 
        cryptoPrices[formData.cryptoType].price
      ).toFixed(2);
      
      setAmounts({
        serviceFee,
        networkFeeUSD,
        totalAmount: baseAmount.toFixed(2),
        cryptoAmount: (
          (baseAmount - parseFloat(serviceFee)) / 
          cryptoPrices[formData.cryptoType].price - 
          networkFees[formData.cryptoType]
        ).toFixed(8)
      });
    }
  }, [formData.cashAppAmount, formData.cryptoType, cryptoPrices, networkFees, feePercentage]);

  // Add effect to monitor fee percentage changes
  useEffect(() => {
    console.log('Fee percentage changed to:', feePercentage);
  }, [feePercentage]);

  return (
    <Container 
      maxW="container.lg" 
      px={0}
      py={8}
      centerContent
    >
      <Box
        w="full"
        px={{ base: 4, sm: 6, md: 8 }}
        maxW="100%"
      >
        <HStack 
          w="full" 
          justify="flex-end" 
          mb={4}
          spacing={{ base: 2, sm: 4 }}  // Responsive spacing
          flexWrap="wrap"               // Allow wrapping on very small screens
        >
          <IconButton
            icon={<FaTicketAlt />}
            onClick={() => setIsTicketModalOpen(true)}
            colorScheme="purple"
            variant="ghost"
            aria-label="Support Tickets"
            size={{ base: "sm", sm: "md" }}  // Smaller on mobile
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

        <Box
          position="relative"
          w="full"
          textAlign="center"
          py={8}
          mb={8}
        >
          <Heading
            as="h1"
            size="2xl"
            bgGradient="linear(to-r, blue.400, purple.500, pink.500)"
            bgClip="text"
            fontWeight="extrabold"
            letterSpacing="tight"
            textAlign="center"
            position="relative"
            textShadow="0 0 1px rgba(0,0,0,0.1)"
            pb={2}                    // Add padding bottom
            lineHeight={1.4}         // Increase line height
            mb={2}                   // Add margin bottom
            _before={{
              content: '""',
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60px',
              height: '4px',
              borderRadius: 'full',
              bgGradient: 'linear(to-r, blue.400, purple.500)'
            }}
          >
            Instant Crypto Exchange
          </Heading>
          <Text
            mt={4}
            fontSize="lg"
            color="gray.400"
            maxW="2xl"
            mx="auto"
            textAlign="center"
          >
            Fast, Secure & Reliable | BTC • ETH • LTC
          </Text>
          <HStack
            justify="center"
            spacing={{ base: 3, sm: 6 }}
            mt={2}
          >
            <Badge
              colorScheme="blue"
              fontSize="sm"
              px={4}
              py={2}
              borderRadius="full"
              textTransform="none"
              height="auto"
              minH="28px"
              display="flex"
              alignItems="center"
              whiteSpace="nowrap"
            >
              24/7 Support
            </Badge>
            <Badge
              colorScheme="purple"
              fontSize="sm"
              px={4}
              py={2}
              borderRadius="full"
              textTransform="none"
              height="auto"
              minH="28px"
              display="flex"
              alignItems="center"
              whiteSpace="nowrap"
            >
              Instant Transfers
            </Badge>
            <Badge
              colorScheme="pink"
              fontSize="sm"
              px={4}
              py={2}
              borderRadius="full"
              textTransform="none"
              height="auto"
              minH="28px"
              display="flex"
              alignItems="center"
              whiteSpace="nowrap"
            >
              Best Rates
            </Badge>
          </HStack>
        </Box>

        <StatGroup 
          mb={6} 
          display="grid"
          gridTemplateColumns={{ 
            base: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)"
          }}
          gap={{ base: 3, sm: 4 }}      // Adjusted gap for mobile
          w="full"                       // Full width
          mx="auto"                      // Center the grid
        >
          {cryptoOptions.map(({ value, label, icon: CryptoIcon, color }) => (
            <Box
              key={value}
              bg={bgColor}
              p={{ base: 3, sm: 4 }}     // Responsive padding
              borderRadius="lg"
              borderWidth="1px"
              borderColor={borderColor}
              width="100%"
            >
              <HStack spacing={4} align="center">
                <CryptoIcon size={24} color={color} />
                <VStack align="start" spacing={0}>
                  <Text fontSize={{ base: "sm", sm: "md" }} color="gray.400">
                    {label}
                  </Text>
                  {cryptoPrices[value]?.price ? (
                    <>
                      <Text fontWeight="bold" fontSize={{ base: "md", sm: "lg" }}>
                        ${cryptoPrices[value].price.toLocaleString()}
                      </Text>
                      <Text
                        fontSize={{ base: "xs", sm: "sm" }}
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

        <VStack spacing={4} align="stretch" w="full">
          <Box
            as="form"
            onSubmit={handleSubmit}
            w="full"
            bg={bgColor}
            p={{ base: 4, sm: 6, md: 8 }}  // Responsive padding
            borderRadius="xl"
            borderWidth={1}
            borderColor={borderColor}
            boxShadow="2xl"
            mx="auto"                       // Center the form
            maxW="container.md"            // Maximum width for larger screens
            transition="all 0.3s"
            _hover={{ transform: 'translateY(-2px)', boxShadow: '3xl' }}
          >
            <VStack spacing={6} align="stretch">
              <FormControl isRequired>
                <FormLabel 
                  fontSize="sm" 
                  fontWeight="medium" 
                  color="gray.300"
                  mb={2}
                >
                  Amount
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement 
                    pointerEvents="none" 
                    color="gray.500" 
                    fontSize="lg" 
                    children={<BiDollar />} 
                  />
                  <Input
                    name="cashAppAmount"
                    type="number"
                    step="0.01"
                    value={formData.cashAppAmount}
                    onChange={handleInputChange}
                    placeholder="Enter amount"
                    bg="gray.900"
                    border="2px solid"
                    borderColor="gray.700"
                    _hover={{ borderColor: "gray.600" }}
                    _focus={{ 
                      borderColor: "blue.400",
                      boxShadow: "0 0 0 1px #4299E1"
                    }}
                    fontSize="lg"
                    height="56px"
                  />
                </InputGroup>
                <Text fontSize="xs" color="gray.400" mt={1}>
                  Minimum amount: $10
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel 
                  fontSize="sm" 
                  fontWeight="medium" 
                  color="gray.300"
                  mb={2}
                >
                  Select Cryptocurrency
                </FormLabel>
                <Select
                  name="cryptoType"
                  value={formData.cryptoType}
                  onChange={handleInputChange}
                  bg="gray.900"
                  color="white"
                  border="2px solid"
                  borderColor="gray.700"
                  _hover={{ borderColor: "gray.600" }}
                  _focus={{ 
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px #4299E1"
                  }}
                  fontSize="lg"
                  height="56px"
                  icon={<FaChevronDown />}
                >
                  {cryptoOptions.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{ 
                        backgroundColor: '#1A202C', 
                        color: 'white',
                        padding: '12px'
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel 
                  fontSize="sm" 
                  fontWeight="medium" 
                  color="gray.300"
                  mb={2}
                >
                  Wallet Address
                </FormLabel>
                <Input
                  name="walletAddress"
                  value={formData.walletAddress}
                  onChange={handleInputChange}
                  placeholder={`Enter your ${formData.cryptoType} wallet address`}
                  bg="gray.900"
                  border="2px solid"
                  borderColor="gray.700"
                  _hover={{ borderColor: "gray.600" }}
                  _focus={{ 
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px #4299E1"
                  }}
                  fontSize="lg"
                  height="56px"
                />
              </FormControl>

              <Divider />

              <Box w="full" bg="gray.800" borderRadius="xl" p={6} boxShadow="xl">
                <VStack spacing={6} align="stretch">
                  <Heading 
                    size="md" 
                    color="white"
                    textAlign="center"
                    mb={6}
                  >
                    Exchange Summary
                  </Heading>

                  {formData.cashAppAmount ? (
                    <VStack spacing={6}>
                      {/* Main Exchange Info */}
                      <Grid templateColumns="repeat(2, 1fr)" gap={6} w="full">
                        {/* You Send */}
                        <GridItem>
                          <Box
                            bg="gray.900"
                            p={5}
                            borderRadius="xl"
                            borderWidth="1px"
                            borderColor="gray.700"
                            textAlign="center"
                          >
                            <Text color="gray.400" fontSize="sm" mb={2}>You Send</Text>
                            <Text fontSize="3xl" fontWeight="bold" color="white">
                              ${parseFloat(formData.cashAppAmount).toLocaleString()}
                            </Text>
                            <Badge colorScheme="gray" mt={2}>USD via CashApp</Badge>
                          </Box>
                        </GridItem>

                        {/* You Receive */}
                        <GridItem>
                          <Box
                            bg="gray.900"
                            p={5}
                            borderRadius="xl"
                            borderWidth="1px"
                            borderColor="gray.700"
                            textAlign="center"
                          >
                            <Text color="gray.400" fontSize="sm" mb={2}>You Receive</Text>
                            <Text 
                              fontSize={{ base: "2xl", sm: "3xl" }}  // Smaller font on mobile
                              fontWeight="bold" 
                              color="white"
                              noOfLines={1}  // Prevent wrapping
                              overflow="hidden"
                              textOverflow="ellipsis"  // Show ellipsis if text overflows
                            >
                              {amounts.cryptoAmount}
                            </Text>
                            <Badge colorScheme="blue" mt={2}>{formData.cryptoType}</Badge>
                          </Box>
                        </GridItem>
                      </Grid>

                      {/* Exchange Rate */}
                      <Box
                        bg="gray.900"
                        p={5}
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="gray.700"
                        w="full"
                      >
                        <HStack justify="space-between" align="center">
                          <VStack align="start" spacing={1}>
                            <Text color="gray.400" fontSize="sm">Exchange Rate</Text>
                            <Text fontSize="xl" fontWeight="bold" color="white">
                              1 {formData.cryptoType} = ${cryptoPrices[formData.cryptoType]?.price.toLocaleString()}
                            </Text>
                          </VStack>
                          <HStack spacing={2} align="center">
                            <Icon 
                              as={cryptoPrices[formData.cryptoType]?.change24h >= 0 ? "▲" : "▼"}
                              color={cryptoPrices[formData.cryptoType]?.change24h >= 0 ? "green.400" : "red.400"}
                            />
                            <Text
                              fontSize="md"
                              color={cryptoPrices[formData.cryptoType]?.change24h >= 0 ? "green.400" : "red.400"}
                            >
                              {Math.abs(cryptoPrices[formData.cryptoType]?.change24h).toFixed(2)}%
                            </Text>
                            <Badge colorScheme="gray">24h</Badge>
                          </HStack>
                        </HStack>
                      </Box>

                      {/* Fee Breakdown */}
                      <Box
                        bg="gray.900"
                        p={5}
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="gray.700"
                        w="full"
                      >
                        <Text color="gray.400" fontSize="sm" mb={4}>Fee Breakdown</Text>
                        <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                          <GridItem>
                            <VStack align="center" spacing={1}>
                              <Text fontSize="sm" color="gray.400">Service Fee</Text>
                              <Text fontSize="lg" fontWeight="semibold" color="yellow.400">
                                ${amounts.serviceFee}
                              </Text>
                              <Badge colorScheme="yellow" size="sm">
                                {feePercentage.toFixed(1)}%
                              </Badge>
                            </VStack>
                          </GridItem>
                          <GridItem>
                            <VStack align="center" spacing={1}>
                              <Text fontSize="sm" color="gray.400">Network Fee</Text>
                              <Text fontSize="lg" fontWeight="semibold" color="orange.400">
                                ${amounts.networkFeeUSD}
                              </Text>
                              <Badge colorScheme="orange" size="sm">
                                {networkFees[formData.cryptoType]} {formData.cryptoType}
                              </Badge>
                            </VStack>
                          </GridItem>
                          <GridItem>
                            <VStack align="center" spacing={1}>
                              <Text fontSize="sm" color="gray.400">Total Fees</Text>
                              <Text fontSize="lg" fontWeight="semibold" color="blue.400">
                                ${(parseFloat(amounts.serviceFee) + parseFloat(amounts.networkFeeUSD)).toFixed(2)}
                              </Text>
                              <Badge colorScheme="blue" size="sm">Combined</Badge>
                            </VStack>
                          </GridItem>
                        </Grid>
                      </Box>

                      {/* Total Amount */}
                      <Box
                        bg="green.900"
                        p={5}
                        borderRadius="xl"
                        borderWidth="2px"
                        borderColor="green.700"
                        w="full"
                        textAlign="center"
                      >
                        <Text color="green.100" fontSize="sm" mb={2}>Total Amount to Send</Text>
                        <Text fontSize="4xl" fontWeight="bold" color="green.400">
                          ${(parseFloat(formData.cashAppAmount) + parseFloat(amounts.serviceFee) + parseFloat(amounts.networkFeeUSD)).toFixed(2)}
                        </Text>
                        <Text fontSize="sm" color="green.200" mt={2}>
                          Send exactly this amount via CashApp
                        </Text>
                      </Box>
                    </VStack>
                  ) : (
                    <Text color="gray.400" textAlign="center" py={4}>
                      Enter an amount to see the exchange details
                    </Text>
                  )}
                </VStack>
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

        <QRCodeModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          qrCodeData={qrCodeData}
          onVerify={handlePaymentCompletion}
          feePercentage={feePercentage}
        />

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

        {exchangeDetails.amount > 0 && (
          <VStack spacing={2} align="stretch" mt={4}>
            <Text fontSize="sm" color="gray.400">
              Exchange Details
            </Text>
            <HStack justify="space-between">
              <Text>Fee Amount:</Text>
              <Text>${exchangeDetails.feeAmount}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text>Net Amount:</Text>
              <Text>${exchangeDetails.netAmount}</Text>
            </HStack>
            {exchangeDetails.cached && (
              <Badge colorScheme="blue" alignSelf="start">
                Cached Rate
              </Badge>
            )}
          </VStack>
        )}

      </Box>
    </Container>
  );
};

export default CryptoExchange; 