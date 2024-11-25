import {
  Box,
  VStack,
  HStack,
  Text,
  RangeSlider,
  RangeSliderTrack,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tooltip,
  Button,
  IconButton,
  useToast,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  SimpleGrid,
} from '@chakra-ui/react';
import { FaBitcoin, FaEthereum, FaTrash } from 'react-icons/fa';
import { SiLitecoin } from 'react-icons/si';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Configuration for cryptocurrencies
const cryptoConfig = {
  BTC: { icon: FaBitcoin, color: '#F7931A', name: 'Bitcoin' },
  ETH: { icon: FaEthereum, color: '#627EEA', name: 'Ethereum' },
  LTC: { icon: SiLitecoin, color: '#345D9D', name: 'Litecoin' },
};

// Component for managing fee rules
const FeeManagement = () => {
  const [feeRules, setFeeRules] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [feePercentage, setFeePercentage] = useState(22);
  const toast = useToast();

  useEffect(() => {
    const fetchFeeRules = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('No auth token found');
          return;
        }
        
        const response = await axios.get('http://localhost:3001/api/admin/fee-rules', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data) {
          setFeeRules(response.data.map(rule => ({
            id: rule.id,
            crypto: rule.crypto_type,
            priceRangeStart: rule.price_range_start,
            priceRangeEnd: rule.price_range_end,
            feePercentage: rule.fee_percentage
          })));
        }
      } catch (error) {
        console.error('Error fetching fee rules:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch fee rules',
          status: 'error',
          duration: 3000,
        });
      }
    };

    fetchFeeRules();
  }, []);

  // Add new fee rule
  const addFeeRule = async () => {
      const [priceRangeStart, priceRangeEnd] = priceRange;

      // Check for overlapping rules
      const isOverlapping = feeRules.some(
          (rule) =>
              rule.crypto === selectedCrypto &&
              ((priceRangeStart >= rule.priceRangeStart && priceRangeStart <= rule.priceRangeEnd) ||
                  (priceRangeEnd >= rule.priceRangeStart && priceRangeEnd <= rule.priceRangeEnd))
      );

      if (isOverlapping) {
          return toast({
              title: 'Overlap Detected',
              description: 'Price range overlaps with an existing rule.',
              status: 'error',
              duration: 3000,
          });
      }

      // Define newRule here
      const newRule = {
          crypto: selectedCrypto,
          priceRangeStart,
          priceRangeEnd,
          feePercentage,
          id: Date.now(),
      };

      try {
          const token = localStorage.getItem('token');
          if (!token) {
              throw new Error('No token found in localStorage');
          }
          await axios.post('http://localhost:3001/api/admin/fee-rules', {
              crypto_type: selectedCrypto,
              price_range_start: priceRangeStart,
              price_range_end: priceRangeEnd,
              fee_percentage: feePercentage,
          }, {
              headers: {
                  Authorization: `Bearer ${token}`,
              },
          });
          setFeeRules((prev) => [...prev, newRule].sort((a, b) => a.priceRangeStart - b.priceRangeStart));
          toast({
              title: 'Fee Rule Added',
              description: `${cryptoConfig[selectedCrypto].name} fee rule added for $${priceRangeStart}-$${priceRangeEnd}`,
              status: 'success',
          });
      } catch (error) {
          console.error('Error adding fee rule:', error);
          toast({
              title: 'Error',
              description: 'Failed to add fee rule.',
              status: 'error',
              duration: 3000,
          });
      }
  };

  // Remove fee rule
  const removeFeeRule = async (id) => {
      try {
          const token = localStorage.getItem('token');
          if (!token) {
              throw new Error('No token found in localStorage');
          }
          await axios.delete(`http://localhost:3001/api/admin/fee-rules/${id}`, {
              headers: {
                  Authorization: `Bearer ${token}`,
              },
          });
          setFeeRules((prev) => prev.filter((rule) => rule.id !== id));
          toast({
              title: 'Fee Rule Removed',
              status: 'success',
              duration: 3000,
          });
      } catch (error) {
          console.error('Error removing fee rule:', error);
          toast({
              title: 'Error',
              description: 'Failed to remove fee rule.',
              status: 'error',
              duration: 3000,
          });
      }
  };

  return (
      <Box bg="gray.900" borderRadius="xl" p={4} boxShadow="xl" border="1px solid" borderColor="gray.800">
          <VStack spacing={4} align="stretch">
              <Heading size="md" mb={2}>
                  Dynamic Fee Management
              </Heading>

              {/* Fee Rule Creator */}
              <Box bg="gray.800" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.700">
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                      {Object.entries(cryptoConfig).map(([symbol, config]) => (
                          <CryptoCard
                              key={symbol}
                              symbol={symbol}
                              config={config}
                              isSelected={selectedCrypto === symbol}
                              priceRange={priceRange}
                              setPriceRange={setPriceRange}
                              setFeePercentage={setFeePercentage}
                              setSelectedCrypto={setSelectedCrypto}
                              feePercentage={feePercentage}
                              addFeeRule={addFeeRule}
                          />
                      ))}
                  </SimpleGrid>
              </Box>

              {/* Fee Rules Table */}
              <FeeRulesTable 
                  feeRules={feeRules} 
                  cryptoConfig={cryptoConfig} 
                  removeFeeRule={removeFeeRule} 
              />
          </VStack>
      </Box>
  );
};

