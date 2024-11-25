import {
  Box,
  VStack,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Input,
  FormControl,
  FormLabel,
  useToast,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Badge,
  SimpleGrid,
  Icon,
  Select,
  Textarea,
  Divider,
  Progress,
  CircularProgress,
  CircularProgressLabel,
  Tooltip,
  Grid,
  Flex,
  Collapse,
  Stack,
  Container,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FaCrown, FaUsers, FaPercent, FaDollarSign, FaCog, FaChartLine, FaExchangeAlt, FaUserCheck, FaChartPie, FaArrowUp, FaArrowDown, FaClock, FaCheckCircle, FaBitcoin, FaEthereum, FaUserPlus, FaBell, FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaPause, FaSync, FaBan, FaPlay } from 'react-icons/fa';
import { SiLitecoin, SiDogecoin, SiMonero } from 'react-icons/si';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import FeeManagement from './FeeManagement';
import { ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';

const CRYPTO_CONFIG = {
  BTC: {
    icon: FaBitcoin,
    color: '#F7931A',
    gradient: 'linear(to-r, #F7931A, #FFAB2E)'
  },
  ETH: {
    icon: FaEthereum,
    color: '#627EEA',
    gradient: 'linear(to-r, #627EEA, #8CA2FF)'
  },
  LTC: {
    icon: SiLitecoin,
    color: '#345D9D',
    gradient: 'linear(to-r, #345D9D, #4F7BC2)'
  },
  DOGE: {
    icon: SiDogecoin,
    color: '#C2A633',
    gradient: 'linear(to-r, #C2A633, #E1C158)'
  },
  XMR: {
    icon: SiMonero,
    color: '#FF6B00',
    gradient: 'linear(to-r, #FF6B00, #FF8B3D)'
  }
};

const WALLET_CONFIG = {
  BTC: {
    icon: FaBitcoin,
    color: '#F7931A',
    gradient: 'linear(to-r, #F7931A, #FFAB2E)',
    maxBalance: 1.0 // Example max balance for progress bar
  },
  ETH: {
    icon: FaEthereum,
    color: '#627EEA',
    gradient: 'linear(to-r, #627EEA, #8CA2FF)',
    maxBalance: 10.0
  },
  LTC: {
    icon: SiLitecoin,
    color: '#345D9D',
    gradient: 'linear(to-r, #345D9D, #4F7BC2)',
    maxBalance: 50.0
  }
};

const StatsCard = ({ label, value: rawValue, change: rawChange, icon: Icon }) => {
  // Extract values from objects if needed
  const value = typeof rawValue === 'object' ? rawValue.value : rawValue;
  const change = typeof rawChange === 'object' ? rawChange.change : rawChange;

  return (
    <Box
      bg="whiteAlpha.50"
      p={4}
      borderRadius="lg"
      borderWidth="1px"
      borderColor="whiteAlpha.100"
    >
      <HStack justify="space-between" mb={2}>
        <Icon color="blue.400" fontSize="20px" />
        <Badge 
          colorScheme={parseFloat(change || 0) >= 0 ? 'green' : 'red'}
          variant="subtle"
        >
          {change || '0'}%
        </Badge>
      </HStack>
      <Text color="gray.400" fontSize="sm">{label}</Text>
      <Text fontSize="2xl" fontWeight="bold">
        {value?.toString() || '0'}
      </Text>
    </Box>
  );
};

const StatBox = ({ icon: Icon, title, children }) => (
  <Box
    bg="gray.800"
    p={6}
    borderRadius="xl"
    borderWidth="1px"
    borderColor="gray.700"
    boxShadow="xl"
    mb={6}
  >
    <HStack mb={6} spacing={4}>
      <Icon fontSize="24px" color="blue.400" />
      <Heading size="md">{title}</Heading>
    </HStack>
    {children}
  </Box>
);

const AdminPanel = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalVolume: 0,
  });
  const [settings, setSettings] = useState({
    feePercentage: 22,
    cashappUsername: '',
  });
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure();
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTransactions, setUserTransactions] = useState([]);
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const [extendedStats, setExtendedStats] = useState({
    dailyActiveUsers: { value: 0, change: '0' },
    weeklyGrowth: { value: 0, change: '0' },
    successRate: { value: 0, change: '0' },
    pendingTransactions: 0,
    recentActivity: [],
    volumeByDay: [],
    topCryptos: [],
    currentOnline: 0,
    lastHourTransactions: 0,
    averageTransactionSize: 0,
    peakHourVolume: 0,
    conversionRate: 0,
    newUsersToday: 0,
    repeatUsers: 0,
    averageResponseTime: 0,
  });

  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Initialize all sections as collapsed (false)
  const [openSections, setOpenSections] = useState({
    platform: false,  // Start collapsed
    users: false,     // Start collapsed
    fees: false       // Start collapsed
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await fetchData();
        await fetchExtendedStats();
        setupWebSocket();
      }
    };

    init();

    const statsInterval = setInterval(() => {
      if (mounted) {
        fetchExtendedStats();
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(statsInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const setupWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const ws = new WebSocket('ws://localhost:3001/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        // Send an initial authentication message
        ws.send(JSON.stringify({
          type: 'AUTH',
          token: localStorage.getItem('token')
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWsConnected(false);
        
        // Only attempt to reconnect on abnormal closures
        if (event.code === 1006 || event.code === 1005) {
          console.log('Attempting to reconnect...');
          setTimeout(setupWebSocket, 5000); // Increased retry delay
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't close here, let the onclose handler handle reconnection
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setTimeout(setupWebSocket, 5000);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'NEW_TRANSACTION':
        // Update transactions and stats
        fetchData();
        fetchExtendedStats();
        toast({
          title: 'New Transaction',
          description: 'A new transaction has been created',
          status: 'info',
          duration: 3000,
        });
        break;

      case 'TRANSACTION_STATUS_CHANGE':
        // Update transaction status
        if (selectedUser) {
          handleViewDetails(selectedUser);
        }
        fetchExtendedStats();
        toast({
          title: 'Transaction Updated',
          description: `Transaction status changed to ${data.status}`,
          status: 'info',
          duration: 3000,
        });
        break;

      case 'USER_UPDATE':
        // Refresh user data
        fetchData();
        toast({
          title: 'User Updated',
          description: 'User information has been updated',
          status: 'info',
          duration: 3000,
        });
        break;

      case 'SETTINGS_UPDATE':
        // Refresh settings
        fetchData();
        toast({
          title: 'Settings Updated',
          description: 'Platform settings have been updated',
          status: 'info',
          duration: 3000,
        });
        break;

      case 'WALLET_UPDATE':
        setExtendedStats(prev => ({
          ...prev,
          walletBalances: data.balances
        }));
        checkLowBalances(data.balances);
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  // Add WebSocket connection indicator to the UI
  const ConnectionStatus = () => (
    <HStack spacing={2} position="absolute" top={4} right={4}>
      <Box
        w={3}
        h={3}
        borderRadius="full"
        bg={wsConnected ? "green.500" : "red.500"}
      />
      <Text fontSize="sm" color={wsConnected ? "green.500" : "red.500"}>
        {wsConnected ? "Connected" : "Disconnected"}
      </Text>
    </HStack>
  );

  const fetchExtendedStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/admin/extended-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setExtendedStats({
        dailyActiveUsers: response.data.dailyActiveUsers || { value: 0, change: '0' },
        weeklyGrowth: response.data.weeklyGrowth || { value: 0, change: '0' },
        successRate: response.data.successRate || { value: 0, change: '0' },
        pendingTransactions: response.data.pendingTransactions || 0,
        recentActivity: response.data.recentActivity || [],
        volumeByDay: response.data.volumeByDay || [],
        topCryptos: response.data.topCryptos || [],
        currentOnline: response.data.currentOnline || 0,
        lastHourTransactions: response.data.lastHourTransactions || 0,
        averageTransactionSize: response.data.averageTransactionSize || 0,
        peakHourVolume: response.data.peakHourVolume || 0,
        conversionRate: response.data.conversionRate || 0,
        newUsersToday: response.data.newUsersToday || 0,
        repeatUsers: response.data.repeatUsers || 0,
        averageResponseTime: response.data.averageResponseTime || 0,
      });
    } catch (error) {
      console.error('Error fetching extended stats:', error);
      setExtendedStats({
        dailyActiveUsers: { value: 0, change: '0' },
        weeklyGrowth: { value: 0, change: '0' },
        successRate: { value: 0, change: '0' },
        pendingTransactions: 0,
        recentActivity: [],
        volumeByDay: [],
        topCryptos: [],
        currentOnline: 0,
        lastHourTransactions: 0,
        averageTransactionSize: 0,
        peakHourVolume: 0,
        conversionRate: 0,
        newUsersToday: 0,
        repeatUsers: 0,
        averageResponseTime: 0,
      });
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [usersRes, statsRes, settingsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3001/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3001/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setUsers(usersRes.data);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch data',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const updateSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Show loading state
      const loadingToast = toast({
        title: 'Saving changes...',
        status: 'loading',
        duration: null,
      });

      const response = await axios.post(
        'http://localhost:3001/api/admin/settings',
        {
          key: 'cashappUsername',
          value: settings.cashappUsername
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Close loading toast and show success
      toast.close(loadingToast);
      toast({
        title: 'Settings saved',
        description: 'CashApp username has been updated',
        status: 'success',
        duration: 3000,
      });

    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update settings',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleViewDetails = async (user) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3001/api/admin/users/${user.id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedUser(user);
      setUserTransactions(response.data);
      onDetailsOpen();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load user transactions',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleConfirmTransaction = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3001/api/admin/transactions/${transactionId}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh transactions after confirmation
      const response = await axios.get(
        `http://localhost:3001/api/admin/users/${selectedUser.id}/transactions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserTransactions(response.data);
      
      toast({
        title: 'Success',
        description: 'Transaction confirmed and crypto sent',
        status: 'success',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to confirm transaction',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      console.log('New role selected:', newRole);
      
      await axios.put(`http://localhost:3001/api/admin/users/${userId}/role`, 
        { role: newRole.toLowerCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh users list
      fetchData();
      
      toast({
        title: 'Success',
        description: 'User role updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update user role',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const [recentActivity] = useState([
    {
      type: 'transaction',
      description: 'New transaction: 0.5 BTC',
      time: '2 minutes ago',
      status: 'completed'
    },
    {
      type: 'user',
      description: 'New user registration',
      time: '5 minutes ago',
      status: 'pending'
    },
    {
      type: 'transaction',
      description: 'Withdrawal request: 2.3 ETH',
      time: '10 minutes ago',
      status: 'pending'
    },
    // Add more activity items as needed
  ]);

  const [alerts, setAlerts] = useState({
    sqlInjection: [],
    highTicketVolume: [],
    bitgoWallet: { status: 'connected', lastCheck: null },
    highTransactionVolume: [],
    unusualActivity: [],
    lowBalance: []
  });

  const [exchangesPaused, setExchangesPaused] = useState(false);

  const checkForAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/admin/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlerts(prev => ({
        ...prev,
        sqlInjection: response.data.sqlInjection || [],
        highTicketVolume: response.data.highTicketVolume || [],
        bitgoWallet: response.data.bitgoWallet || { status: 'connected', lastCheck: null },
        highTransactionVolume: response.data.highTransactionVolume || [],
        unusualActivity: response.data.unusualActivity || [],
      }));

    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const toggleExchangePause = async () => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = !exchangesPaused;
      
      await axios.post('http://localhost:3001/api/admin/toggle-exchange', 
        { paused: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExchangesPaused(newStatus);
      toast({
        title: newStatus ? 'Exchanges Paused' : 'Exchanges Resumed',
        description: newStatus ? 'All exchanges are now paused' : 'Exchanges have been resumed',
        status: 'info',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle exchange status',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const checkLowBalances = (walletBalances) => {
    const threshold = 200; // $200 threshold
    const newLowBalanceAlerts = [];

    Object.entries(walletBalances).forEach(([crypto, data]) => {
      // Get current price from your existing price data
      const price = extendedStats.cryptoPrices?.[crypto] || 0;
      const usdValue = data.balance * price;

      if (usdValue < threshold) {
        newLowBalanceAlerts.push({
          crypto,
          balance: data.balance,
          usdValue,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Update alerts with new low balance warnings
    setAlerts(prev => ({
      ...prev,
      lowBalance: newLowBalanceAlerts
    }));
  };

  return (
    <Box maxW="1400px" mx="auto" px={6} py={8} position="relative">
      <ConnectionStatus />
      <Box
        bg="gray.800"
        p={8}
        borderRadius="2xl"
        mb={8}
        boxShadow="2xl"
        borderWidth="1px"
        borderColor="gray.700"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          top="0"
          right="0"
          width="400px"
          height="100%"
          bgGradient="linear(to-r, transparent, purple.500)"
          opacity="0.1"
          transform="skew(-45deg)"
        />
        
        <HStack justify="space-between" align="center" mb={6}>
          <VStack align="start" spacing={3}>
            <HStack spacing={4}>
              <Icon as={FaCrown} boxSize={10} color="yellow.400" />
              <Heading 
                size="2xl" 
                bgGradient="linear(to-r, blue.400, purple.500, pink.500)" 
                bgClip="text"
                letterSpacing="tight"
              >
                Admin Dashboard
              </Heading>
            </HStack>
            <Text color="gray.400" fontSize="lg" maxW="600px">
              Comprehensive overview of your platform's performance and user activity
            </Text>
          </VStack>
          <Button
            onClick={onClose}
            colorScheme="blue"
            size="lg"
            leftIcon={<Icon as={FaUsers} />}
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: 'lg',
            }}
            transition="all 0.2s"
          >
            Back to Exchange
          </Button>
        </HStack>

        <StatBox icon={FaChartLine} title="Platform Analytics">
          {/* Main Stats Row */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
            <Box
              bg="whiteAlpha.50"
              p={6}
              borderRadius="xl"
              borderWidth="1px"
              borderColor="whiteAlpha.100"
              transition="all 0.3s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'xl' }}
            >
              <VStack spacing={1} align="start">
                <HStack spacing={3}>
                  <Icon as={FaUsers} color="blue.400" boxSize={6} />
                  <Text fontSize="lg" color="gray.400">Total Users</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold">
                  {stats.totalUsers.toLocaleString()}
                </Text>
                <Text fontSize="sm" color="gray.500">Active accounts</Text>
              </VStack>
            </Box>

            <Box
              bg="whiteAlpha.50"
              p={6}
              borderRadius="xl"
              borderWidth="1px"
              borderColor="whiteAlpha.100"
              transition="all 0.3s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'xl' }}
            >
              <VStack spacing={1} align="start">
                <HStack spacing={3}>
                  <Icon as={FaExchangeAlt} color="green.400" boxSize={6} />
                  <Text fontSize="lg" color="gray.400">Total Transactions</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold">
                  {stats.totalTransactions.toLocaleString()}
                </Text>
                <Text fontSize="sm" color="gray.500">Completed exchanges</Text>
              </VStack>
            </Box>

            <Box
              bg="whiteAlpha.50"
              p={6}
              borderRadius="xl"
              borderWidth="1px"
              borderColor="whiteAlpha.100"
              transition="all 0.3s"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'xl' }}
            >
              <VStack spacing={1} align="start">
                <HStack spacing={3}>
                  <Icon as={FaDollarSign} color="yellow.400" boxSize={6} />
                  <Text fontSize="lg" color="gray.400">Total Volume</Text>
                </HStack>
                <Text fontSize="3xl" fontWeight="bold">
                  ${stats.totalVolume.toLocaleString()}
                </Text>
                <Text fontSize="sm" color="gray.500">USD exchanged</Text>
              </VStack>
            </Box>
          </SimpleGrid>

          {/* Detailed Stats Grid */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">Quick Stats</Heading>
              <SimpleGrid 
                columns={{ base: 1, sm: 2, md: 3, lg: 3 }}
                spacing={{ base: 4, md: 6 }}
                w="full"
              >
                <StatsCard
                  label="Daily Active Users"
                  value={extendedStats.dailyActiveUsers?.value}
                  change={extendedStats.dailyActiveUsers?.change}
                  icon={FaUsers}
                />
                <StatsCard
                  label="Currently Online"
                  value={extendedStats.currentOnline?.value}
                  change={extendedStats.currentOnline?.change}
                  icon={FaUserCheck}
                />
                <StatsCard
                  label="Success Rate"
                  value={`${extendedStats.successRate?.value || 0}%`}
                  change={extendedStats.successRate?.change}
                  icon={FaCheckCircle}
                />
                <StatsCard
                  label="Response Time"
                  value={`${extendedStats.averageResponseTime?.value || 0}m`}
                  change={extendedStats.averageResponseTime?.change}
                  icon={FaClock}
                />
                <StatsCard
                  label="Peak Hour Volume"
                  value={`$${(extendedStats.peakVolume?.value || 0).toLocaleString()}`}
                  change={extendedStats.peakVolume?.change}
                  icon={FaChartPie}
                />
                <StatsCard
                  label="Avg Transaction"
                  value={`$${(extendedStats.averageTransactionSize?.value || 0).toLocaleString()}`}
                  change={extendedStats.averageTransactionSize?.change}
                  icon={FaExchangeAlt}
                />
              </SimpleGrid>
            </VStack>

            {/* Middle Column */}
            <VStack align="stretch" spacing={4}>
              {/* Crypto Wallets */}
              <Box>
                {Object.entries(WALLET_CONFIG).map(([crypto, config]) => {
                  const balance = extendedStats.walletBalances?.[crypto] || 0;
                  const percentage = (balance / config.maxBalance) * 100;
                  
                  return (
                    <Box key={crypto} mb={3}>
                      <HStack justify="space-between" mb={2}>
                        <HStack>
                          <Icon as={config.icon} boxSize={5} color={config.color} />
                          <Text fontSize="sm">{crypto}</Text>
                        </HStack>
                        <Text fontSize="sm" fontWeight="bold">
                          {balance.toFixed(8)} {crypto}
                        </Text>
                      </HStack>
                      <Progress
                        value={percentage}
                        size="sm"
                        borderRadius="full"
                        bgGradient={config.gradient}
                        sx={{
                          '& > div': {
                            background: config.gradient,
                            transition: 'width 0.3s ease-in-out'
                          },
                          bg: 'whiteAlpha.100'
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </VStack>

            {/* Right Column */}
            <VStack align="stretch" spacing={4}>
              {/* Transaction Status */}
              <Heading size="sm" color="gray.400">Transaction Status</Heading>
              <SimpleGrid columns={2} spacing={4}>
                <StatsCard
                  label="Pending"
                  value={extendedStats.pendingTransactions}
                  change="0"
                  icon={FaClock}
                />
                <StatsCard
                  label="Last Hour"
                  value={extendedStats.lastHourTransactions}
                  change="+15.3"
                  icon={FaExchangeAlt}
                />
              </SimpleGrid>

              {/* Recent Alerts */}
              <Box>
                <Heading size="sm" color="gray.400" mb={4}>Recent Alerts</Heading>
                <VStack spacing={3}>
                  {alerts.lowBalance.map((alert, index) => (
                    <HStack 
                      key={`balance-${index}`}
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="red.400"
                    >
                      <Icon as={FaExclamationCircle} color="red.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">
                          Low {alert.crypto} Balance: ${alert.usdValue.toFixed(2)}
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                          {new Date(alert.timestamp).toLocaleString()}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}

                  {alerts.sqlInjection.map((alert, index) => (
                    <HStack 
                      key={`sql-${index}`}
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="red.400"
                    >
                      <Icon as={FaExclamationCircle} color="red.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">SQL Injection Attempt Detected</Text>
                        <Text fontSize="xs" color="gray.400">{new Date(alert.timestamp).toLocaleString()}</Text>
                      </VStack>
                    </HStack>
                  ))}

                  {alerts.highTransactionVolume.map((alert, index) => (
                    <HStack 
                      key={`volume-${index}`}
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="yellow.400"
                    >
                      <Icon as={FaExclamationTriangle} color="yellow.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">High Transaction Volume - User: {alert.username}</Text>
                        <Text fontSize="xs" color="gray.400">{new Date(alert.timestamp).toLocaleString()}</Text>
                      </VStack>
                    </HStack>
                  ))}

                  {alerts.bitgoWallet.status !== 'connected' && (
                    <HStack 
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="red.400"
                    >
                      <Icon as={FaExclamationCircle} color="red.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">BitGo Wallet Connection Lost</Text>
                        <Text fontSize="xs" color="gray.400">
                          {new Date(alerts.bitgoWallet.lastCheck).toLocaleString()}
                        </Text>
                      </VStack>
                    </HStack>
                  )}

                  {alerts.highTicketVolume.map((alert, index) => (
                    <HStack 
                      key={`ticket-${index}`}
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="yellow.400"
                    >
                      <Icon as={FaExclamationTriangle} color="yellow.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">High Support Ticket Volume</Text>
                        <Text fontSize="xs" color="gray.400">{new Date(alert.timestamp).toLocaleString()}</Text>
                      </VStack>
                    </HStack>
                  ))}

                  {alerts.unusualActivity.map((alert, index) => (
                    <HStack 
                      key={`unusual-${index}`}
                      w="full" 
                      p={2} 
                      bg="whiteAlpha.50" 
                      borderRadius="md"
                      borderLeft="4px solid" 
                      borderLeftColor="orange.400"
                    >
                      <Icon as={FaExclamationTriangle} color="orange.400" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm">Unusual Activity - User: {alert.username}</Text>
                        <Text fontSize="xs" color="gray.400">{new Date(alert.timestamp).toLocaleString()}</Text>
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              </Box>

              {/* New: Quick Actions */}
              <Box mb={6}>
                <Heading size="md" mb={4}>Quick Actions</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Button
                    leftIcon={exchangesPaused ? <FaPlay /> : <FaPause />}
                    colorScheme={exchangesPaused ? "green" : "red"}
                    onClick={toggleExchangePause}
                    size="lg"
                    width="full"
                  >
                    {exchangesPaused ? "Resume Exchanges" : "Pause Exchanges"}
                  </Button>
                </SimpleGrid>
              </Box>

              {/* Add the alerts section */}
              <Box mb={6}>
                <Heading size="md" mb={4}>Active Alerts</Heading>
                <VStack spacing={4} align="stretch">
                  {alerts.sqlInjection.length > 0 && (
                    <Alert status="error">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>SQL Injection Attempts Detected</AlertTitle>
                        <AlertDescription>
                          {alerts.sqlInjection.length} suspicious requests detected
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {alerts.bitgoWallet.status !== 'connected' && (
                    <Alert status="error">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>BitGo Wallet Disconnected</AlertTitle>
                        <AlertDescription>
                          Wallet connection lost at {new Date(alerts.bitgoWallet.lastCheck).toLocaleString()}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {alerts.highTicketVolume.length > 0 && (
                    <Alert status="warning">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>High Ticket Volume</AlertTitle>
                        <AlertDescription>
                          Unusual number of support tickets in the last hour
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {alerts.highTransactionVolume.length > 0 && (
                    <Alert status="warning">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>High Transaction Volume</AlertTitle>
                        <AlertDescription>
                          Unusual transaction volume detected for {alerts.highTransactionVolume.length} users
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {alerts.unusualActivity.length > 0 && (
                    <Alert status="warning">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>Unusual Activity Detected</AlertTitle>
                        <AlertDescription>
                          {alerts.unusualActivity.length} accounts flagged for unusual patterns
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                </VStack>
              </Box>
            </VStack>
          </SimpleGrid>

          {/* Activity Timeline */}
          <VStack mt={8} align="stretch" spacing={4}>
            <Heading size="sm" color="gray.400">Recent Activity</Heading>
            <Box maxH="200px" overflowY="auto">
              {extendedStats.recentActivity.length > 0 ? (
                extendedStats.recentActivity.map((activity, index) => (
                  <HStack key={index} justify="space-between" p={2} _hover={{ bg: "whiteAlpha.100" }}>
                    <HStack>
                      <Icon
                        as={activity.type === 'exchange' ? FaExchangeAlt : activity.type === 'purchase' ? FaArrowUp : FaArrowDown}
                        color={activity.type === 'exchange' ? 'blue.400' : activity.type === 'purchase' ? 'green.400' : 'red.400'}
                      />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm">{activity.type === 'exchange' ? 'Exchange' : activity.type === 'purchase' ? 'Purchase' : 'Sale'}</Text>
                        <Text fontSize="xs" color="gray.500">{activity.crypto}</Text>
                      </VStack>
                    </HStack>
                    <VStack align="end" spacing={0}>
                      <Text fontSize="sm">${activity.amount}</Text>
                      <Text fontSize="xs" color="gray.500">{activity.time}</Text>
                    </VStack>
                  </HStack>
                ))
              ) : (
                <Text color="gray.500">No recent activity</Text>
              )}
            </Box>
          </VStack>
        </StatBox>
      </Box>

      <StatBox icon={FaCog} title="Platform Settings">
        <FeeManagement />
        <Divider my={6} />
        <VStack spacing={4} align="stretch">
          <FormControl>
            <FormLabel color="gray.300">CashApp Username</FormLabel>
            <HStack spacing={4}>
              <Input
                value={settings.cashappUsername}
                onChange={(e) => setSettings({ ...settings, cashappUsername: e.target.value })}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.100"
                _hover={{ borderColor: "blue.400" }}
                _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #4299E1" }}
              />
              <Button
                colorScheme="blue"
                onClick={updateSettings}
                leftIcon={<FaCheckCircle />}
                isDisabled={settings.cashappUsername === ''}
                minW="120px"
              >
                Save
              </Button>
            </HStack>
            <Text fontSize="sm" color="gray.500" mt={1}>
              This username will be displayed to users during transactions
            </Text>
          </FormControl>
        </VStack>
      </StatBox>

      <StatBox icon={FaUsers} title="User Management">
        <Box overflowX="auto">
          {users && users.length > 0 ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th borderColor="whiteAlpha.100" color="gray.300">Username</Th>
                  <Th borderColor="whiteAlpha.100" color="gray.300">Role</Th>
                  <Th borderColor="whiteAlpha.100" color="gray.300">Total Exchanged</Th>
                  <Th borderColor="whiteAlpha.100" color="gray.300">Joined</Th>
                  <Th borderColor="whiteAlpha.100" color="gray.300">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => (
                  <Tr key={user.id} _hover={{ bg: "whiteAlpha.50" }}>
                    <Td borderColor="whiteAlpha.100">{user.username}</Td>
                    <Td borderColor="whiteAlpha.100">
                      <Select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        isDisabled={user.role === 'owner'}
                        bg="whiteAlpha.50"
                        borderColor="whiteAlpha.100"
                        _hover={{ borderColor: "blue.400" }}
                      >
                        <option value="user">User</option>
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </Select>
                    </Td>
                    <Td borderColor="whiteAlpha.100">${user.total_exchanged?.toLocaleString()}</Td>
                    <Td borderColor="whiteAlpha.100">{new Date(user.created_at).toLocaleDateString()}</Td>
                    <Td borderColor="whiteAlpha.100">
                      <Button
                        size="sm"
                        bgGradient="linear(to-r, blue.400, blue.600)"
                        _hover={{
                          bgGradient: "linear(to-r, blue.300, blue.500)",
                          transform: 'translateY(-2px)',
                        }}
                        onClick={() => handleViewDetails(user)}
                      >
                        View Details
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Text>No users found</Text>
          )}
        </Box>
      </StatBox>

      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="4xl">
        <ModalOverlay />
        <ModalContent bg="gray.800" maxW="1200px">
          <ModalHeader>
            {selectedUser?.username}'s Transactions
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Box 
              bg="gray.800" 
              borderRadius="lg" 
              borderWidth="1px" 
              borderColor="gray.700"
              w="full"
            >
              <Table variant="simple" size="md">
                <Thead>
                  <Tr>
                    <Th borderColor="gray.700">Date</Th>
                    <Th borderColor="gray.700">Amount (USD)</Th>
                    <Th borderColor="gray.700">Crypto</Th>
                    <Th borderColor="gray.700">Status</Th>
                    <Th borderColor="gray.700">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {userTransactions.map((tx) => (
                    <Tr key={tx.id}>
                      <Td borderColor="gray.700">{new Date(tx.created_at).toLocaleDateString()}</Td>
                      <Td borderColor="gray.700">${tx.amount_usd}</Td>
                      <Td borderColor="gray.700">{tx.amount_crypto} {tx.crypto_type}</Td>
                      <Td borderColor="gray.700">
                        <Badge
                          colorScheme={
                            tx.status === 'completed' ? 'green' :
                            tx.status === 'pending' ? 'yellow' :
                            'red'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </Td>
                      <Td borderColor="gray.700">
                        {tx.status === 'pending' && (
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => handleConfirmTransaction(tx.id)}
                          >
                            Send Crypto
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminPanel;

