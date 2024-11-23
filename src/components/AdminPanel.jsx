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
} from '@chakra-ui/react';
import { FaCrown, FaUsers, FaPercent, FaDollarSign, FaCog, FaChartLine, FaExchangeAlt, FaUserCheck, FaChartPie, FaArrowUp, FaArrowDown, FaClock, FaCheckCircle, FaBitcoin, FaEthereum } from 'react-icons/fa';
import { SiLitecoin, SiDogecoin, SiMonero } from 'react-icons/si';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

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

const StatsCard = ({ label, value, change, icon: Icon }) => (
  <Box
    bg="whiteAlpha.50"
    p={4}
    borderRadius="lg"
    borderWidth="1px"
    borderColor="whiteAlpha.100"
  >
    <HStack justify="space-between" mb={2}>
      <Icon color="blue.400" boxSize={5} />
      <Badge 
        colorScheme={parseFloat(change) >= 0 ? 'green' : 'red'}
        variant="subtle"
      >
        {change}%
      </Badge>
    </HStack>
    <Text color="gray.400" fontSize="sm">{label}</Text>
    <Text fontSize="2xl" fontWeight="bold">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </Text>
  </Box>
);

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
      await axios.put('http://localhost:3001/api/admin/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast({
        title: 'Success',
        description: 'Settings updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
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
            {/* Quick Stats Row */}
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">Quick Stats</Heading>
              <SimpleGrid columns={2} spacing={4}>
                <StatsCard
                  label="Daily Active Users"
                  value={extendedStats.dailyActiveUsers.value}
                  change={extendedStats.dailyActiveUsers.change}
                  icon={FaUsers}
                />
                <StatsCard
                  label="Currently Online"
                  value={extendedStats.currentOnline}
                  change="+0"
                  icon={FaUserCheck}
                />
              </SimpleGrid>
            </VStack>

            {/* Performance Metrics */}
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">Performance</Heading>
              <SimpleGrid columns={2} spacing={4}>
                <StatsCard
                  label="Success Rate"
                  value={`${extendedStats.successRate.value}%`}
                  change={extendedStats.successRate.change}
                  icon={FaCheckCircle}
                />
                <StatsCard
                  label="Response Time"
                  value={`${extendedStats.averageResponseTime}m`}
                  change="-2.3"
                  icon={FaClock}
                />
              </SimpleGrid>
            </VStack>

            {/* Volume Metrics */}
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">Volume</Heading>
              <SimpleGrid columns={2} spacing={4}>
                <StatsCard
                  label="Total Volume"
                  value={`$${stats.totalVolume.toLocaleString()}`}
                  change={extendedStats.weeklyGrowth.change}
                  icon={FaDollarSign}
                />
                <StatsCard
                  label="Avg Transaction"
                  value={`$${extendedStats.averageTransactionSize.toLocaleString()}`}
                  change="+5.2"
                  icon={FaExchangeAlt}
                />
              </SimpleGrid>
            </VStack>

            {/* Crypto Distribution */}
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">Crypto Distribution</Heading>
              <Box>
                {extendedStats.topCryptos.map((crypto) => {
                  const config = CRYPTO_CONFIG[crypto.name] || {
                    icon: FaBitcoin,
                    color: 'gray.400',
                    gradient: 'linear(to-r, gray.400, gray.500)'
                  };
                  
                  return (
                    <Box key={crypto.name} mb={3}>
                      <HStack justify="space-between" mb={2}>
                        <HStack>
                          <Icon as={config.icon} boxSize={5} color={config.color} />
                          <Text fontSize="sm">{crypto.name}</Text>
                        </HStack>
                        <Text fontSize="sm" fontWeight="bold">
                          {crypto.percentage.toFixed(1)}%
                        </Text>
                      </HStack>
                      <Progress
                        value={crypto.percentage}
                        size="sm"
                        borderRadius="full"
                        sx={{
                          '& > div': {
                            background: config.color,
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

            {/* User Metrics */}
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.400">User Metrics</Heading>
              <SimpleGrid columns={2} spacing={4}>
                <StatsCard
                  label="New Users Today"
                  value={extendedStats.newUsersToday}
                  change="+12.5"
                  icon={FaUsers}
                />
                <StatsCard
                  label="Repeat Users"
                  value={`${extendedStats.repeatUsers}%`}
                  change="+3.2"
                  icon={FaUserCheck}
                />
              </SimpleGrid>
            </VStack>

            {/* Transaction Status */}
            <VStack align="stretch" spacing={4}>
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
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <FormControl>
            <FormLabel color="gray.300">Fee Percentage</FormLabel>
            <Input
              type="number"
              value={settings.feePercentage}
              onChange={(e) => setSettings({ ...settings, feePercentage: e.target.value })}
              bg="whiteAlpha.50"
              borderColor="whiteAlpha.100"
              _hover={{ borderColor: "blue.400" }}
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #4299E1" }}
            />
          </FormControl>
          <FormControl>
            <FormLabel color="gray.300">CashApp Username</FormLabel>
            <Input
              value={settings.cashappUsername}
              onChange={(e) => setSettings({ ...settings, cashappUsername: e.target.value })}
              bg="whiteAlpha.50"
              borderColor="whiteAlpha.100"
              _hover={{ borderColor: "blue.400" }}
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #4299E1" }}
            />
          </FormControl>
        </SimpleGrid>
        <Button
          colorScheme="blue"
          onClick={updateSettings}
          mt={6}
          size="lg"
          width="full"
          bgGradient="linear(to-r, blue.400, blue.600)"
          _hover={{
            bgGradient: "linear(to-r, blue.300, blue.500)",
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
          }}
          transition="all 0.2s"
        >
          Save Settings
        </Button>
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
