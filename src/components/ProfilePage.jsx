import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Grid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  useToast,
  HStack,
  Icon,
  useColorModeValue,
  IconButton,
  Center,
  Divider,
  Progress,
  Tooltip,
} from '@chakra-ui/react';
import { FaBitcoin, FaEthereum, FaHistory, FaWallet, FaExchangeAlt, FaCrown, FaQuestionCircle } from 'react-icons/fa';
import { SiLitecoin } from 'react-icons/si';
import axios from 'axios';

const ProfilePage = ({ onExchangeClick, userRole, onAdminClick }) => {
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingTransactions, setPendingTransactions] = useState(0);
  const [cryptoStats, setCryptoStats] = useState([]);
  const toast = useToast();

  const bgColor = useColorModeValue('gray.800', 'gray.800');
  const borderColor = useColorModeValue('gray.700', 'gray.700');

  const fetchProfileData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profile data',
        status: 'error',
        duration: 5000,
      });
    }
  }, [toast]);

  const fetchTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/profile/transactions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
      const pending = response.data.filter(tx => tx.status === 'pending').length;
      setPendingTransactions(pending);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load transactions',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfileData();
    fetchTransactions();
  }, [fetchProfileData, fetchTransactions]);

  const getRewardTiers = (totalExchanged) => {
    const tiers = [
      { threshold: 500, reward: '2% Fee', progress: Math.min((totalExchanged / 500) * 100, 100) },
      { threshold: 1000, reward: '1.5% Fee', progress: Math.min((totalExchanged / 1000) * 100, 100) },
      { threshold: 5000, reward: '1% Fee', progress: Math.min((totalExchanged / 5000) * 100, 100) }
    ];

    const currentTier = tiers.find(tier => totalExchanged < tier.threshold) || tiers[tiers.length - 1];
    const nextTier = tiers[tiers.indexOf(currentTier) + 1];

    return {
      currentTier,
      nextTier,
      isMaxTier: !nextTier,
      allTiers: tiers
    };
  };

  const rewards = getRewardTiers(profile?.total_exchanged || 0);

  const calculateMostUsedCrypto = (transactions) => {
    const cryptoCounts = transactions.reduce((acc, tx) => {
      const crypto = tx.crypto_type;
      acc[crypto] = (acc[crypto] || 0) + 1;
      return acc;
    }, {});

    const mostUsed = Object.entries(cryptoCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return mostUsed ? {
      crypto: mostUsed[0],
      count: mostUsed[1]
    } : { crypto: 'None', count: 0 };
  };

  const mostUsedCrypto = calculateMostUsedCrypto(transactions);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <HStack w="full" justify="space-between" mb={4}>
          <Heading
            size="xl"
            bgGradient="linear(to-r, blue.400, purple.500)"
            bgClip="text"
          >
            Profile Dashboard
          </Heading>
          <HStack>
            <IconButton
              icon={<FaExchangeAlt />}
              onClick={onExchangeClick}
              colorScheme="green"
              variant="ghost"
              aria-label="Go to Exchange"
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
        </HStack>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
          <Stat
            bg={bgColor}
            p={6}
            borderRadius="lg"
            borderWidth={1}
            borderColor={borderColor}
          >
            <VStack spacing={3} align="stretch">
              <StatLabel fontSize="lg">Total Exchanged</StatLabel>
              <HStack spacing={4} align="center" justify="center">
                <Icon 
                  as={FaWallet}
                  boxSize={8}
                  color="green.400"
                />
                <StatNumber 
                  fontSize="2xl"
                  bgGradient="linear(to-r, green.400, teal.400)"
                  bgClip="text"
                >
                  ${profile?.total_exchanged?.toLocaleString() || '0.00'}
                </StatNumber>
              </HStack>
              <Box>
                <StatHelpText mb={0} textAlign="center">
                  Since {new Date(profile?.created_at).toLocaleDateString()} 
                  ({Math.ceil((Date.now() - new Date(profile?.created_at)) / (1000 * 60 * 60 * 24))} days)
                </StatHelpText>
                <Box>
                  <Progress 
                    value={rewards.currentTier.progress}
                    size="sm"
                    colorScheme="green"
                    borderRadius="full"
                    mt={2}
                    hasStripe
                    isAnimated
                  />
                  <HStack justify="space-between" mt={1} fontSize="xs">
                    <Tooltip 
                      label={
                        rewards.isMaxTier 
                          ? "Maximum tier reached!" 
                          : `Next reward: ${rewards.nextTier.reward} at $${rewards.nextTier.threshold}`
                      }
                    >
                      <Text 
                        color={rewards.currentTier.progress >= 100 ? "green.400" : "gray.500"}
                        fontWeight={rewards.currentTier.progress >= 100 ? "bold" : "normal"}
                        cursor="help"
                        w="full"
                        textAlign="center"
                      >
                        {rewards.currentTier.progress >= 100 
                          ? `${rewards.currentTier.reward} Unlocked! 🎉` 
                          : `Progress to ${rewards.currentTier.reward}`}
                      </Text>
                    </Tooltip>
                  </HStack>
                </Box>
              </Box>
            </VStack>
          </Stat>
          
          <Stat
            bg={bgColor}
            p={6}
            borderRadius="lg"
            borderWidth={1}
            borderColor={borderColor}
          >
            <VStack spacing={4}>
              <StatLabel fontSize="lg">Transactions</StatLabel>
              <HStack 
                width="full" 
                justify="space-between" 
                align="center" 
                spacing={4}
              >
                <Box textAlign="center">
                  <StatNumber color="green.400" fontSize="xl">
                    {transactions.filter(tx => tx.status === 'completed').length}
                  </StatNumber>
                  <StatHelpText color="green.400" mb={0}>
                    Confirmed
                  </StatHelpText>
                </Box>

                <Center height="50px">
                  <Divider orientation="vertical" />
                </Center>

                <StatNumber fontSize="2xl">
                  {transactions.length}
                </StatNumber>

                <Center height="50px">
                  <Divider orientation="vertical" />
                </Center>

                <Box textAlign="center">
                  <StatNumber color="yellow.400" fontSize="xl">
                    {transactions.filter(tx => tx.status === 'pending').length}
                  </StatNumber>
                  <StatHelpText color="yellow.400" mb={0}>
                    Pending
                  </StatHelpText>
                </Box>
              </HStack>
              <Text fontSize="sm" color="gray.400">
                Average: ${transactions.length > 0 
                  ? (transactions.reduce((sum, tx) => sum + parseFloat(tx.amount_usd), 0) / transactions.length).toFixed(2)
                  : '0.00'}
              </Text>
            </VStack>
          </Stat>

          <Box
            bg="#1A202C"
            borderRadius="xl"
            overflow="hidden"
            border="1px solid"
            borderColor="whiteAlpha.200"
            h="full"
          >
            <Stat p={6} h="full">
              <VStack spacing={6} align="stretch" h="full">
                <Text 
                  fontSize="md" 
                  color="white"
                  fontFamily="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
                  fontWeight="500"
                >
                  Most Used Crypto
                </Text>
                
                <Center flex="1">
                  <HStack spacing={3}>
                    <Icon 
                      as={
                        mostUsedCrypto.crypto === 'BTC' ? FaBitcoin :
                        mostUsedCrypto.crypto === 'ETH' ? FaEthereum :
                        mostUsedCrypto.crypto === 'LTC' ? SiLitecoin :
                        FaQuestionCircle  // Default icon for "None"
                      }
                      color={
                        mostUsedCrypto.crypto === 'BTC' ? '#F7931A' :
                        mostUsedCrypto.crypto === 'ETH' ? '#627EEA' :
                        mostUsedCrypto.crypto === 'LTC' ? '#345D9D' :
                        'gray.400'  // Default color for "None"
                      }
                      boxSize={7}
                    />
                    <Text color="white" fontSize="xl" fontWeight="medium">
                      {mostUsedCrypto.crypto}
                    </Text>
                  </HStack>
                </Center>

                <Box>
                  <Text color="gray.400" fontSize="sm" mb={2}>
                    {mostUsedCrypto.count} Transactions
                  </Text>
                  <Progress 
                    value={mostUsedCrypto.crypto === 'None' ? 0 : 80} 
                    sx={{
                      '& > div': {
                        background: mostUsedCrypto.crypto === 'BTC' ? '#F7931A' :
                                   mostUsedCrypto.crypto === 'ETH' ? '#627EEA' :
                                   mostUsedCrypto.crypto === 'LTC' ? '#345D9D' :
                                   'gray.400'  // Default color for "None"
                      },
                      bg: 'rgba(255, 255, 255, 0.1)'
                    }}
                    size="xs"
                    borderRadius="full"
                  />
                </Box>
              </VStack>
            </Stat>
          </Box>
        </Grid>

        <Tabs variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab><Icon as={FaHistory} mr={2} /> Transaction History</Tab>
            <Tab><Icon as={FaWallet} mr={2} /> Saved Wallets</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Amount (USD)</Th>
                      <Th>Crypto Amount</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {transactions.map((tx) => (
                      <Tr key={tx.id}>
                        <Td>{new Date(tx.created_at).toLocaleDateString()}</Td>
                        <Td>${tx.amount_usd}</Td>
                        <Td>{tx.amount_crypto} {tx.crypto_type}</Td>
                        <Td>
                          <HStack>
                            <Icon 
                              as={
                                tx.crypto_type === 'BTC' ? FaBitcoin :
                                tx.crypto_type === 'ETH' ? FaEthereum :
                                SiLitecoin
                              }
                              color={
                                tx.crypto_type === 'BTC' ? 'orange.400' :
                                tx.crypto_type === 'ETH' ? 'purple.400' :
                                'gray.400'
                              }
                            />
                            <Text>{tx.crypto_type}</Text>
                          </HStack>
                        </Td>
                        <Td>
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
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                <Text mt={4}>
                  Average: ${transactions.filter(tx => tx.status === 'completed')
                    .reduce((sum, tx) => sum + parseFloat(tx.amount_usd), 0) / 
                    transactions.filter(tx => tx.status === 'completed').length || 0}
                </Text>
              </Box>
            </TabPanel>

            <TabPanel>
              <VStack spacing={4} align="stretch">
                {/* Saved wallet addresses will go here */}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
};

export default ProfilePage; 