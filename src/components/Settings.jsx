import {
  Container,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  useToast,
  Box,
  Text,
  HStack,
  useColorModeValue,
  Icon,
  IconButton,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { FaBitcoin, FaEthereum, FaUser, FaCrown, FaTicketAlt, FaExchangeAlt } from 'react-icons/fa';
import { SiLitecoin } from 'react-icons/si';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TicketModal from './TicketModal';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const [walletAddresses, setWalletAddresses] = useState({
    BTC: '',
    ETH: '',
    LTC: ''
  });

  const bgColor = useColorModeValue('gray.800', 'gray.800');
  const borderColor = useColorModeValue('gray.700', 'gray.700');

  // Load saved wallet addresses
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3001/api/user/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.walletAddresses) {
          setWalletAddresses(response.data.walletAddresses);
        }
      } catch (error) {
        console.error('Failed to load wallet addresses:', error);
      }
    };
    loadSettings();
  }, []);

  // Get user role on component mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      setUserRole(user.role);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3001/api/user/settings', { walletAddresses }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: 'Wallet Addresses Saved',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save wallet addresses',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handleProfileClick = () => navigate('/profile');
  const handleExchangeClick = () => navigate('/');
  const handleAdminClick = () => navigate('/admin');
  const handleTicketClick = () => setIsTicketModalOpen(true);

  return (
    <Container maxW="container.md" py={8}>
      {/* Navigation Bar */}
      <HStack w="full" justify="flex-end" mb={4}>
        <IconButton
          icon={<FaExchangeAlt />}
          onClick={handleExchangeClick}
          colorScheme="green"
          variant="ghost"
          aria-label="Exchange"
        />
        <IconButton
          icon={<FaTicketAlt />}
          onClick={handleTicketClick}
          colorScheme="purple"
          variant="ghost"
          aria-label="Support Tickets"
        />
        <IconButton
          icon={<FaUser />}
          onClick={handleProfileClick}
          colorScheme="blue"
          variant="ghost"
          aria-label="Profile"
        />
        {userRole === 'owner' && (
          <IconButton
            icon={<FaCrown />}
            onClick={handleAdminClick}
            colorScheme="yellow"
            variant="ghost"
            aria-label="Admin Panel"
          />
        )}
      </HStack>

      <VStack spacing={8} align="stretch">
        <Heading
          size="xl"
          bgGradient="linear(to-r, blue.400, purple.500)"
          bgClip="text"
          fontWeight="extrabold"
          textAlign="center"
          mb={6}
        >
          Default Wallet Settings
        </Heading>

        <Box
          as="form"
          onSubmit={handleSubmit}
          bg={bgColor}
          p={8}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="xl"
        >
          <VStack spacing={6} align="stretch">
            <Text fontSize="sm" color="gray.400" mb={4}>
              Set your default wallet addresses for each cryptocurrency. These will be auto-filled when making exchanges.
            </Text>

            <FormControl>
              <FormLabel>
                <HStack>
                  <Icon as={FaBitcoin} color="#F7931A" />
                  <Text>Bitcoin (BTC) Address</Text>
                </HStack>
              </FormLabel>
              <Input
                value={walletAddresses.BTC}
                onChange={(e) => setWalletAddresses({...walletAddresses, BTC: e.target.value})}
                placeholder="Enter your BTC wallet address"
              />
            </FormControl>

            <FormControl>
              <FormLabel>
                <HStack>
                  <Icon as={FaEthereum} color="#627EEA" />
                  <Text>Ethereum (ETH) Address</Text>
                </HStack>
              </FormLabel>
              <Input
                value={walletAddresses.ETH}
                onChange={(e) => setWalletAddresses({...walletAddresses, ETH: e.target.value})}
                placeholder="Enter your ETH wallet address"
              />
            </FormControl>

            <FormControl>
              <FormLabel>
                <HStack>
                  <Icon as={SiLitecoin} color="#345D9D" />
                  <Text>Litecoin (LTC) Address</Text>
                </HStack>
              </FormLabel>
              <Input
                value={walletAddresses.LTC}
                onChange={(e) => setWalletAddresses({...walletAddresses, LTC: e.target.value})}
                placeholder="Enter your LTC wallet address"
              />
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              isLoading={loading}
              w="full"
              mt={4}
              bgGradient="linear(to-r, blue.400, blue.600)"
              _hover={{
                bgGradient: "linear(to-r, blue.300, blue.500)",
                transform: 'translateY(-2px)',
                boxShadow: 'lg',
              }}
              transition="all 0.2s"
            >
              Save Wallet Addresses
            </Button>
          </VStack>
        </Box>
      </VStack>

      {/* Add the TicketModal */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
      />
    </Container>
  );
};

export default Settings; 