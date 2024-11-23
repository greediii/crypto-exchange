import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  VStack,
  HStack,
  Icon,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { motion } from 'framer-motion';
import axios from 'axios';

const MotionBox = motion(Box);

const API_URL = 'http://localhost:3001/api';

const AuthPage = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let endpoint = isLogin ? 'login' : 'register';
      if (!isLogin && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const response = await axios.post(`http://localhost:3001/api/auth/${endpoint}`, {
        username: formData.username,
        password: formData.password
      });

      console.log('Auth response:', response.data);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userRole', response.data.role);
        console.log('Setting userRole:', response.data.role);
        onAuthSuccess(response.data.role);
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Authentication failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const bgGradient = 'linear(to-r, blue.600, purple.600)';
  const cardBg = useColorModeValue('gray.800', 'gray.800');
  const inputBg = useColorModeValue('gray.700', 'gray.700');

  return (
    <Container maxW="container.md" py={20}>
      <MotionBox
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <VStack spacing={8}>
          <Box textAlign="center">
            <Heading
              size="2xl"
              bgGradient={bgGradient}
              bgClip="text"
              letterSpacing="tight"
              mb={4}
            >
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Heading>
            <Text color="gray.400">
              {isLogin
                ? 'Enter your credentials to access your account'
                : 'Sign up to start trading crypto'}
            </Text>
          </Box>

          <Box
            w="full"
            bg={cardBg}
            rounded="xl"
            boxShadow="2xl"
            p={8}
            borderWidth={1}
            borderColor="gray.700"
          >
            <form onSubmit={handleSubmit}>
              <VStack spacing={5}>
                <FormControl isRequired>
                  <FormLabel color="gray.300">Username</FormLabel>
                  <InputGroup>
                    <InputLeftElement>
                      <Icon as={FaUser} color="gray.500" />
                    </InputLeftElement>
                    <Input
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="Enter username"
                      bg={inputBg}
                      borderColor="gray.600"
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                    />
                  </InputGroup>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel color="gray.300">Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement>
                      <Icon as={FaLock} color="gray.500" />
                    </InputLeftElement>
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      bg={inputBg}
                      borderColor="gray.600"
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                    />
                    <InputRightElement>
                      <Icon
                        as={showPassword ? FaEyeSlash : FaEye}
                        color="gray.500"
                        cursor="pointer"
                        onClick={() => setShowPassword(!showPassword)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                {!isLogin && (
                  <FormControl isRequired>
                    <FormLabel color="gray.300">Confirm Password</FormLabel>
                    <InputGroup>
                      <InputLeftElement>
                        <Icon as={FaLock} color="gray.500" />
                      </InputLeftElement>
                      <Input
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirm password"
                        bg={inputBg}
                        borderColor="gray.600"
                        _hover={{ borderColor: 'gray.500' }}
                        _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                      />
                    </InputGroup>
                  </FormControl>
                )}

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  width="full"
                  isLoading={loading}
                  loadingText="Authenticating"
                >
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Button>

                <Divider borderColor="gray.600" />

                <HStack justify="center" spacing={2}>
                  <Text color="gray.400">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  </Text>
                  <Button
                    variant="link"
                    color="blue.400"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? 'Sign Up' : 'Sign In'}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>
        </VStack>
      </MotionBox>
    </Container>
  );
};

export default AuthPage; 