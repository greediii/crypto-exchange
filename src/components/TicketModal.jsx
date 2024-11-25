import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Badge,
  Box,
  Input,
  Button,
  useToast,
  Divider,
  ModalFooter,
  Textarea,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const TicketModal = ({ isOpen, onClose, ticketId, userRole }) => {
  const [ticket, setTicket] = useState(null);
  const [responses, setResponses] = useState([]);
  const [newResponse, setNewResponse] = useState('');
  const toast = useToast();
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    const fetchTicketDetails = async () => {
      try {
        if (!ticketId) return;
        
        console.log('Fetching ticket details for ID:', ticketId);
        
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:3001/api/tickets/${ticketId}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        console.log('Ticket details response:', response.data);
        
        if (response.data && response.data.ticket) {
          setTicket(response.data.ticket);
          setResponses(response.data.responses || []);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error fetching ticket:', error);
        toast({
          title: 'Error',
          description: error.response?.data?.message || 'Failed to load ticket details',
          status: 'error',
          duration: 5000,
        });
        onClose(); // Close the modal on error
      }
    };

    if (isOpen && ticketId) {
      fetchTicketDetails();
    }
  }, [isOpen, ticketId, toast, onClose]);

  useEffect(() => {
    let pollInterval;
    
    const pollResponses = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:3001/api/tickets/${ticketId}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        if (response.data && response.data.responses) {
          setResponses(response.data.responses);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    if (isOpen && ticketId) {
      setIsPolling(true);
      pollInterval = setInterval(pollResponses, 3000); // Poll every 3 seconds
    }

    return () => {
      setIsPolling(false);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, ticketId]);

  const handleSubmitResponse = async () => {
    if (!newResponse.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:3001/api/tickets/${ticketId}/responses`,
        { message: newResponse },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResponses(prev => [...prev, {
        ...response.data,
        created_at: new Date().toISOString()
      }]);
      setNewResponse('');

      const responseContainer = document.querySelector('.response-container');
      if (responseContainer) {
        responseContainer.scrollTop = responseContainer.scrollHeight;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add response',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      default:
        return 'green';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'green';
      case 'in_progress':
        return 'blue';
      case 'closed':
        return 'gray';
      default:
        return 'yellow';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // Parse the SQLite timestamp correctly
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // For older dates, show the actual date and time
    return date.toLocaleString();
  };

  useEffect(() => {
    const responseContainer = document.querySelector('.response-container');
    if (responseContainer) {
      responseContainer.scrollTop = responseContainer.scrollHeight;
    }
  }, [responses]);

  if (!ticket) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.800" maxH="80vh">
        <ModalHeader>
          <HStack justify="space-between" pr={12}>
            <Text>Ticket #{ticketId}</Text>
            <HStack spacing={2}>
              <Badge colorScheme={getPriorityColor(ticket?.priority)}>
                {ticket?.priority}
              </Badge>
              <Badge colorScheme={getStatusColor(ticket?.status)}>
                {ticket?.status}
              </Badge>
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody 
          maxH="60vh" 
          overflowY="auto" 
          onWheel={(e) => {
            e.stopPropagation(); // Prevent parent scroll
            const container = e.currentTarget;
            container.scrollTop += e.deltaY;
          }}
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#2D3748', // gray.700
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#4A5568', // gray.600
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#718096', // gray.500
            },
          }}
        >
          <VStack align="stretch" spacing={4}>
            <Box>
              <HStack mb={1}>
                <Text fontWeight="bold">{ticket.creator_username}</Text>
                <Text fontSize="sm" color="gray.400">
                  {formatTimestamp(ticket.created_at)}
                </Text>
              </HStack>
              <Text>{ticket.message}</Text>
            </Box>
            
            {responses.map((response, index) => (
              <Box key={index}>
                <HStack mb={1}>
                  <Text fontWeight="bold">{response.username}</Text>
                  <Text fontSize="sm" color="gray.400">
                    {formatTimestamp(response.created_at)}
                  </Text>
                </HStack>
                <Text>{response.message}</Text>
              </Box>
            ))}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack w="full">
            <Textarea
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              placeholder="Type your response..."
              bg="gray.700"
              border="none"
              _focus={{ border: "none" }}
            />
            <Button 
              colorScheme="blue" 
              onClick={handleSubmitResponse}
              isFullWidth
            >
              Send Response
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TicketModal; 