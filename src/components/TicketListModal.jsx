import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    VStack,
    Button,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Badge,
    Box,
    Input,
    Select,
    Textarea,
    HStack,
    Collapse,
    Text,
    Divider,
    IconButton,
    AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay,
  } from "@chakra-ui/react";
  import { useState, useRef } from "react";
  import { AddIcon } from "@chakra-ui/icons";
  import { useToast } from "@chakra-ui/react";
  
  const TicketListModal = ({ isOpen, onClose, tickets = [], onViewTicket, userRole, onSubmitTicket, onCloseTicket }) => {
    const [showNewTicketForm, setShowNewTicketForm] = useState(false);
    const [newTicket, setNewTicket] = useState({
      subject: "",
      message: "",
      priority: "normal",
    });
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState(null);
    const cancelRef = useRef();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!newTicket.subject || !newTicket.message) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      try {
        setIsSubmitting(true); // Add loading state

        const response = await onSubmitTicket({
          subject: newTicket.subject,
          message: newTicket.message,
          priority: newTicket.priority
        });

        // Clear form and close
        setNewTicket({ subject: "", message: "", priority: "normal" });
        setShowNewTicketForm(false);

        // Show success message
        toast({
          title: 'Success',
          description: 'Your ticket has been created',
          status: 'success',
          duration: 3000,
        });

      } catch (error) {
        console.error('Ticket submission error:', error);
        toast({
          title: 'Error',
          description: error.response?.data?.message || 'Failed to create ticket',
          status: 'error',
          duration: 5000,
        });
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const handleCloseClick = (ticketId) => {
      setTicketToDelete(ticketId);
      setIsDeleteAlertOpen(true);
    };
  
    const handleConfirmDelete = () => {
      if (ticketToDelete) {
        onCloseTicket(ticketToDelete);
      }
      setIsDeleteAlertOpen(false);
      setTicketToDelete(null);
    };
  
    const AlertDialogComponent = (
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteAlertOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800">
            <AlertDialogHeader>Close Ticket?</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to close this ticket? 
              Closed tickets will no longer be visible in your support queue.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteAlertOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} ml={3}>
                Close Ticket
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  
    const sortTickets = (tickets) => {
      const filteredTickets = userRole === 'support' 
        ? tickets.filter(ticket => ticket.status !== 'closed')
        : tickets;

      const priorityOrder = {
        'high': 0,
        'normal': 1,
        'low': 2
      };

      return [...filteredTickets].sort((a, b) => {
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (a.status !== 'closed' && b.status === 'closed') return -1;
        
        if (a.status !== 'closed' && b.status !== 'closed') {
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
        }
        
        return new Date(b.created_at) - new Date(a.created_at);
      });
    };
  
    const sortedTickets = sortTickets(tickets);
  
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent bg="gray.900" borderRadius="lg" overflow="hidden">
          <ModalHeader>
            <HStack justify="space-between" align="center" pr={12}>
              <Text>Support Tickets</Text>
              {!['support', 'admin', 'owner'].includes(userRole) && tickets.length > 0 && (
                <Button
                  leftIcon={<AddIcon />}
                  colorScheme="blue"
                  size="sm"
                  onClick={() => setShowNewTicketForm(true)}
                >
                  New Ticket
                </Button>
              )}
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={6}>
            <VStack spacing={6} align="stretch">
              {/* New Ticket Form */}
              {showNewTicketForm && (
                <Box
                  w="full"
                  p={6}
                  bg="gray.800"
                  borderRadius="md"
                  shadow="md"
                  borderWidth="1px"
                  borderColor="gray.700"
                >
                  <Text fontSize="xl" fontWeight="semibold" color="white" mb={4}>
                    Create a New Ticket
                  </Text>
                  <form onSubmit={handleSubmit}>
                    <VStack spacing={4}>
                      <Input
                        placeholder="Ticket Subject"
                        value={newTicket.subject}
                        onChange={(e) =>
                          setNewTicket({ ...newTicket, subject: e.target.value })
                        }
                        bg="gray.700"
                        border="none"
                        _placeholder={{ color: "gray.400" }}
                        focusBorderColor="blue.500"
                      />
                      <Textarea
                        placeholder="Message"
                        value={newTicket.message}
                        onChange={(e) =>
                          setNewTicket({ ...newTicket, message: e.target.value })
                        }
                        bg="gray.700"
                        border="none"
                        _placeholder={{ color: "gray.400" }}
                        focusBorderColor="blue.500"
                        resize="none"
                        rows={5}
                      />
                      <HStack w="full" spacing={4}>
                        <Select
                          value={newTicket.priority}
                          onChange={(e) =>
                            setNewTicket({ ...newTicket, priority: e.target.value })
                          }
                          bg="gray.700"
                          border="none"
                          focusBorderColor="blue.500"
                          w="40%"
                        >
                          <option value="low">Low Priority</option>
                          <option value="normal">Normal Priority</option>
                          <option value="high">High Priority</option>
                        </Select>
                        <Button
                          type="submit"
                          colorScheme="blue"
                          w="60%"
                          size="lg"
                          isLoading={isSubmitting}
                          loadingText="Submitting..."
                        >
                          Submit Ticket
                        </Button>
                      </HStack>
                    </VStack>
                  </form>
                </Box>
              )}
  
              {/* Divider */}
              {showNewTicketForm && <Divider borderColor="gray.700" />}
  
              {/* Empty State - First Ticket */}
              {!showNewTicketForm && tickets.length === 0 && (
                <Box
                  textAlign="center"
                  py={10}
                  px={6}
                  bg="gray.800"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="gray.700"
                >
                  <Text color="gray.400" mb={4}>
                    {userRole === 'user' 
                      ? "Need help? Create your first support ticket to get started."
                      : "No support tickets available."}
                  </Text>
                  {userRole === 'user' && (
                    <Button
                      leftIcon={<AddIcon />}
                      colorScheme="blue"
                      size="lg"
                      onClick={() => setShowNewTicketForm(true)}
                    >
                      Create Your First Ticket
                    </Button>
                  )}
                </Box>
              )}
  
              {/* Existing Tickets Table */}
              {tickets.length > 0 && (
                <Box
                  w="full"
                  borderRadius="md"
                  bg="gray.800"
                  shadow="sm"
                  overflow="hidden"
                  maxH="60vh"
                  overflowY="auto"
                  css={{
                    '&::-webkit-scrollbar': {
                      width: '8px',
                      background: '#2D3748', // gray.700
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#1A202C', // gray.800
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
                  <Table size="sm">
                    <Thead position="sticky" top={0} bg="gray.900" zIndex={1}>
                      <Tr bg="gray.700">
                        <Th color="gray.300">ID</Th>
                        <Th color="gray.300">Subject</Th>
                        <Th color="gray.300">Status</Th>
                        <Th color="gray.300">Priority</Th>
                        <Th color="gray.300">Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sortedTickets.map((ticket) => (
                        <Tr
                          key={ticket.id}
                          _hover={{ bg: "gray.700", cursor: "pointer" }}
                        >
                          <Td color="white">#{ticket.id}</Td>
                          <Td color="gray.200">{ticket.subject}</Td>
                          <Td>
                            <Badge
                              colorScheme={
                                ticket.status === "open"
                                  ? "green"
                                  : ticket.status === "in_progress"
                                  ? "blue"
                                  : "gray"
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge
                              colorScheme={
                                ticket.priority === "high"
                                  ? "red"
                                  : ticket.priority === "normal"
                                  ? "yellow"
                                  : "green"
                              }
                            >
                              {ticket.priority}
                            </Badge>
                          </Td>
                          <Td borderColor="whiteAlpha.100">
                            <HStack spacing={2}>
                              <Button
                                size="sm"
                                colorScheme="blue"
                                onClick={() => {
                                  console.log('View button clicked for ticket:', ticket.id);
                                  onViewTicket(ticket.id);
                                }}
                              >
                                View
                              </Button>
                              {ticket.status !== 'closed' && (userRole === 'admin' || userRole === 'owner') && (
                                <Button
                                  size="sm"
                                  colorScheme="red"
                                  onClick={() => onCloseTicket(ticket.id)}
                                >
                                  Close
                                </Button>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
        {AlertDialogComponent}
      </Modal>
    );
  };
  
  export default TicketListModal;
  