// Component for individual cryptocurrency card
const CryptoCard = ({
  symbol,
  config,
  isSelected,
  priceRange,
  setPriceRange,
  setFeePercentage,
  setSelectedCrypto,
  feePercentage,
  addFeeRule,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [priceRangeStart, priceRangeEnd] = isSelected ? priceRange : [0, 10000];

  return (
      <Box
          bg="gray.800"
          p={4}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={config.color}
          opacity={isSelected ? 1 : 0.7}
          _hover={{ 
              transform: 'translateY(-2px)',
              opacity: 1
          }}
          transition="all 0.2s"
      >
          <VStack spacing={4}>
              <HStack>
                  <Box as={config.icon} color={config.color} boxSize={6} />
                  <Text fontWeight="bold">{config.name}</Text>
              </HStack>

              <VStack w="full" spacing={0}>
                  <Text fontSize="sm">Price Range (USD)</Text>
                  <RangeSlider
                      min={0}
                      max={10000}
                      step={10}
                      value={[priceRangeStart, priceRangeEnd]}
                      onChange={(val) => {
                          setSelectedCrypto(symbol);
                          setPriceRange(val);
                      }}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                  >
                      <RangeSliderTrack bg="gray.700">
                          <RangeSliderFilledTrack bg={config.color} />
                      </RangeSliderTrack>
                      <Tooltip
                          hasArrow
                          bg={config.color}
                          color="white"
                          placement="top"
                          isOpen={showTooltip}
                          label={`$${priceRangeStart.toLocaleString()}`}
                      >
                          <RangeSliderThumb index={0} />
                      </Tooltip>
                      <Tooltip
                          hasArrow
                          bg={config.color}
                          color="white"
                          placement="top"
                          isOpen={showTooltip}
                          label={`$${priceRangeEnd.toLocaleString()}`}
                      >
                          <RangeSliderThumb index={1} />
                      </Tooltip>
                  </RangeSlider>
              </VStack>

              <VStack w="full" spacing={0}>
                  <Text fontSize="sm">Fee %</Text>
                  <NumberInput
                      value={isSelected ? feePercentage : 0}
                      onChange={(valueString, valueNumber) => {
                          setSelectedCrypto(symbol);
                          setFeePercentage(valueNumber || 0);
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                      bg="gray.700"
                  >
                      <NumberInputField />
                      <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                      </NumberInputStepper>
                  </NumberInput>
              </VStack>

              <Button 
                  colorScheme="blue" 
                  w="full" 
                  size="sm" 
                  bg={config.color} 
                  onClick={addFeeRule}
                  _hover={{
                      bg: config.color,
                      opacity: 0.8
                  }}
              >
                  Add Rule
              </Button>
          </VStack>
      </Box>
  );
};

// Component for fee rules table
const FeeRulesTable = ({ feeRules, cryptoConfig, removeFeeRule }) => {
  return (
      <Table variant="simple" size="sm">
          <Thead>
              <Tr>
                  <Th>Crypto</Th>
                  <Th>Price Range</Th>
                  <Th>Fee %</Th>
                  <Th>Actions</Th>
              </Tr>
          </Thead>
          <Tbody>
              {feeRules.map((rule) => (
                  <Tr key={rule.id}>
                      <Td>
                          <HStack>
                              <Box as={cryptoConfig[rule.crypto].icon} color={cryptoConfig[rule.crypto].color} />
                              <Text>{cryptoConfig[rule.crypto].name}</Text>
                          </HStack>
                      </Td>
                      <Td>
                          ${rule.priceRangeStart.toLocaleString()} - ${rule.priceRangeEnd.toLocaleString()}
                      </Td>
                      <Td>{rule.feePercentage}%</Td>
                      <Td>
                          <IconButton
                              size="sm"
                              icon={<FaTrash />}
                              aria-label="Delete Rule"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => removeFeeRule(rule.id)}
                          />
                      </Td>
                  </Tr>
              ))}
          </Tbody>
      </Table>
  );
};

export default FeeManagement;